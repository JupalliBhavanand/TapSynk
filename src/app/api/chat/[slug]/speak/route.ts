import { ApiError } from "@google/genai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prepareReplyAudio, streamReplyAudio } from "@/lib/reply-audio";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/utils";
import { speechLanguage, verifySpeakToken } from "@/lib/voice";

export const maxDuration = 60;

const body = z.object({ text: z.string().min(1).max(2000), token: z.string().min(10).max(100), language: z.string().max(35).optional(), stream: z.boolean().optional() });

/** Reads one of the AI's replies aloud in its Gemini voice, in whatever language the reply is written in. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/chat/[slug]/speak">) {
  const { slug } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifySpeakToken(slug, parsed.data.text, parsed.data.token)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const ip = clientIp(request.headers);
  const limits = await Promise.all([rateLimit(`speak:${ip}`, 40, 600), rateLimit(`speak-card:${slug}`, 600, 3600)]);
  if (!limits.every(Boolean)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    if (parsed.data.stream) return new Response(streamReplyAudio(slug, parsed.data.text, parsed.data.language ? speechLanguage(parsed.data.language) : undefined), { headers: { "content-type": "audio/l16; rate=24000; channels=1", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
    const { audio, mimeType } = await prepareReplyAudio(slug, parsed.data.text, parsed.data.language ? speechLanguage(parsed.data.language) : undefined);
    return new NextResponse(new Uint8Array(audio), { headers: { "content-type": mimeType, "cache-control": "private, max-age=3600" } });
  } catch (e) {
    console.error("Gemini speech error", e instanceof ApiError ? `${e.status} ${e.message}` : e);
    return NextResponse.json({ error: "Voice is unavailable right now." }, { status: 503 });
  }
}
