"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, CalendarCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatPanel({
  slug,
  businessName,
  ownerName,
  preview = false,
  source,
  onClose,
  className = "",
}: {
  slug: string;
  businessName: string;
  ownerName: string;
  preview?: boolean;
  /** How the visitor arrived (tap, qr or link), for analytics. */
  source?: string;
  onClose?: () => void;
  className?: string;
}) {
  const greeting = `Hi! I'm the AI assistant for ${businessName}. Ask me anything about what we do, or I can book a time for you to talk with ${ownerName.split(" ")[0]}.`;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, busy]);

  async function send(text: string) {
    const content = text.trim().slice(0, 2000);
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }].slice(-30);
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, preview, source }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
      if (json.booked) setBooked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ["What do you offer?", "How much does it cost?", "Book an appointment"];

  return (
    <div className={cn("flex flex-col overflow-hidden bg-white", className)}>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-2 to-brand text-white">
          <Bot className="h-5 w-5" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{businessName} AI</p>
          <p className="text-xs text-muted">{preview ? "Preview · only you can see this" : "Usually replies in seconds"}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-bg text-muted hover:text-ink" aria-label="Close chat">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-bg/60 px-4 py-5" aria-live="polite">
        <Bubble role="assistant">{greeting}</Bubble>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>{m.content}</Bubble>
        ))}
        {busy && (
          <div className="typing flex w-fit gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm" aria-label="Assistant is typing">
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span className="h-2 w-2 rounded-full bg-muted" />
          </div>
        )}
        {booked && (
          <div className="fade-up flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
            <CalendarCheck className="h-4 w-4" /> Appointment confirmed
          </div>
        )}
        {messages.length === 0 && !busy && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-brand/25 bg-white px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand-soft">
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
          send(input);
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <label htmlFor={`chat-${slug}`} className="sr-only">Message</label>
        <textarea
          id={`chat-${slug}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ask anything…"
          className="input max-h-32 min-h-[44px] flex-1 resize-none"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary h-11 w-11 shrink-0 p-0" aria-label="Send">
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
      <p className="pb-2 text-center text-[10px] text-muted">AI answers may be imperfect. Powered by TapSync.</p>
    </div>
  );
}

function Bubble({ role, children }: { role: Msg["role"]; children: string }) {
  return (
    <div className={cn("fade-up flex", role === "user" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed",
          role === "user" ? "rounded-2xl rounded-br-md bg-brand text-white" : "rounded-2xl rounded-bl-md bg-white text-ink shadow-sm",
        )}
      >
        {children}
      </p>
    </div>
  );
}
