"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, AudioLines, Bot, CalendarCheck, Languages, Mic, PhoneOff, Square, Volume2, VolumeX, X } from "lucide-react";
import { greetingFor } from "@/lib/greeting";
import { loadGreeting, unlockAudio, useRecorder, useSpeaker, useSpeechSupport, type Greeting, type ListenError, type Recording } from "@/lib/speech";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; content: string; token?: string; pending?: boolean };
type CallState = "listening" | "thinking" | "speaking" | "idle";

const GREETING_ID = "greeting";
let nextId = 0;
const uid = () => `m${++nextId}`;

// The visitor's "read replies aloud" choice, remembered on this device.
const VOICE_KEY = "tapsync-voice";
const voiceListeners = new Set<() => void>();
const voicePref = {
  subscribe(fn: () => void) {
    voiceListeners.add(fn);
    return () => voiceListeners.delete(fn);
  },
  get() {
    try {
      return localStorage.getItem(VOICE_KEY) !== "off";
    } catch {
      return true;
    }
  },
  set(on: boolean) {
    try {
      localStorage.setItem(VOICE_KEY, on ? "on" : "off");
    } catch {}
    voiceListeners.forEach((fn) => fn());
  },
};

const MIC_ERRORS: Record<ListenError, string> = {
  denied: "Allow microphone access in your browser to talk to the AI.",
  unavailable: "Voice isn't available on this device right now. You can still type.",
};
const NOT_HEARD = "I didn't catch that. Tap the mic and try again.";

export function ChatPanel({
  slug,
  businessName,
  ownerName,
  intro = "",
  booking = true,
  logoUrl,
  preview = false,
  source,
  onClose,
  className = "",
}: {
  slug: string;
  businessName: string;
  ownerName: string;
  /** A sentence or two about the business, used in the AI's opening greeting. */
  intro?: string;
  booking?: boolean;
  logoUrl?: string;
  preview?: boolean;
  /** How the visitor arrived (tap, qr or link), for analytics. */
  source?: string;
  onClose?: () => void;
  className?: string;
}) {
  const support = useSpeechSupport();
  const voiceOn = useSyncExternalStore(voicePref.subscribe, voicePref.get, () => true);
  const { speak, stop: stopSpeaking, speakingId } = useSpeaker(slug);
  const recorder = useRecorder();
  const { recording, level } = recorder;

  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const [call, setCall] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [heard, setHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [callError, setCallError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const callRef = useRef(false);
  const voiceOnRef = useRef(voiceOn);
  const busyRef = useRef(false);
  const askRef = useRef<(q: { text?: string; audio?: Recording }) => Promise<void>>(async () => {});
  const fallbackGreeting = greetingFor({ businessName, ownerName, intro, booking, voice: true });
  const fallbackRef = useRef(fallbackGreeting);
  useEffect(() => {
    messagesRef.current = messages;
    voiceOnRef.current = voiceOn;
    fallbackRef.current = fallbackGreeting;
  });

  const scrollDown = useCallback(() => {
    // Do not return the browser's scroll result as an effect cleanup value.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);
  useEffect(scrollDown, [messages, busy, greeting, booked, scrollDown]);

  // The AI opens the conversation: it says hello out loud, in the visitor's language, the moment the chat opens.
  useEffect(() => {
    let live = true;
    const started = Date.now();
    const slow = new Promise<null>((r) => setTimeout(() => r(null), 3000));
    void Promise.race([loadGreeting(slug, preview), slow]).then((g) => {
      // A short "typing" beat feels natural; a cached greeting is usually ready well before it ends.
      setTimeout(() => {
        if (!live) return;
        const ready = g ?? { text: fallbackRef.current, audioUrl: null };
        setGreeting(ready);
        setAnimatingId(GREETING_ID);
        // A dashboard preview opens without a tap, and browsers block sound until the visitor interacts.
        if (!preview && voiceOnRef.current) void speak(GREETING_ID, ready);
      }, Math.max(0, 450 - (Date.now() - started)));
    });
    return () => {
      live = false;
    };
  }, [slug, preview, speak]);

  const listenInCall = useCallback(() => {
    setCallError(null);
    setCallState("listening");
    void recorder.start({
      onDone: (clip) => {
        if (!callRef.current) return;
        if (!clip) {
          setCallState("idle");
          setCallError("I didn't hear anything. Tap the circle when you're ready to talk.");
          return;
        }
        setCallState("thinking");
        void askRef.current({ audio: clip });
      },
      onError: (e) => {
        setCallState("idle");
        setCallError(MIC_ERRORS[e]);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.start]);

  /** Sends a typed message, or a recording that Gemini writes down first (any language). */
  async function ask({ text, audio }: { text?: string; audio?: Recording }) {
    const content = text?.trim().slice(0, 2000) ?? "";
    if ((!content && !audio) || busyRef.current) return;
    stopSpeaking();
    const userMsg: Msg = { id: uid(), role: "user", content, pending: Boolean(audio) };
    const prior = messagesRef.current.filter((m) => !m.pending);
    // The API needs the conversation to start with the visitor, so drop any reply cut off by the 30-message window.
    const history = [...prior, ...(audio ? [] : [userMsg])].map(({ role, content }) => ({ role, content })).slice(audio ? -29 : -30);
    while (history[0]?.role === "assistant") history.shift();

    setMessages([...prior, userMsg]);
    setInput("");
    setBusy(true);
    busyRef.current = true;
    setError(null);
    try {
      const res = await fetch(`/api/chat/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, audio, preview, source }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      if (audio && !json.transcript) {
        setMessages((m) => m.filter((x) => x.id !== userMsg.id));
        if (callRef.current) {
          setCallState("idle");
          setCallError(NOT_HEARD);
        } else setError(NOT_HEARD);
        return;
      }
      if (audio) {
        setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, content: json.transcript, pending: false } : x)));
        setHeard(json.transcript);
      }
      const reply = String(json.reply ?? "").trim() || "Sorry, I didn't quite get that. Could you say it another way?";
      const id = uid();
      const speech = { text: reply, token: typeof json.speakToken === "string" ? json.speakToken : undefined };
      setMessages((m) => [...m, { id, role: "assistant", content: reply, token: speech.token }]);
      setAnimatingId(id);
      if (json.booked) setBooked(true);
      if (callRef.current) {
        setLastReply(reply);
        setCallState("speaking");
        void speak(id, speech, () => {
          if (callRef.current) listenInCall();
        });
      } else if (voiceOnRef.current) {
        void speak(id, speech);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      if (callRef.current) {
        setCallState("idle");
        setCallError(message);
      } else {
        setError(message);
        if (content) setInput(content);
      }
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  useEffect(() => {
    askRef.current = ask;
  });

  function toggleMic() {
    if (recording) return recorder.stop();
    unlockAudio();
    stopSpeaking();
    setError(null);
    void recorder.start({
      onDone: (clip) => (clip ? void ask({ audio: clip }) : setError("I didn't hear anything. Tap the mic and speak, in any language.")),
      onError: (e) => setError(MIC_ERRORS[e]),
    });
  }

  function startCall() {
    unlockAudio();
    recorder.cancel();
    stopSpeaking();
    setLastReply("");
    setHeard("");
    callRef.current = true;
    setCall(true);
    listenInCall();
  }

  function endCall() {
    callRef.current = false;
    setCall(false);
    recorder.cancel();
    stopSpeaking();
    setCallState("idle");
  }

  function tapOrb() {
    if (callState === "listening") recorder.stop();
    else if (callState === "speaking") {
      stopSpeaking();
      listenInCall();
    } else if (callState === "idle") listenInCall();
  }

  function toggleVoice() {
    unlockAudio();
    if (voiceOn) stopSpeaking();
    voicePref.set(!voiceOn);
  }

  const say = (id: string, speech: { text: string; audioUrl?: string | null; token?: string }) => {
    unlockAudio();
    if (speakingId === id) stopSpeaking();
    else void speak(id, speech);
  };

  const hasUserMessage = messages.some((m) => m.role === "user");
  const greetingDone = greeting && animatingId !== GREETING_ID;
  const suggestions = ["What do you offer?", "How much does it cost?", ...(booking ? ["Book an appointment"] : [])];
  const status = recording ? "Listening…" : speakingId ? "Speaking…" : busy ? "Thinking…" : preview ? "Preview · only you can see this" : "Online · any language";

  return (
    <div className={cn("relative flex flex-col overflow-hidden bg-white", className)}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <div className={cn("ai-avatar relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-2 to-brand text-white", speakingId && "is-speaking")}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full rounded-2xl bg-white object-contain p-1" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{businessName} AI</p>
          <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
            {speakingId ? <VoiceBars className="h-3 text-brand" /> : !busy && !recording && !preview && <Languages className="h-3 w-3" />}
            {status}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleVoice}
          className={cn("grid h-9 w-9 place-items-center rounded-full transition", voiceOn ? "bg-brand-soft text-brand" : "bg-bg text-muted hover:text-ink")}
          aria-pressed={voiceOn}
          aria-label={voiceOn ? "Mute AI voice" : "Read replies aloud"}
          title={voiceOn ? "Voice on" : "Voice off"}
        >
          {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        {support.mic && (
          <button type="button" onClick={startCall} className="grid h-9 w-9 place-items-center rounded-full bg-navy text-white transition hover:bg-brand" aria-label="Start a voice chat" title="Voice chat">
            <AudioLines className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-bg text-muted hover:text-ink" aria-label="Close chat">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-bg/60 px-4 py-5" aria-live="polite">
        {!greeting ? (
          <TypingDots />
        ) : (
          <Bubble
            role="assistant"
            text={greeting.text}
            animate={animatingId === GREETING_ID}
            onProgress={scrollDown}
            onDone={() => setAnimatingId((id) => (id === GREETING_ID ? null : id))}
            speaking={speakingId === GREETING_ID}
            onSpeak={() => say(GREETING_ID, greeting)}
          />
        )}
        {messages.map((m) => (
          <Bubble
            key={m.pending ? `${m.id}-voice` : m.id}
            role={m.role}
            text={m.content}
            pending={m.pending}
            animate={animatingId === m.id}
            onProgress={scrollDown}
            onDone={() => setAnimatingId((id) => (id === m.id ? null : id))}
            speaking={speakingId === m.id}
            onSpeak={m.role === "assistant" ? () => say(m.id, { text: m.content, token: m.token }) : undefined}
          />
        ))}
        {busy && <TypingDots />}
        {booked && (
          <div className="fade-up flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
            <CalendarCheck className="h-4 w-4" /> Appointment confirmed
          </div>
        )}
        {greetingDone && !hasUserMessage && !busy && (
          <div className="fade-up flex flex-wrap gap-2 pt-1">
            {support.mic && (
              <button type="button" onClick={startCall} className="flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand">
                <Mic className="h-3.5 w-3.5" /> Talk to me
              </button>
            )}
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => ask({ text: s })} className="rounded-full border border-brand/25 bg-white px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand-soft">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p role="alert" className="border-t border-line bg-stamp/5 px-5 py-2 text-sm text-stamp">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask({ text: input });
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        {support.mic && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy && !recording}
            className={cn("relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition disabled:opacity-50", recording ? "mic-live bg-stamp text-white" : "bg-bg text-ink-2 hover:text-brand")}
            aria-pressed={recording}
            aria-label={recording ? "Done talking, send" : "Speak your message"}
          >
            {recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
        <label htmlFor={`chat-${slug}`} className="sr-only">Message</label>
        {recording ? (
          <div className="flex min-h-[44px] flex-1 items-center gap-3 rounded-xl border border-stamp/30 bg-stamp/5 px-3.5 text-sm font-medium text-stamp">
            <LevelMeter level={level} />
            Listening… tap ■ to send
          </div>
        ) : (
          <textarea
            id={`chat-${slug}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask({ text: input });
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask me anything…"
            className="input max-h-32 min-h-[44px] flex-1 resize-none"
          />
        )}
        <button type="submit" disabled={busy || recording || !input.trim()} className="btn btn-primary h-11 w-11 shrink-0 p-0" aria-label="Send">
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
      <p className="pb-2 text-center text-[10px] text-muted">AI answers may be imperfect. Powered by TapSynk.</p>

      {call && (
        <div className="call-in absolute inset-0 z-20 flex flex-col items-center justify-between bg-[radial-gradient(120%_80%_at_50%_0%,#1d5bff_0%,#121a36_55%,#0b0f1d_100%)] px-6 pb-8 pt-10 text-white" role="dialog" aria-label="Voice chat">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Voice chat · any language</p>
            <p className="mt-1 text-lg font-bold">{businessName} AI</p>
          </div>

          <div className="flex w-full flex-col items-center">
            <button
              type="button"
              onClick={tapOrb}
              className={cn("voice-orb", `is-${callState}`)}
              style={{ "--level": callState === "listening" ? level : 0 } as React.CSSProperties}
              aria-label={callState === "listening" ? "Done talking" : callState === "speaking" ? "Interrupt and talk" : "Tap to talk"}
            >
              <span className="voice-orb-core">
                {callState === "speaking" ? <VoiceBars className="h-9 text-white" /> : callState === "thinking" ? <TypingDots bare /> : <Mic className="h-10 w-10" />}
              </span>
            </button>
            <p className="mt-8 text-sm font-semibold text-white/70" aria-live="polite">
              {callState === "listening" ? "Listening… just pause when you're done" : callState === "thinking" ? "Thinking…" : callState === "speaking" ? "Speaking · tap to interrupt" : "Tap the circle to talk"}
            </p>
            {heard && callState !== "listening" && <p className="mt-3 line-clamp-2 max-w-full text-center text-sm text-white/55">“{heard}”</p>}
            <p className="mt-3 max-h-36 w-full overflow-y-auto text-center text-[17px] leading-relaxed text-white">
              {callState === "speaking" ? lastReply : callState === "idle" ? callError ?? (lastReply || "Ask me anything, out loud, in any language.") : callState === "listening" ? "Go ahead, I'm listening." : ""}
            </p>
          </div>

          <button type="button" onClick={endCall} className="flex items-center gap-2 rounded-full bg-stamp px-6 py-3 font-semibold text-white shadow-lg transition hover:brightness-110">
            <PhoneOff className="h-5 w-5" /> End voice chat
          </button>
        </div>
      )}
    </div>
  );
}

function LevelMeter({ level }: { level: number }) {
  return (
    <span className="flex h-5 items-center gap-[3px]" aria-hidden="true">
      {[0.5, 0.8, 1, 0.8, 0.5].map((k, i) => (
        <span key={i} className="w-[3px] rounded-full bg-current transition-[height] duration-75" style={{ height: `${Math.max(15, Math.min(100, level * k * 140))}%` }} />
      ))}
    </span>
  );
}

function TypingDots({ bare = false }: { bare?: boolean }) {
  return (
    <div className={cn("typing flex w-fit gap-1", !bare && "rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm")} aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("h-2 w-2 rounded-full", bare ? "bg-white" : "bg-muted")} />
      ))}
    </div>
  );
}

function VoiceBars({ className = "" }: { className?: string }) {
  return (
    <span className={cn("voice-bars inline-flex items-center gap-[3px]", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-full w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A chat bubble; new AI replies appear word by word, like they're being written. */
function Bubble({
  role,
  text,
  pending = false,
  animate,
  onProgress,
  onDone,
  speaking,
  onSpeak,
}: {
  role: Msg["role"];
  text: string;
  /** A voice message still being written down. */
  pending?: boolean;
  animate: boolean;
  onProgress: () => void;
  onDone: () => void;
  speaking: boolean;
  onSpeak?: () => void;
}) {
  const words = text.split(/(\s+)/);
  const [shown, setShown] = useState(animate && !reducedMotion() ? 0 : words.length);
  const done = shown >= words.length;

  useEffect(() => {
    if (!animate) return;
    if (reducedMotion()) {
      const t = setTimeout(onDone, 0);
      return () => clearTimeout(t);
    }
    let n = 0;
    const timer = setInterval(() => {
      n += 2; // a word and the space after it
      setShown(n);
      onProgress();
      if (n >= words.length) {
        clearInterval(timer);
        onDone();
      }
    }, 38);
    return () => clearInterval(timer);
    // Runs once per bubble: the text of a message never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const visible = done ? text : words.slice(0, shown).join("");

  if (pending) {
    return (
      <div className="fade-up flex flex-col items-end">
        <p className="flex items-center gap-2 rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] text-white/90">
          <Mic className="h-4 w-4" /> <VoiceBars className="h-3.5" /> Voice message
        </p>
      </div>
    );
  }

  return (
    <div className={cn("fade-up flex flex-col", role === "user" ? "items-end" : "items-start")}>
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed",
          role === "user" ? "rounded-2xl rounded-br-md bg-brand text-white" : "rounded-2xl rounded-bl-md bg-white text-ink shadow-sm",
          speaking && "ring-2 ring-brand/30",
        )}
      >
        {visible}
        {!done && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-brand" aria-hidden="true" />}
      </p>
      {onSpeak && done && (
        <button type="button" onClick={onSpeak} className="mt-1 flex items-center gap-1 px-1 text-xs font-medium text-muted transition hover:text-brand">
          {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
          {speaking ? "Stop" : "Listen"}
        </button>
      )}
    </div>
  );
}
