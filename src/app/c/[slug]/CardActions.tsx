"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Handshake, Loader2, Share2, UserPlus, X } from "lucide-react";
import { ChatPanel } from "@/components/ChatWidget";
import { AI_BUTTON, AI_BUTTON_SUB } from "@/lib/greeting";
import { loadGreeting, unlockAudio } from "@/lib/speech";
import type { EventSource } from "@/lib/types";

export function CardActions({
  slug,
  ai,
  businessName,
  ownerName,
  intro,
  booking,
  logoUrl,
  source,
}: {
  slug: string;
  ai: boolean;
  businessName: string;
  ownerName: string;
  intro: string;
  booking: boolean;
  logoUrl?: string;
  source: EventSource;
}) {
  const [open, setOpen] = useState<"chat" | "lead" | null>(null);
  const [contactHelp, setContactHelp] = useState(false);
  const contactUrl = `/api/vcard/${encodeURIComponent(slug)}.vcf?s=${source[0]}`;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}`;
    if (navigator.share) await navigator.share({ title: ownerName, url }).catch(() => {});
    else await navigator.clipboard.writeText(url);
  }

  // Get the AI's spoken greeting ready while the visitor looks at the card, so it plays the instant they tap.
  useEffect(() => {
    if (!ai) return;
    const t = setTimeout(() => void loadGreeting(slug), 600);
    return () => clearTimeout(t);
  }, [ai, slug]);

  const first = ownerName.split(" ")[0] || ownerName;

  function openChat() {
    // Phones only allow sound that starts inside a tap, so unlock it here for the AI's greeting.
    unlockAudio();
    setOpen("chat");
  }

  return (
    <>
      <a href={contactUrl} onClick={() => setContactHelp(true)} className="btn btn-dark w-full py-3.5 text-base">
        <UserPlus className="h-5 w-5" /> Save contact
      </a>
      {contactHelp && (
        <div className="rounded-xl bg-bg p-3 text-sm text-ink-2" role="status">
          <p>Confirm the import on your phone to finish saving. On iPhone, choose Create New Contact, then Done. On Android, open the downloaded .vcf file and choose your Contacts app.</p>
          <p className="mt-2">If it does not open, use Safari or Chrome, or <a href={`${contactUrl}&download=1`} className="font-semibold text-brand underline">download the contact file</a> and open it.</p>
        </div>
      )}
      {ai && (
        <button type="button" onClick={openChat} className="btn btn-primary relative w-full overflow-hidden py-2.5 text-base">
          <span className="absolute inset-0 -translate-x-full animate-[shine_2.8s_ease_1s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <Bot className="h-5 w-5 shrink-0" />
          <span className="flex flex-col items-start leading-tight">
            <span>{AI_BUTTON}</span>
            <span className="text-xs font-medium text-white/80">{AI_BUTTON_SUB}</span>
          </span>
        </button>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setOpen("lead")} className="btn btn-cream w-full">
          <Handshake className="h-4 w-4" /> Share my contact
        </button>
        <button type="button" onClick={share} className="btn btn-ghost w-full">
          <Share2 className="h-4 w-4" /> Share card
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          {open === "chat" ? (
            <div className="sheet-up h-[88dvh] w-full max-w-md sm:h-[640px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Chat with ${businessName} AI`}>
              <ChatPanel slug={slug} businessName={businessName} ownerName={ownerName} intro={intro} booking={booking} logoUrl={logoUrl} source={source} onClose={() => setOpen(null)} className="h-full rounded-t-[28px] shadow-2xl sm:rounded-[28px]" />
            </div>
          ) : (
            <div className="sheet-up w-full max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Share your contact with ${first}`}>
              <LeadForm slug={slug} first={first} source={source} onClose={() => setOpen(null)} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function LeadForm({ slug, first, source, onClose }: { slug: string; first: string; source: EventSource; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "", website: "" });
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: boolean }>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch(`/api/leads/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send your details.");
      setState({ done: true });
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Could not send your details." });
    }
  }

  return (
    <div className="relative rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-bg text-muted hover:text-ink" aria-label="Close">
        <X className="h-4 w-4" />
      </button>
      {state.done ? (
        <div className="py-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success text-white"><Check className="h-7 w-7" /></span>
          <h2 className="mt-4 text-xl font-bold">Sent to {first}!</h2>
          <p className="mt-1 text-sm text-muted">{first} now has your details and will be in touch.</p>
          <button type="button" onClick={onClose} className="btn btn-dark mt-6">Done</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h2 className="pr-10 text-xl font-bold">Share your contact with {first}</h2>
          <p className="mt-1 text-sm text-muted">So {first} can follow up with you. Add an email or phone.</p>
          <div className="mt-5 grid gap-3">
            <input className="input" placeholder="Your name" value={form.name} onChange={set("name")} required maxLength={100} autoComplete="name" />
            <input className="input" type="email" placeholder="Email" value={form.email} onChange={set("email")} maxLength={120} autoComplete="email" />
            <input className="input" type="tel" placeholder="Phone" value={form.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" />
            <input className="input" placeholder="Company (optional)" value={form.company} onChange={set("company")} maxLength={100} autoComplete="organization" />
            <textarea className="input resize-none" rows={3} placeholder="Note (optional)" value={form.message} onChange={set("message")} maxLength={1000} />
            <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} />
          </div>
          {state.error && <p role="alert" className="mt-3 text-sm text-stamp">{state.error}</p>}
          <button type="submit" disabled={state.busy} className="btn btn-primary mt-5 w-full py-3">
            {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Send my details
          </button>
        </form>
      )}
    </div>
  );
}
