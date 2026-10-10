import { ApiError } from "@google/genai";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { chatHistorySchema, chatMessageSchema, runAgent } from "@/lib/agent";
import { getPublicCard } from "@/lib/data";
import { AUDIO_TYPES, transcribe } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";
import { parseSource } from "@/lib/source";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { hasAi } from "@/lib/types";
import { clientIp } from "@/lib/utils";
import { speakToken } from "@/lib/voice";
import { sendAppointmentConfirmation, type Confirmation } from "@/lib/appointment-mail";
import { canBookAppointment } from "@/lib/booking-quota";
import { prepareReplyAudio } from "@/lib/reply-audio";

export const maxDuration = 60;

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).max(30),
  // A spoken message: a short recording (about 30 seconds at most) that Gemini writes down in any language.
  audio: z.object({ data: z.string().min(100).max(3_000_000), mimeType: z.enum(AUDIO_TYPES) }).optional(),
  preview: z.boolean().optional(),
  source: z.string().max(8).optional(),
  stream: z.boolean().optional(),
  voice: z.boolean().optional(),
});

export async function POST(request: NextRequest, ctx: RouteContext<"/api/chat/[slug]">) {
  const { slug } = await ctx.params;
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

  const found = await getPublicCard(slug);
  if (!found?.agent) return NextResponse.json({ error: "This assistant isn't available." }, { status: 404 });
  const { card, agent, subscription } = found;

  // Owners can test their own agent from the dashboard before going live.
  let isOwner = false;
  if (body.data.preview) {
    const { user } = await getUser();
    isOwner = user?.id === card.user_id;
  }
  // The AI is locked to AI plans, for visitors and for the owner's own test chat alike.
  if (!hasAi(subscription)) {
    return NextResponse.json({ error: isOwner ? "The AI agent is part of the AI Card plan. Switch plans to use it." : "This assistant isn't available." }, { status: isOwner ? 403 : 404 });
  }
  if (!isOwner && !card.published) {
    return NextResponse.json({ error: "This assistant isn't available." }, { status: 404 });
  }

  const ip = clientIp(request.headers);
  const limits = await Promise.all([rateLimit(`chat:${ip}`, 30, 600), rateLimit(`chat-card:${card.id}`, 600, 3600)]);
  if (!limits.every(Boolean)) return NextResponse.json({ error: "You're sending messages quickly. Please wait a moment." }, { status: 429 });

  try {
    let transcript: string | undefined;
    let language: string | undefined;
    let history = body.data.messages;
    if (body.data.audio) {
      ({ transcript, language } = await transcribe(body.data.audio.data, body.data.audio.mimeType));
      if (!transcript) return NextResponse.json({ transcript: "" });
      history = [...history, { role: "user" as const, content: transcript.slice(0, 2000) }].slice(-30);
      while (history[0]?.role === "assistant") history = history.slice(1);
    }
    const valid = chatHistorySchema.safeParse(history);
    if (!valid.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

    if (!isOwner && valid.data.length === 1) {
      after(async () => {
        await createAdminClient().rpc("bump_card_stat", { p_slug: slug, p_kind: "ai", p_source: parseSource(body.data.source) });
      });
    }

    const confirmations: Confirmation[] = [];
    let voicePreparation: Promise<unknown> | undefined;
    after(async () => {
      await Promise.allSettled([
        ...(voicePreparation ? [voicePreparation] : []),
        ...confirmations.map((booking) => sendAppointmentConfirmation(booking)),
      ]);
    });
    const prepareVoice = (reply: string) => {
      if (body.data.voice) voicePreparation = prepareReplyAudio(slug, reply, language).catch(() => {
        // Text remains usable, and Listen can retry failed voice generation.
      });
    };
    const agentOptions = {
      card,
      agent,
      history: valid.data,
      replyLanguage: language,
      onBooked: (booking: Confirmation) => { confirmations.push(booking); },
      canBook: (email: string) => isOwner ? Promise.resolve(true) : canBookAppointment(card.id, email),
    };
    if (body.data.stream) {
      const generation = new AbortController();
      const encoder = new TextEncoder();
      let canceled = false;
      const stream = new ReadableStream({
        start(controller) {
          const emit = (event: object) => {
            if (!canceled) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          };
          emit({ type: "transcript", transcript, language });
          void runAgent({ ...agentOptions, signal: generation.signal, onText: (text, reset) => emit({ type: "text", text, reset: Boolean(reset) }) })
            .then((result) => {
              if (!canceled) prepareVoice(result.reply);
              emit({ type: "done", ...result, transcript, language, speakToken: speakToken(slug, result.reply) });
            })
            .catch((e: unknown) => {
              console.error("Streaming chat error", e);
              emit({ type: "error", error: "The assistant is unavailable right now. Please try again." });
            })
            .finally(() => { if (!canceled) controller.close(); });
        },
        cancel() { canceled = true; generation.abort(); },
      });
      return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
    }
    const result = await runAgent(agentOptions);
    prepareVoice(result.reply);
    return NextResponse.json({ ...result, transcript, language, speakToken: speakToken(slug, result.reply) });
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return NextResponse.json({ error: "The assistant is busy. Please try again in a moment." }, { status: 503 });
    if (e instanceof ApiError) console.error("Gemini API error", e.status, e.message);
    else console.error("Chat error", e);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 500 });
  }
}
