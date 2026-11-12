import "server-only";
import { gemini, GEMINI_TTS_MODEL } from "@/lib/gemini";
import { productTourChapters, productTourVersion } from "@/lib/product-tour";

export const PRODUCT_TOUR_VOICE = process.env.PRODUCT_TOUR_VOICE || "Puck";
export const PRODUCT_TOUR_STYLE = "An upbeat, charismatic professional product storyteller. Sound smiling, energetic, engaging and genuinely excited to introduce TapSynk. Use crisp diction, lively varied intonation, a brisk but easy-to-follow conversational pace, confident emphasis on benefits, and short natural pauses. Never shout, sing, or sound like a flat automated announcement. Keep the same speaker identity in every chapter. Read only the supplied transcript, exactly; pronounce TapSynk as tap sync.";
type Audio = { audio: Buffer; mimeType: string };
const owner = globalThis as typeof globalThis & { tapsynkProductTourAudio?: Map<string, Promise<Audio>> };
const cache = owner.tapsynkProductTourAudio ??= new Map<string, Promise<Audio>>();
export function cachedProductAudio(chapter: number) { return cache.get(`${productTourVersion}-${PRODUCT_TOUR_VOICE}-${GEMINI_TTS_MODEL}-${chapter}`); }
export function productTourAudio(chapter: number) {
  if (!Number.isInteger(chapter) || chapter < 0 || chapter >= productTourChapters.length) throw new Error("Unknown chapter.");
  const key = `${productTourVersion}-${PRODUCT_TOUR_VOICE}-${GEMINI_TTS_MODEL}-${chapter}`;
  const existing = cache.get(key);
  if (existing) return existing;
  while (cache.size >= 5) cache.delete(cache.keys().next().value!);
  const job = (async () => {
    const response = await gemini().interactions.create({
      model: GEMINI_TTS_MODEL,
      input: [{ type: "user_input", content: [{ type: "text", text: productTourChapters[chapter].text, annotations: [{ type: "speech_metadata", style: PRODUCT_TOUR_STYLE }] }] }],
      response_format: { type: "audio", mime_type: "audio/wav" },
      generation_config: { seed: 42, speech_config: [{ voice: PRODUCT_TOUR_VOICE }] },
    }, { timeout: 18000, maxRetries: 0 });
    const out = response.output_audio;
    if (!out?.data) throw new Error("Narration is unavailable.");
    const audio = Buffer.from(out.data, "base64");
    if (!audio.length || audio.length > 4_000_000) throw new Error("Narration exceeds the audio limit.");
    return { audio, mimeType: (out.mime_type || "audio/wav").replace("audio/mp3", "audio/mpeg") };
  })();
  cache.set(key, job);
  void job.catch(() => { if (cache.get(key) === job) cache.delete(key); });
  return job;
}
