import { NextRequest } from "next/server";
import { signatureMotionGif } from "@/lib/signature-motion";

export const runtime = "nodejs";
export function GET(request: NextRequest) {
  const color = request.nextUrl.searchParams.get("color") || "5654d9";
  const mode = request.nextUrl.searchParams.get("mode");
  if (!/^[0-9a-f]{6}$/i.test(color) || !["float", "reveal"].includes(mode || "")) return new Response("Invalid animation", { status: 400 });
  return new Response(new Uint8Array(signatureMotionGif(color, mode === "float")), { headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=86400, s-maxage=604800", "X-Content-Type-Options": "nosniff" } });
}
