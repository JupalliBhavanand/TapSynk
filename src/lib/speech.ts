"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceActivity } from "@/lib/voice-activity";
import { StreamPlayer } from "@/lib/stream-player";
import { pcmWav } from "@/lib/pcm";

/*
 * Voice for the AI chat.
 * - Speaking: replies are read aloud in the AI's Gemini voice (any language), played through one shared
 *   <audio> element unlocked by the visitor's tap. The configured voice never changes on failure.
 * - Listening: the microphone is recorded as a small WAV clip that stops by itself when the visitor
 *   pauses; Gemini writes it down in whatever language they spoke.
 */

const noop = () => () => {};
function micAvailable() {
  return Boolean(window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function" && ("AudioContext" in window || "webkitAudioContext" in window));
}

/** Whether this browser can record the microphone. False during server render. */
export function useSpeechSupport() {
  const mic = useSyncExternalStore(noop, micAvailable, () => false);
  return { mic };
}

/** Text that reads well aloud: no markdown, links, emoji or list bullets. */
export function speakable(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>~|]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Playback ----------

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
let player: HTMLAudioElement | null = null;
let unlocked = false;

function getPlayer() {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.setAttribute("playsinline", "");
  }
  return player;
}

/**
 * Call inside a tap or click. Phones (iOS especially) only let a page play sound after it has started
 * playing during a tap, so this plays a silent clip once and the AI's voice can follow on its own.
 */
export function unlockAudio() {
  const p = getPlayer();
  if (!unlocked) {
    p.src = SILENT_WAV;
    p.play().then(() => (unlocked = true)).catch(() => {});
  }
  audioContext()?.resume().catch(() => {});
}

export type Speech = { text: string; audioUrl?: string | null; token?: string; language?: string };

/** Reads replies aloud in the AI's voice. One thing speaks at a time. */
export function useSpeaker(slug: string) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const run = useRef(0);
  const urls = useRef(new Map<string, string>());
  const brokenUrls = useRef(new Set<string>());
  const pending = useRef<AbortController | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streaming = useRef<StreamPlayer | null>(null);

  useEffect(() => {
    const runs = run;
    const made = urls.current;
    return () => {
      runs.current++;
      pending.current?.abort();
      streaming.current?.stop();
      if (watchdog.current) clearTimeout(watchdog.current);
      player?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      made.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u));
    };
  }, []);

  const stop = useCallback(() => {
    run.current++;
    pending.current?.abort();
    streaming.current?.stop();
    if (watchdog.current) clearTimeout(watchdog.current);
    player?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
    setPreparing(false);
    setVoiceError(null);
  }, []);

  /** Speaks a message; `onDone` runs once when it finishes (not when stopped). */
  const speak = useCallback(
    async (id: string, speech: Speech, onDone?: (success: boolean) => void) => {
      const me = ++run.current;
      pending.current?.abort();
      streaming.current?.stop();
      if (watchdog.current) clearTimeout(watchdog.current);
      player?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setSpeakingId(id);
      setPreparing(true);
      setVoiceError(null);
      let finished = false;
      const finish = (success = true) => {
        if (finished || run.current !== me) return;
        finished = true;
        if (watchdog.current) clearTimeout(watchdog.current);
        player?.pause();
        streaming.current?.stop();
        setSpeakingId(null);
        setPreparing(false);
        onDone?.(success);
      };
      const fail = (message: string) => {
        if (finished || run.current !== me) return;
        setVoiceError(message);
        finish(false);
      };

      let url = (speech.audioUrl && !brokenUrls.current.has(speech.audioUrl) ? speech.audioUrl : undefined) || urls.current.get(id);
      if (!url && speech.token) {
        const controller = new AbortController();
        pending.current = controller;
        // Do not leave a phone waiting indefinitely for a separate TTS request.
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const res = await fetch(`/api/chat/${slug}/speak`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: speech.text, token: speech.token, language: speech.language, stream: true }),
            signal: controller.signal,
          });
          if (res.ok) {
            if (res.headers?.get("content-type")?.startsWith("audio/l16") && res.body) {
              const ac = audioContext();
              if (!ac) throw new Error("Audio playback is unavailable.");
              await ac.resume();
              if (ac.state !== "running") throw new Error("Tap Listen to enable audio.");
              const arm = () => {
                if (run.current !== me || finished) return;
                setPreparing(false);
                if (watchdog.current) clearTimeout(watchdog.current);
                watchdog.current = setTimeout(() => fail("Audio playback stopped responding. Tap Listen to retry."), 15000);
              };
              const output = new StreamPlayer(ac, () => finish(), arm);
              streaming.current = output;
              const reader = res.body.getReader();
              const chunks: Uint8Array[] = [];
              let bytes = 0;
              try {
                while (true) {
                  const chunk = await reader.read();
                  if (run.current !== me) { await reader.cancel(); return; }
                  if (chunk.done) break;
                  bytes += chunk.value.length;
                  if (bytes <= 2_000_000) chunks.push(chunk.value);
                  output.push(chunk.value);
                }
                if (bytes <= 2_000_000) urls.current.set(id, URL.createObjectURL(new Blob([pcmWav(chunks).buffer as ArrayBuffer], { type: "audio/wav" })));
                output.end();
                return;
              } catch {
                output.stop();
                return fail("Audio was interrupted. Tap Listen to retry; your reply is available as text.");
              } finally { reader.releaseLock(); }
            }
            url = URL.createObjectURL(await res.blob());
            urls.current.set(id, url);
          }
        } catch {} finally {
          clearTimeout(timeout);
          if (pending.current === controller) pending.current = null;
        }
      }
      if (run.current !== me) return;
      if (!url) return fail("The AI voice could not load. Tap Listen to retry; your reply is still available as text.");

      const p = getPlayer();
      p.onended = () => finish();
      p.onerror = () => {
        if (speech.audioUrl) brokenUrls.current.add(speech.audioUrl);
        urls.current.delete(id);
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        fail("Audio could not play. Tap Listen to retry.");
      };
      const arm = () => {
        if (run.current !== me || finished) return;
        if (watchdog.current) clearTimeout(watchdog.current);
        watchdog.current = setTimeout(() => fail("Audio playback stopped responding. Tap Listen to retry."), 15000);
      };
      let position = 0;
      p.ontimeupdate = () => {
        if (p.currentTime > position + 0.01) { position = p.currentTime; arm(); }
      };
      p.onplaying = () => {
        if (run.current !== me || finished) return;
        setPreparing(false);
        arm();
      };
      p.src = url;
      arm();
      p.play().catch((e: unknown) => {
        if (run.current !== me) return;
        if (e instanceof DOMException && e.name === "NotAllowedError") fail("Tap Listen to allow audio playback on this phone.");
        else fail("Audio could not start. Tap Listen to retry.");
      });
    },
    [slug],
  );

  return { speak, stop, speakingId, preparing, voiceError };
}

// ---------- The AI's greeting ----------

export type Greeting = { text: string; audioUrl: string | null; token?: string; language?: string };
const greetings = new Map<string, Promise<Greeting | null>>();

/**
 * Fetches the AI's greeting (in the visitor's language) and downloads its audio ahead of time,
 * so it can play the instant the chat opens. Safe to call many times.
 */
export function loadGreeting(slug: string, fresh = false): Promise<Greeting | null> {
  const lang = navigator.language || "en";
  const key = `${slug}:${lang}`;
  const cached = greetings.get(key);
  if (cached && !fresh) return cached;
  const promise = fetch(`/api/chat/${slug}/greeting?lang=${encodeURIComponent(lang)}`, { signal: AbortSignal.timeout(20000) })
    .then((r) => (r.ok ? (r.json() as Promise<Greeting>) : null))
    .then(async (g) => {
      if (!g?.text) return null;
      if (g.audioUrl && !g.audioUrl.startsWith("data:")) {
        try {
          const res = await fetch(g.audioUrl, { signal: AbortSignal.timeout(10000) });
          if (res.ok) g.audioUrl = URL.createObjectURL(await res.blob());
        } catch {}
      }
      return g;
    })
    .catch(() => null)
    .then((g) => { if (!g?.audioUrl) greetings.delete(key); return g; });
  greetings.set(key, promise);
  return promise;
}

// ---------- Listening ----------

let ctx: AudioContext | null = null;
function audioContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export type Recording = { data: string; mimeType: "audio/wav" };
export type ListenError = "denied" | "unavailable";

const TARGET_RATE = 16000;
const MAX_MS = 30000;
const NO_SPEECH_MS = 8000;

/** Records one spoken message. It stops by itself when the visitor pauses, or when `stop()` is called. */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const active = useRef<{ finish: (send: boolean) => void } | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const noiseFloor = useRef<number | undefined>(undefined);
  const releaseMicrophone = useCallback(() => {
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    noiseFloor.current = undefined;
  }, []);

  useEffect(() => () => { active.current?.finish(false); releaseMicrophone(); }, [releaseMicrophone]);

  const stop = useCallback(() => active.current?.finish(true), []);
  const cancel = useCallback(() => { active.current?.finish(false); releaseMicrophone(); }, [releaseMicrophone]);

  const start = useCallback(async (handlers: { onDone: (clip: Recording | null) => void; onError?: (e: ListenError) => void; continuous?: boolean }) => {
    active.current?.finish(false);
    const ac = audioContext();
    if (!ac || !navigator.mediaDevices?.getUserMedia) return handlers.onError?.("unavailable");
    // Resume inside the tap, before any await, or phones keep the audio engine paused.
    const resumed = ac.resume().catch(() => {});
    const session: { finish: (send: boolean) => void } = { finish: () => {
      if (active.current === session) {
        active.current = null;
        setRecording(false);
      }
    } };
    active.current = session;
    setRecording(true);

    let stream: MediaStream;
    let reused = false;
    try {
      const ready = microphone.current;
      reused = Boolean(ready?.getAudioTracks().some((track) => track.readyState === "live"));
      stream = reused ? ready! : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
      await resumed;
    } catch (e) {
      if (active.current !== session) return;
      active.current = null;
      setRecording(false);
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      return handlers.onError?.(denied ? "denied" : "unavailable");
    }
    if (active.current !== session) {
      if (!reused) stream.getTracks().forEach((t) => t.stop());
      return;
    }
    microphone.current = stream;

    const source = ac.createMediaStreamSource(stream);
    const highpass = ac.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 120;
    const lowpass = ac.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 3800;
    const processor = ac.createScriptProcessor(1024, 1, 1);
    const chunks: Float32Array[] = [];
    const started = performance.now();
    const activity = new VoiceActivity(reused ? noiseFloor.current : undefined);
    let done = false;

    session.finish = (send: boolean) => {
      if (done) return;
      done = true;
      processor.onaudioprocess = null;
      try {
        source.disconnect();
        highpass.disconnect();
        lowpass.disconnect();
        processor.disconnect();
      } catch {}
      // Keep the device ready during calls, but disconnect recording before AI playback.
      noiseFloor.current = activity.noiseFloor;
      if (!handlers.continuous) releaseMicrophone();
      if (active.current === session) active.current = null;
      setRecording(false);
      setLevel(0);
      // Neither a manual stop nor a timeout may submit a noise-only clip.
      if (!send) return;
      if (!activity.heard || !chunks.length) return handlers.onDone(null);
      const samples = merge(chunks);
      const from = Math.max(0, Math.floor(((activity.firstVoiceMs ?? 0) - 300) * ac.sampleRate / 1000));
      const to = Math.min(samples.length, Math.ceil((activity.lastVoiceMs + 200) * ac.sampleRate / 1000));
      handlers.onDone({ data: toBase64(encodeWav(downsample(samples.subarray(from, to), ac.sampleRate, TARGET_RATE), TARGET_RATE)), mimeType: "audio/wav" });
    };

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
      const rms = Math.sqrt(sum / input.length);
      const now = performance.now();
      const elapsed = now - started;
      const voiced = activity.update(rms, elapsed, input.length / ac.sampleRate * 1000);
      setLevel(voiced ? Math.min(1, rms * 9) : 0);
      if ((activity.heard && elapsed - activity.lastVoiceMs > activity.pauseMs) || elapsed > MAX_MS) session.finish(true);
      else if (!activity.heard && elapsed > NO_SPEECH_MS) session.finish(true);
    };
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(processor);
    processor.connect(ac.destination);
  }, [releaseMicrophone]);

  return { start, stop, cancel, recording, level };
}

function merge(chunks: Float32Array[]) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function downsample(input: Float32Array, from: number, to: number) {
  if (from <= to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // Average the samples each output sample covers (a simple low-pass).
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
