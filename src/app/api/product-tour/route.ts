import { NextRequest } from "next/server";
import { productTourChapters } from "@/lib/product-tour";
import { cachedProductAudio, productTourAudio } from "@/lib/product-tour-audio";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/utils";

export const maxDuration = 30;
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("chapter") || "";
  if (!/^\d$/.test(raw) || Number(raw) >= productTourChapters.length) return new Response("Unknown chapter", { status: 400 });
  if (!process.env.GEMINI_API_KEY) return new Response("Studio narration is not configured", { status: 503 });
  const chapter = Number(raw);
  if (!(await rateLimit(`product-tour:${clientIp(request.headers)}`, 30, 60))) return new Response("Please try again shortly", { status: 429 });
  const existing = cachedProductAudio(chapter);
  if (!existing && !(await rateLimit("product-tour:generate", 60, 3600))) return new Response("Please try again shortly", { status: 429 });
  try {
    const result = await (existing || productTourAudio(chapter));
    return new Response(new Uint8Array(result.audio), { headers: { "Content-Type": result.mimeType, "Cache-Control": "public, max-age=86400, s-maxage=604800", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Studio narration is temporarily unavailable", { status: 503 }); }
}
