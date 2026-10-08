import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { env } from "@/lib/env";

/** The chat and website-learning model. Override with GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
/** Text-to-speech model for the AI's voice. Override with GEMINI_TTS_MODEL. */
export const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
/** Prebuilt voice name (Kore, Puck, Charon, Aoede, …). Override with GEMINI_VOICE. */
export const GEMINI_VOICE = process.env.GEMINI_VOICE || "Kore";

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
            text: "Transcribe only clear foreground speech addressed to the microphone, word for word, in the language spoken (use its normal script). Ignore background conversations, television, music, fan noise and other ambient sounds. Do not invent speech from noise. Output only the transcript. If there is no clear foreground speech, output nothing.",
          },
        ],
      },
    ],
    config: { ...LOW_THINKING, maxOutputTokens: 1024 },
  });
  return (response.text ?? "").trim().slice(0, 2000);
}

/**
 * Turns text into speech in the AI's voice. The language is detected from the text,
 * so a reply in Hindi or Spanish is spoken in Hindi or Spanish.
 */
export async function synthesize(text: string): Promise<{ audio: Buffer; mimeType: string }> {
  const input = [
    {
      type: "user_input" as const,
      content: [
        {
          type: "text" as const,
          text,
          annotations: [{ type: "speech_metadata" as const, style: "warm, friendly and natural, like a helpful receptionist" }],
        },
      ],
    },
  ];
  const request = (format: boolean) =>
    gemini().interactions.create({
      model: GEMINI_TTS_MODEL,
      input,
      // MP3 keeps files small on phone data; plain WAV is the documented default if MP3 is refused.
      response_format: format ? { type: "audio", mime_type: "audio/mp3" } : { type: "audio" },
      generation_config: { speech_config: [{ voice: GEMINI_VOICE }] },
    });
  const interaction = await request(true).catch(() => request(false));
  const out = interaction.output_audio;
  if (!out?.data) throw new Error("No audio returned.");
  const mimeType = (out.mime_type || "audio/wav").replace("audio/mp3", "audio/mpeg");
  return { audio: Buffer.from(out.data, "base64"), mimeType };
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
