"use client";

import { useEffect, useState } from "react";
import { Bot, Building2, CheckCircle2, HelpCircle, IdCard, Loader2, Send } from "lucide-react";
import { DEMO_INTERESTS, DEMO_TIMES, TEAM_SIZES, type DemoInput } from "@/lib/demo";
import { cn } from "@/lib/utils";

const ICONS = { ai: Bot, virtual: IdCard, company: Building2, not_sure: HelpCircle } as const;
type Interest = keyof typeof DEMO_INTERESTS;

export function DemoForm({ defaultInterest = "ai" }: { defaultInterest?: Interest }) {
  const [interest, setInterest] = useState<Interest>(defaultInterest);
  const [time, setTime] = useState<"" | keyof typeof DEMO_TIMES>("");
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: boolean }>({});
  const [minDate, setMinDate] = useState("");

  // Today's date in the visitor's own timezone, read after hydration.
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: DemoInput = {
      name: String(f.get("name") ?? ""),
      email: String(f.get("email") ?? ""),
      phone: String(f.get("phone") ?? ""),
      company: String(f.get("company") ?? ""),
      role: String(f.get("role") ?? ""),
      team_size: String(f.get("team_size") ?? "1") as DemoInput["team_size"],
      interest,
      preferred_date: String(f.get("preferred_date") ?? ""),
      preferred_time: time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      message: String(f.get("message") ?? ""),
      website: String(f.get("website") ?? ""),
    };
    setState({ busy: true });
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send your request.");
      setState({ done: true });
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Could not send your request." });
    }
  }

  if (state.done) {
    return (
      <div className="card-surface fade-up flex flex-col items-center px-6 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-8 w-8" /></span>
        <h2 className="mt-5 text-2xl font-bold">You&apos;re on the list!</h2>
        <p className="mt-2 max-w-sm text-ink-2">Thanks for booking a demo. We&apos;ll get in touch by email to confirm a time that works for you.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-surface space-y-5 p-6 sm:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <fieldset>
        <legend className="label">What would you like to see?</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {(Object.keys(DEMO_INTERESTS) as Interest[]).map((k) => {
            const Icon = ICONS[k];
            const on = interest === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setInterest(k)}
                className={cn("flex items-start gap-3 rounded-2xl border p-3 text-left transition", on ? "border-brand bg-brand-soft/60 ring-4 ring-brand/10" : "border-line bg-white hover:border-[#cfd5e1]")}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", on ? "text-brand" : "text-muted")} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{DEMO_INTERESTS[k].label}</span>
                  <span className="block text-xs text-muted">{DEMO_INTERESTS[k].hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="demo-name">Full name *</label>
          <input id="demo-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="demo-email">Work email *</label>
          <input id="demo-email" name="email" type="email" required maxLength={120} autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="demo-phone">Phone</label>
          <input id="demo-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="demo-company">Company</label>
          <input id="demo-company" name="company" maxLength={100} autoComplete="organization" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="demo-role">Your role</label>
          <input id="demo-role" name="role" maxLength={80} autoComplete="organization-title" placeholder="e.g. Founder, Realtor" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="demo-team">Team size</label>
          <select id="demo-team" name="team_size" defaultValue={interest === "company" ? "10-24" : "1"} className="input">
            {TEAM_SIZES.map((s) => (
              <option key={s} value={s}>{s === "1" ? "Just me" : `${s} people`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="demo-date">Preferred day</label>
          <input id="demo-date" name="preferred_date" type="date" min={minDate || undefined} className="input" />
        </div>
        <fieldset>
          <legend className="label">Preferred time</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-white p-1">
            {(Object.keys(DEMO_TIMES) as (keyof typeof DEMO_TIMES)[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={time === k}
                onClick={() => setTime(time === k ? "" : k)}
                className={cn("rounded-lg px-2 py-1.5 text-sm font-semibold transition", time === k ? "bg-navy text-white" : "text-muted hover:text-ink")}
              >
                {DEMO_TIMES[k]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label className="label" htmlFor="demo-message">Anything we should know?</label>
        <textarea id="demo-message" name="message" rows={3} maxLength={2000} placeholder="Your business, what you want the AI to do, how many cards you need…" className="input" />
      </div>

      {state.error && <p role="alert" className="rounded-xl border border-stamp/20 bg-stamp/5 px-3 py-2 text-sm text-stamp">{state.error}</p>}
      <button type="submit" disabled={state.busy} className="btn btn-primary w-full py-3.5 text-base">
        {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {state.busy ? "Sending…" : "Book my free demo"}
      </button>
      <p className="text-center text-xs text-muted">Free, no obligation. We only use your details to arrange the demo.</p>
    </form>
  );
}
