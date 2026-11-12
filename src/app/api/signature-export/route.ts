import { createHash } from "node:crypto";
import sharp from "sharp";
import { getUser } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const { user, supabase } = await getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!(await rateLimit(`signature-export:${user.id}`, 10, 60))) return Response.json({ error: "Please wait a minute before exporting again." }, { status: 429 });
  if (Number(request.headers.get("content-length")) > 8_500_000) return Response.json({ error: "Signature image is too large." }, { status: 413 });
  try {
    const form = await request.formData();
    if (form.get("kind") === "assets") {
      const files = Array.from(form.entries()).filter(([key]) => key.startsWith("asset-"));
      if (!files.length || files.length > 12) return Response.json({ error: "Invalid signature assets." }, { status: 400 });
      const ordered = files.sort(([a], [b]) => Number(a.slice(6)) - Number(b.slice(6)));
      let total = 0;
      const assets = [];
      // Validate the full batch before writing any files.
      for (const [, file] of ordered) {
        if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_097_152) return Response.json({ error: "Invalid signature image." }, { status: 400 });
        total += file.size;
        if (total > 8_000_000) return Response.json({ error: "Signature images are too large." }, { status: 413 });
        const source = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 4_000_000 });
        const meta = await source.metadata();
        if (!["png", "jpeg", "webp"].includes(meta.format || "")) return Response.json({ error: "Unsupported signature image." }, { status: 400 });
        const png = await source.png().toBuffer();
        const hash = createHash("sha256").update(png).digest("hex").slice(0, 24);
        assets.push({ png, path: `${user.id}/signature-asset-${hash}.png` });
      }
      const urls: string[] = [];
      for (const asset of assets) {
        const { error } = await supabase.storage.from("card-assets").upload(asset.path, asset.png, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
        if (error) return Response.json({ error: "Could not save signature images. Please try again." }, { status: 500 });
        urls.push(supabase.storage.from("card-assets").getPublicUrl(asset.path).data.publicUrl);
      }
      return Response.json({ urls });
    }
    const file = form.get("image");
    if (!(file instanceof File) || file.type !== "image/png" || file.size > 2_097_152) return Response.json({ error: "Choose a PNG image smaller than 2 MB." }, { status: 400 });
    const input = Buffer.from(await file.arrayBuffer());
    const source = sharp(input, { limitInputPixels: 4_000_000 });
    const meta = await source.metadata();
    if (meta.format !== "png" || ![760, 880, 1200].includes(meta.width || 0) || !meta.height || meta.height > 2400) return Response.json({ error: "Invalid signature image dimensions." }, { status: 400 });
    const png = await source.png().toBuffer();
    const hash = createHash("sha256").update(png).digest("hex").slice(0, 24);
    const path = `${user.id}/signature-${hash}.png`;
    const { error } = await supabase.storage.from("card-assets").upload(path, png, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
    if (error) return Response.json({ error: "Could not save the signature image. Please try again." }, { status: 500 });
    return Response.json({ url: supabase.storage.from("card-assets").getPublicUrl(path).data.publicUrl });
  } catch { return Response.json({ error: "Could not prepare this signature image." }, { status: 400 }); }
}
