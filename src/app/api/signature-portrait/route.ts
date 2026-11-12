import { NextRequest } from "next/server";
import sharp from "sharp";
import { escapeSignatureText } from "@/lib/email-signature";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Only our public uploads may be fetched; arbitrary remote URLs and redirects are refused. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const color = /^[0-9a-f]{6}$/i.test(params.get("color") || "") ? `#${params.get("color")}` : "#665080";
  const initials = escapeSignatureText((params.get("initials") || "T").slice(0, 3));
  const theme = params.get("theme");
  const backdrop = theme === "executive" ? "#64546f" : theme === "editorial" ? "#c9a8b7" : "#b7a0be";
  const design = ["diagonal", "arch", "rounded", "plain"].includes(params.get("design") || "") ? params.get("design") : "diagonal";
  const frame = theme === "executive" ? "#302939" : theme === "editorial" ? "#e7ccd5" : "#e0c8e3";
  let photo: Buffer | null = null;
  try {
    const source = new URL(params.get("src") || "");
    const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (source.origin === storage.origin && source.protocol === "https:" && !source.username && !source.password && /^\/storage\/v1\/object\/public\/card-assets\/[a-zA-Z0-9/_ .%-]+$/.test(source.pathname)) {
      const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (response.ok && /^image\/(png|jpeg|webp)/.test(response.headers.get("content-type") || "")) {
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        if (reader) {
          try { while (true) { const item = await reader.read(); if (item.done) break; total += item.value.length; if (total > 3 * 1024 * 1024) { await reader.cancel(); break; } chunks.push(item.value); } }
          finally { reader.releaseLock(); }
          if (total > 0 && total <= 3 * 1024 * 1024) photo = await sharp(Buffer.concat(chunks), { limitInputPixels: 20_000_000 }).rotate().resize(300, 408, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        }
      }
    }
  } catch { /* A missing or invalid upload renders the owner's initials. */ }
  const fallback = Buffer.from(`<svg width="300" height="408"><rect width="300" height="408" rx="12" fill="${color}"/><text x="150" y="230" text-anchor="middle" font-family="Arial,sans-serif" font-size="80" font-weight="bold" fill="white">${initials}</text></svg>`);
  // Keep the entire upload visible. Decorative frames never mask the face or body.
  const decorations = design === "diagonal"
    ? `<path fill="${backdrop}" opacity=".6" d="M0 448L160 20H190L30 448Z M190 448L350 20H380L220 448Z"/><path fill="${color}" opacity=".45" d="M0 448L45 328H70L25 448Z M300 128L340 20H370L330 128Z"/>`
    : design === "arch" ? `<path d="M22 450V185a168 168 0 0 1 336 0v265Z" fill="${frame}" stroke="${backdrop}" stroke-width="2"/>`
    : design === "rounded" ? `<rect x="22" y="12" width="336" height="444" rx="28" fill="${frame}" stroke="${backdrop}" stroke-width="2"/>` : "";
  const background = Buffer.from(`<svg width="380" height="468">${decorations}</svg>`);
  const image = await sharp(background).composite([{ input: photo || await sharp(fallback).png().toBuffer(), left: 40, top: 30 }]).png().toBuffer();
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
