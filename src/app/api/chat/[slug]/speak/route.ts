import { ApiError } from "@google/genai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { synthesize } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/utils";
import { verifySpeakToken } from "@/lib/voice";

export const maxDuration = 60;

const body = z.object({ text: z.string().min(1).max(2000), token: z.string().min(10).max(100) });

/** Reads one of the AI's replies aloud in its Gemini voice, in whatever language the reply is written in. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/chat/[slug]/speak">) {
  const { slug } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifySpeakToken(slug, parsed.data.text, parsed.data.token)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const ip = clientIp(request.headers);
  const allowed = (await rateLimit(`speak:${ip}`, 40, 600)) && (await rateLimit(`speak-card:${slug}`, 600, 3600));
  if (!allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    const { audio, mimeType } = await synthesize(parsed.data.text);
    return new NextResponse(new Uint8Array(audio), { headers: { "content-type": mimeType, "cache-control": "private, max-age=3600" } });
  } catch (e) {
    console.error("Gemini speech error", e instanceof ApiError ? `${e.status} ${e.message}` : e);
    return NextResponse.json({ error: "Voice is unavailable right now." }, { status: 503 });
  }
}
