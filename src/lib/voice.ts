import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Optional VOICE_SECRET; otherwise a key derived from the Supabase service key (never sent to browsers). */
function secret() {
  return process.env.VOICE_SECRET || createHash("sha256").update(`tapsync-voice:${env.supabaseServiceKey()}`).digest("hex");
}

/**
 * Proof that this exact reply came from our AI for this card, so the speak endpoint
 * only reads out real replies and can't be used as a free text-to-speech service.
 */
export function speakToken(slug: string, text: string) {
  return createHmac("sha256", secret()).update(`${slug}\n${text}`).digest("base64url");
}

export function verifySpeakToken(slug: string, text: string, token: string) {
  const expected = Buffer.from(speakToken(slug, text));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** "hi-IN" → "hi". Anything odd falls back to English. */
export function baseLanguage(lang: string | null | undefined) {
  const base = (lang ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return /^[a-z]{2,3}$/.test(base) ? base : "en";
}
