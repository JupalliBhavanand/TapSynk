import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicCard } from "@/lib/data";
import { GEMINI_TTS_MODEL, GEMINI_VOICE, synthesize, translate } from "@/lib/gemini";
import { greetingFor, introLine } from "@/lib/greeting";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { hasAi } from "@/lib/types";
import { baseLanguage } from "@/lib/voice";

export const maxDuration = 60;

const BUCKET = "ai-voice";

/**
 * The AI's opening line for this card, in the visitor's language, with a recording of it in the AI's voice.
 * Both are generated once per card, language and wording, then served from storage so the greeting plays instantly.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/chat/[slug]/greeting">) {
  const { slug } = await ctx.params;
  const found = await getPublicCard(slug);
  if (!found?.agent || !hasAi(found.subscription)) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const { card, agent } = found;
  if (!card.published) {
    const { user } = await getUser();
    if (user?.id !== card.user_id) return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const lang = baseLanguage(request.nextUrl.searchParams.get("lang"));
  const english = greetingFor({
    businessName: agent.business_name || card.company || card.full_name,
    ownerName: card.full_name,
    intro: introLine(agent.description),
    booking: agent.booking_enabled,
    voice: true,
  });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ text: english, audioUrl: null });

  const key = createHash("sha256").update([english, lang, GEMINI_TTS_MODEL, GEMINI_VOICE].join("\n")).digest("hex").slice(0, 32);
  const dir = `greetings/${card.id}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const headers = { "cache-control": "public, max-age=300" };

  // Already made: reuse it.
  try {
    const { data: files } = await storage.list(dir, { search: key });
    const audioFile = files?.find((f) => f.name.startsWith(`${key}.`) && !f.name.endsWith(".txt"));
    if (audioFile) {
      const { data: textBlob } = lang === "en" ? { data: null } : await storage.download(`${dir}/${key}.txt`);
      const text = textBlob ? await textBlob.text() : english;
      return NextResponse.json({ text, audioUrl: storage.getPublicUrl(`${dir}/${audioFile.name}`).data.publicUrl }, { headers });
    }
  } catch {}

  // New wording or language. Cap how often a card can generate, so random languages can't run up the bill.
  if (!(await rateLimit(`greeting:${card.id}`, 30, 3600))) return NextResponse.json({ text: english, audioUrl: null });
  try {
    const text = lang === "en" ? english : await translate(english, lang);
    const { audio, mimeType } = await synthesize(text);
    const ext = mimeType.includes("mpeg") ? "mp3" : mimeType.includes("ogg") ? "ogg" : "wav";
    const path = `${dir}/${key}.${ext}`;
    const uploaded = await storage.upload(path, audio, { contentType: mimeType, upsert: true });
    if (lang !== "en") await storage.upload(`${dir}/${key}.txt`, text, { contentType: "text/plain", upsert: true });
    const audioUrl = uploaded.error ? `data:${mimeType};base64,${audio.toString("base64")}` : storage.getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ text, audioUrl }, { headers });
  } catch (e) {
    console.error("Greeting voice error", e);
    return NextResponse.json({ text: english, audioUrl: null });
  }
}
