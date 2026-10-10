import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { speechLanguage } from "@/lib/voice";
import { env } from "@/lib/env";

/** The chat and website-learning model. Override with GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
/** Text-to-speech model for the AI's voice. Override with GEMINI_TTS_MODEL. */
export const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";
/** Prebuilt voice name (Kore, Puck, Charon, Aoede, …). Override with GEMINI_VOICE. */
export const GEMINI_VOICE = process.env.GEMINI_VOICE || "Kore";
export const GEMINI_SPEECH_STYLE = "One consistent calm, friendly receptionist. Keep the same speaker identity, vocal character, middle-register pitch, comfortable volume and steady conversational pace on every turn, including greetings. Avoid dramatic pitch shifts, exaggerated excitement, whispering, singing or switching personas. Use gentle natural intonation, brief pauses and a relaxed delivery. Speak the transcript exactly, with native pronunciation and rhythm for its language; do not impose an English accent on other languages. Regional pronunciation must not change the speaker's identity or delivery style. Do not translate or add words.";

/** Fast, low-latency answers suit a phone chat. */
export const LOW_THINKING = { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };

let client: GoogleGenAI | null = null;
export function gemini() {
  client ??= new GoogleGenAI({ apiKey: env.geminiKey() });
  return client;
}

/** Audio formats the browser recorder can send. */
export const AUDIO_TYPES = ["audio/wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac"] as const;

/** Writes down exactly what the visitor said, in whatever language they spoke. */
export async function transcribe(audioBase64: string, mimeType: string) {
  const response = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          {
            text: "Transcribe only clear foreground speech addressed to the microphone, word for word, in the language spoken (use its normal script). Ignore background conversations, television, music, fan noise and other ambient sounds. Do not invent speech from noise. Never translate speech into English. Return JSON with transcript in the original spoken language and language as its BCP 47 code (for example hi, ta, es or ar). Identify the language from the audio, not device settings. For mixed speech use the dominant language. If there is no clear foreground speech, return an empty transcript and language und.",
          },
        ],
      },
    ],
    config: {
      ...LOW_THINKING, maxOutputTokens: 1024, responseMimeType: "application/json",
      responseJsonSchema: { type: "object", properties: { transcript: { type: "string" }, language: { type: "string" } }, required: ["transcript", "language"], additionalProperties: false },
    },
  });
  const result = z.object({ transcript: z.string(), language: z.string().max(35).regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i) }).parse(JSON.parse(response.text ?? "{}"));
  return { transcript: result.transcript.trim().slice(0, 2000), language: result.language === "und" ? undefined : speechLanguage(result.language) };
}

/**
 * Turns text into speech in the AI's voice. The language is detected from the text,
 * so a reply in Hindi or Spanish is spoken in Hindi or Spanish.
 */
export async function synthesize(text: string, language?: string): Promise<{ audio: Buffer; mimeType: string }> {
  const input = [
    {
      type: "user_input" as const,
      content: [
        {
          type: "text" as const,
          text,
          annotations: [{ type: "speech_metadata" as const, style: GEMINI_SPEECH_STYLE + (language ? ` When the transcript is in the language represented by ${language}, use that region's pronunciation. For other languages, use native pronunciation in the language of the transcript.` : " Detect the language from the transcript.") }],
        },
      ],
    },
  ];
  const interaction = await gemini().interactions.create({
      model: GEMINI_TTS_MODEL,
      input,
      response_format: { type: "audio", mime_type: "audio/wav" },
      generation_config: { seed: 42, speech_config: [{ voice: GEMINI_VOICE }] },
    }, { timeout: 18000, maxRetries: 0 });
  const out = interaction.output_audio;
  if (!out?.data) throw new Error("No audio returned.");
  const mimeType = (out.mime_type || "audio/wav").replace("audio/mp3", "audio/mpeg");
  return { audio: Buffer.from(out.data, "base64"), mimeType };
}

/** Generate one continuous, fixed-voice PCM stream for low-latency playback. */
export async function* streamSpeech(text: string, language?: string, signal?: AbortSignal) {
  const stream = await gemini().interactions.create({
    model: GEMINI_TTS_MODEL,
    input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: GEMINI_SPEECH_STYLE + (language ? ` Use native pronunciation for ${language} when the transcript is in that language.` : " Detect the language from the transcript.") }] }] }],
    response_format: { type: "audio", mime_type: "audio/l16", sample_rate: 24000 },
    generation_config: { seed: 42, speech_config: [{ voice: GEMINI_VOICE }] },
    stream: true,
  }, { timeout: 18000, maxRetries: 0, signal });
  for await (const event of stream) {
    if (event.event_type === "error") throw new Error("Speech generation failed.");
    if (event.event_type !== "step.delta" || event.delta.type !== "audio" || !event.delta.data) continue;
    if (event.delta.mime_type && !event.delta.mime_type.startsWith("audio/l16")) throw new Error("Unsupported streaming audio format.");
    if (event.delta.sample_rate && event.delta.sample_rate !== 24000) throw new Error("Unsupported streaming sample rate.");
    yield Buffer.from(event.delta.data, "base64");
  }
}

/** Translates short interface text (like the greeting) into the visitor's language. */
export async function translate(text: string, language: string) {
  const response = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      ...LOW_THINKING,
      maxOutputTokens: 1024,
      systemInstruction: `Translate the user's message into the language with BCP 47 code "${language}". Keep names, brands and emoji unchanged and keep the same warm tone. Output only the translation.`,
    },
  });
  return (response.text ?? "").trim() || text;
}
