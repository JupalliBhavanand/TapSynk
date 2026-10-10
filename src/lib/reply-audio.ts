import "server-only";
import { GEMINI_SPEECH_STYLE, GEMINI_TTS_MODEL, GEMINI_VOICE, streamSpeech } from "@/lib/gemini";
import { pcmWav } from "@/lib/pcm";
type Audio = { audio: Buffer; mimeType: string };
type Job = { expires: number; chunks: Uint8Array[]; readers: Set<ReadableStreamDefaultController<Uint8Array>>; done: Promise<Audio>; completed: boolean; error?: unknown; abort: AbortController };
const owner = globalThis as typeof globalThis & { tapSynkStreamingAudio?: Map<string, Job> };
const jobs = owner.tapSynkStreamingAudio ??= new Map<string, Job>();
function prepare(slug: string, text: string, language?: string) {
  const now = Date.now();
  for (const [key, job] of jobs) if (job.expires <= now) jobs.delete(key);
  const key = JSON.stringify([slug, text, language, GEMINI_TTS_MODEL, GEMINI_VOICE, GEMINI_SPEECH_STYLE]);
  const existing = jobs.get(key);
  if (existing) return existing;
  while (jobs.size >= 16) jobs.delete(jobs.keys().next().value!);
  let resolve!: (audio: Audio) => void;
  let reject!: (error: unknown) => void;
  const job: Job = { expires: now + 120000, chunks: [], readers: new Set(), completed: false, abort: new AbortController(), done: new Promise((ok, fail) => { resolve = ok; reject = fail; }) };
  void job.done.catch(() => {});
  jobs.set(key, job);
  void (async () => {
    try {
      let bytes = 0;
      for await (const chunk of streamSpeech(text, language, job.abort.signal)) {
        bytes += chunk.length;
        if (bytes > 4_000_000) throw new Error("Voice reply is too long.");
        job.chunks.push(chunk);
        for (const reader of job.readers) reader.enqueue(chunk);
      }
      if (!bytes) throw new Error("No speech was returned.");
      const audio = { audio: Buffer.from(pcmWav(job.chunks)), mimeType: "audio/wav" };
      job.completed = true;
      for (const reader of job.readers) reader.close();
      job.readers.clear();
      if (bytes > 2_000_000 && jobs.get(key) === job) jobs.delete(key);
      resolve(audio);
    } catch (error) {
      job.error = error;
      for (const reader of job.readers) reader.error(error);
      job.readers.clear();
      if (jobs.get(key) === job) jobs.delete(key);
      reject(error);
    }
  })();
  return job;
}
export function prepareReplyAudio(slug: string, text: string, language?: string) { return prepare(slug, text, language).done; }
export function streamReplyAudio(slug: string, text: string, language?: string) {
  const job = prepare(slug, text, language);
  let reader: ReadableStreamDefaultController<Uint8Array>;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      reader = controller;
      for (const chunk of job.chunks) controller.enqueue(chunk);
      if (job.error) controller.error(job.error);
      else if (job.completed) controller.close();
      else job.readers.add(controller);
    },
    cancel() {
      job.readers.delete(reader);
      if (!job.readers.size && !job.completed) job.abort.abort();
    },
  });
}
