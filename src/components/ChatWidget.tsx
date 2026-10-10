"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, AudioLines, Bot, CalendarCheck, Languages, Mic, PhoneOff, Square, Volume2, VolumeX, X } from "lucide-react";
import { greetingFor } from "@/lib/greeting";
import { loadGreeting, unlockAudio, useRecorder, useSpeaker, useSpeechSupport, type Greeting, type ListenError, type Recording } from "@/lib/speech";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: "user" | "assistant"; content: string; token?: string; language?: string; pending?: boolean; streaming?: boolean };
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
  const { speak, stop: stopSpeaking, speakingId, preparing, voiceError } = useSpeaker(slug);
  const recorder = useRecorder();
  const { recording, level } = recorder;

  const [greeting, setGreeting] = useState<Greeting | null>(() => ({ text: greetingFor({ businessName, ownerName, intro, booking, voice: true }), audioUrl: null }));
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
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "44px";
    field.style.height = `${Math.min(128, Math.max(44, field.scrollHeight))}px`;
  }, [input]);
  const messagesRef = useRef<Msg[]>([]);
  const callRef = useRef(false);
  const lastSpeechRef = useRef<{ id: string; speech: { text: string; token?: string; language?: string } } | null>(null);
  const voiceOnRef = useRef(voiceOn);
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    callRef.current = false;
    requestRef.current?.abort();
  }, []);
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
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);
  useEffect(scrollDown, [messages, busy, greeting, booked, scrollDown]);

  // The AI opens the conversation: it says hello out loud, in the visitor's language, the moment the chat opens.
  useEffect(() => {
    let live = true;
    void loadGreeting(slug, preview).then((g) => {
        if (!live || busyRef.current || messagesRef.current.length) return;
        // An unsaved editor name must not be replaced by the stored greeting.
        if (preview && g?.text !== fallbackRef.current) return;
        const ready = g ?? { text: fallbackRef.current, audioUrl: null };
        setGreeting(ready);
        // A dashboard preview opens without a tap, and browsers block sound until the visitor interacts.
        if (!preview && voiceOnRef.current) void speak(GREETING_ID, ready);
    });
    return () => {
      live = false;
    };
  }, [slug, preview, speak]);

  const listenRef = useRef<() => void>(() => {});
  const listenInCall = useCallback((): void => {
    setCallError(null);
    setCallState("listening");
    void recorder.start({
      continuous: true,
      onDone: (clip) => {
        if (!callRef.current) return;
        if (!clip) {
          // Quiet thinking time is normal in a call; keep listening without an API request.
          listenRef.current();
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
  useEffect(() => { listenRef.current = listenInCall; }, [listenInCall]);

  /** Sends a typed message, or a recording that Gemini writes down first (any language). */
  async function ask({ text, audio }: { text?: string; audio?: Recording }) {
    const content = text?.trim().slice(0, 2000) ?? "";
    if ((!content && !audio) || busyRef.current) return;
    stopSpeaking();
    const userMsg: Msg = { id: uid(), role: "user", content, pending: Boolean(audio) };
    const prior = messagesRef.current.filter((m) => !m.pending && !m.streaming);
    // The API needs the conversation to start with the visitor, so drop any reply cut off by the 30-message window.
    const history = [...prior, ...(audio ? [] : [userMsg])].map(({ role, content }) => ({ role, content })).slice(audio ? -29 : -30);
    while (history[0]?.role === "assistant") history.shift();

    setMessages([...prior, userMsg]);
    setInput("");
    setBusy(true);
    busyRef.current = true;
    setError(null);
    const replyId = uid();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const responseDeadline = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    try {
      const res = await fetch(`/api/chat/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, audio, preview, source, stream: true, voice: callRef.current || voiceOnRef.current }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const failure = await res.json().catch(() => ({}));
        throw new Error(failure.error || "Something went wrong.");
      }
      let json: { reply?: string; transcript?: string; speakToken?: string; booked?: boolean; language?: string };
      if (res.headers.get("content-type")?.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let complete: typeof json | undefined;
        let streamed = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              const event = JSON.parse(line);
              if (event.type === "error") throw new Error(event.error);
              if (event.type === "transcript" && event.transcript) {
                setMessages((m) => m.map((x) => x.id === userMsg.id ? { ...x, content: event.transcript, pending: false } : x));
                setHeard(event.transcript);
              }
              if (event.type === "text") {
                streamed = event.reset ? "" : streamed + event.text;
                const content = streamed;
                setMessages((m) => [...m.filter((x) => x.id !== replyId), ...(content ? [{ id: replyId, role: "assistant" as const, content, streaming: true }] : [])]);
              }
              if (event.type === "done") complete = event;
            }
            if (done) break;
          }
          if (!complete) throw new Error("The reply was interrupted. Please try again.");
          json = complete;
        } finally { reader.releaseLock(); }
      } else json = await res.json();
      if (audio && !json.transcript) {
        setMessages((m) => m.filter((x) => x.id !== userMsg.id));
        if (callRef.current) {
          setCallState("idle");
          setCallError(NOT_HEARD);
        } else setError(NOT_HEARD);
        return;
      }
      if (audio) {
        const transcript = json.transcript ?? "";
        setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, content: transcript, pending: false } : x)));
        setHeard(transcript);
      }
      const reply = String(json.reply ?? "").trim() || "Sorry, I didn't quite get that. Could you say it another way?";
      const id = replyId;
      const speech = { text: reply, language: typeof json.language === "string" ? json.language : undefined, token: typeof json.speakToken === "string" ? json.speakToken : undefined };
      lastSpeechRef.current = { id, speech };
      setMessages((m) => [...m.filter((x) => x.id !== replyId), { id, role: "assistant", content: reply, token: speech.token, language: speech.language }]);
      setAnimatingId(id);
      if (json.booked) setBooked(true);
      if (callRef.current) {
        setLastReply(reply);
        setCallState("speaking");
        void speak(id, speech, (success) => {
          if (!callRef.current) return;
          if (success) listenInCall();
          else setCallState("idle");
        });
      } else if (voiceOnRef.current) {
        void speak(id, speech);
      }
    } catch (e) {
      if (controller.signal.aborted && !timedOut) return;
      const message = timedOut ? "The reply took too long. If you were booking, check your confirmation before retrying." : e instanceof Error ? e.message : "Something went wrong.";
      setMessages((m) => m.filter((x) => x.id !== userMsg.id && x.id !== replyId));
      if (callRef.current) {
        setCallState("idle");
        setCallError(message);
      } else {
        setError(message);
        if (content) setInput(content);
      }
    } finally {
      clearTimeout(responseDeadline);
      if (requestRef.current === controller) requestRef.current = null;
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
    if (busyRef.current) return;
    unlockAudio();
    recorder.cancel();
    stopSpeaking();
    setLastReply("");
    lastSpeechRef.current = null;
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

  function retryCallVoice() {
    const last = lastSpeechRef.current;
    if (!last || busyRef.current) return;
    unlockAudio();
    setCallState("speaking");
    void speak(last.id, last.speech, (success) => { if (callRef.current) { if (success) listenInCall(); else setCallState("idle"); } });
  }

  const say = (id: string, speech: { text: string; audioUrl?: string | null; token?: string; language?: string }) => {
    unlockAudio();
    if (speakingId === id) stopSpeaking();
    else void speak(id, speech);
  };

  const hasUserMessage = messages.some((m) => m.role === "user");
  const greetingDone = greeting && animatingId !== GREETING_ID;
  const suggestions = ["What do you offer?", "How much does it cost?", ...(booking ? ["Book an appointment"] : [])];
  const status = recording ? "Listening…" : preparing ? "Preparing voice…" : speakingId ? "Speaking…" : busy ? "Thinking…" : preview ? "Preview · only you can see this" : "Online · multilingual";

  return (
    <div className={cn("relative flex min-h-0 flex-col overflow-hidden bg-white", className)}>
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-white px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
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
          <p className="truncate font-bold" dir="auto">{businessName} AI</p>
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
          <button type="button" onClick={startCall} disabled={busy} className="grid h-9 w-9 place-items-center rounded-full bg-navy text-white transition hover:bg-brand disabled:opacity-50" aria-label="Start a voice chat" title="Voice chat">
            <AudioLines className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-bg text-muted hover:text-ink" aria-label="Close chat">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-bg/60 px-4 py-5" aria-live="polite">
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
            onSpeak={m.role === "assistant" && !m.streaming ? () => say(m.id, { text: m.content, token: m.token, language: m.language }) : undefined}
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

      {error && <p role="alert" className="shrink-0 border-t border-line bg-stamp/5 px-5 py-2 text-sm text-stamp">{error}</p>}
      {voiceError && !call && <p role="alert" className="shrink-0 border-t border-line bg-cream px-4 py-2 text-xs text-ink-2">{voiceError}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask({ text: input });
        }}
        className="flex shrink-0 items-end gap-2 border-t border-line bg-white p-3"
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
            ref={inputRef}
            dir="auto"
            id={`chat-${slug}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask({ text: input });
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask me anything…"
            className="input max-h-32 min-h-[44px] min-w-0 flex-1 resize-none bg-white text-base text-ink placeholder:text-muted"
          />
        )}
        <button type="submit" disabled={busy || recording || !input.trim()} className="btn btn-primary h-11 w-11 shrink-0 p-0" aria-label="Send">
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
      <p className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-[10px] text-muted">AI answers may be imperfect. Powered by TapSynk.</p>

      {call && (
        <div className="call-in absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] gap-4 bg-[radial-gradient(120%_80%_at_50%_0%,#1d5bff_0%,#121a36_55%,#0b0f1d_100%)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 text-white sm:px-6 sm:pt-8" role="dialog" aria-label="Voice chat">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Voice chat · any language</p>
            <p className="mt-1 text-lg font-bold">{businessName} AI</p>
          </div>

          <div className="flex min-h-0 w-full flex-col items-center overflow-y-auto overscroll-contain py-2">
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
            <p className="mt-4 text-center text-sm font-semibold text-white/70" aria-live="polite">
              {callState === "listening" ? "Listening… just pause when you're done" : callState === "thinking" ? "Thinking…" : callState === "speaking" ? preparing ? "Preparing voice · tap to cancel" : "Speaking · tap to interrupt" : "Tap the circle to talk"}
            </p>
            {voiceError && <p role="alert" className="mt-3 rounded-xl bg-white/10 p-3 text-center text-sm text-white">{voiceError}</p>}
            {voiceError && lastReply && <button type="button" onClick={retryCallVoice} className="mt-2 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">Listen again</button>}
            {heard && callState !== "listening" && <p className="mt-3 line-clamp-2 max-w-full text-center text-sm text-white/55">“{heard}”</p>}
            <p dir="auto" className="mt-3 w-full whitespace-pre-wrap break-words text-center text-base leading-relaxed text-white">
              {callState === "speaking" ? lastReply : callState === "idle" ? callError ?? (lastReply || "Ask me anything, out loud, in any language.") : callState === "listening" ? "Go ahead, I'm listening." : ""}
            </p>
          </div>

          <button type="button" onClick={endCall} className="mx-auto flex shrink-0 items-center gap-2 rounded-full bg-stamp px-6 py-3 font-semibold text-white shadow-lg transition hover:brightness-110">
            <PhoneOff className="h-5 w-5" /> Back to typing
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

/** A chat bubble; replies appear as soon as they arrive. */
function Bubble({
  role,
  text,
  pending = false,
  animate,
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
  // The server has already generated the answer; show it immediately.
  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(onDone, 0);
    return () => clearTimeout(timer);
  }, [animate, onDone]);

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
        dir="auto"
        className={cn(
          "max-w-[92%] break-words whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[85%]",
          role === "user" ? "rounded-2xl rounded-br-md bg-brand text-white" : "rounded-2xl rounded-bl-md bg-white text-ink shadow-sm",
          speaking && "ring-2 ring-brand/30",
        )}
      >
        {text}
      </p>
      {onSpeak && (
        <button type="button" onClick={onSpeak} className="mt-1 flex items-center gap-1 px-1 text-xs font-medium text-muted transition hover:text-brand">
          {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
          {speaking ? "Stop" : "Listen"}
        </button>
      )}
    </div>
  );
}
