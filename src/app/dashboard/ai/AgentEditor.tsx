"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Globe, Loader2, Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/ChatWidget";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveAgent, type AgentInput } from "../actions";
import { saveCompanyAgent } from "../company/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEARN_STEPS = ["Visiting your website", "Reading your pages", "Understanding your services", "Writing your AI's knowledge base"];

type Form = Required<Omit<AgentInput, "slot_minutes">> & { slot_minutes: 15 | 30 | 45 | 60 | 90 };

export function AgentEditor({
  initial,
  slug,
  businessName,
  ownerName,
  company = false,
}: {
  initial: Agent | null;
  slug: string;
  businessName: string;
  ownerName: string;
  /** Edit the company-wide agent shared by every employee card. */
  company?: boolean;
}) {
  const [form, setForm] = useState<Form>(() => ({
    business_name: initial?.business_name || businessName,
    description: initial?.description ?? "",
    services: initial?.services ?? "",
    faq: initial?.faq ?? "",
    tone: initial?.tone ?? "friendly",
    website_url: initial?.website_url ?? "",
    knowledge: initial?.knowledge ?? "",
    booking_enabled: initial?.booking_enabled ?? true,
    timezone: initial?.timezone || "UTC",
    work_days: initial?.work_days ?? [1, 2, 3, 4, 5],
    day_start: initial?.day_start?.slice(0, 5) ?? "09:00",
    day_end: initial?.day_end?.slice(0, 5) ?? "17:00",
    slot_minutes: (initial?.slot_minutes as Form["slot_minutes"]) ?? 30,
  }));
  const [timezones, setTimezones] = useState<string[]>([form.timezone]);
  const [saved, setSaved] = useState(Boolean(initial));
  const [status, setStatus] = useState<{ error?: string; ok?: string }>({});
  const [learning, setLearning] = useState(false);
  const [learnStep, setLearnStep] = useState(0);
  const [pending, start] = useTransition();

  // Timezone data differs between server and browser, so read it after hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezones(Intl.supportedValuesOf("timeZone"));
    if (!initial) setForm((f) => ({ ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }));
  }, [initial]);

  useEffect(() => {
    if (!learning) return;
    const t = setInterval(() => setLearnStep((s) => Math.min(s + 1, LEARN_STEPS.length - 1)), 4500);
    return () => clearInterval(t);
  }, [learning]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setStatus({});
  };

  async function learn() {
    if (!form.website_url.trim()) return setStatus({ error: "Enter your website link first." });
    setLearning(true);
    setLearnStep(0);
    setStatus({});
    try {
      const res = await fetch("/api/ai/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: form.website_url, company }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      set("knowledge", json.knowledge);
      setStatus({ ok: `Learned from ${json.pages.length} page${json.pages.length === 1 ? "" : "s"}. Review it below, then save.` });
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : "Could not learn from that website." });
    } finally {
      setLearning(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await (company ? saveCompanyAgent : saveAgent)(form);
      if (!res.ok) return setStatus({ error: res.error });
      setSaved(true);
      setStatus({ ok: "Your AI agent is saved and up to date." });
    });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_400px]">
      <form onSubmit={submit} className="space-y-6">
        <section className="card-surface overflow-hidden">
          <div className="bg-navy p-6 text-white">
            <div className="flex items-center gap-2 text-brand-2"><Sparkles className="h-4 w-4" /><span className="text-sm font-bold uppercase tracking-widest">Fastest way</span></div>
            <h2 className="mt-2 text-xl font-bold">Learn from your website</h2>
            <p className="mt-1 text-sm text-white/70">Paste your link and your AI reads your pages and writes its own knowledge base.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input value={form.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="yourbusiness.com" className="input pl-9 text-ink" aria-label="Website link" />
              </div>
              <button type="button" onClick={learn} disabled={learning} className="btn btn-primary">
                {learning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {learning ? "Learning…" : "Learn from website"}
              </button>
            </div>
            {learning && (
              <ol className="mt-5 space-y-2 text-sm">
                {LEARN_STEPS.map((s, i) => (
                  <li key={s} className={cn("flex items-center gap-2 transition", i > learnStep && "opacity-35")}>
                    {i < learnStep ? <Check className="h-4 w-4 text-success" /> : i === learnStep ? <Loader2 className="h-4 w-4 animate-spin text-brand-2" /> : <span className="h-4 w-4 rounded-full border border-white/30" />}
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="p-6">
            <label className="label" htmlFor="knowledge">What your AI knows from your website</label>
            <textarea id="knowledge" value={form.knowledge} onChange={(e) => set("knowledge", e.target.value)} rows={8} maxLength={30000} className="input font-mono text-xs leading-relaxed" placeholder="Learned knowledge appears here. You can edit it." />
          </div>
        </section>

        <section className="card-surface p-6">
          <h2 className="font-bold">Or tell your AI about your business</h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="bn">Business name</label>
                <input id="bn" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} maxLength={120} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="tone">Personality</label>
                <select id="tone" value={form.tone} onChange={(e) => set("tone", e.target.value as Form["tone"])} className="input">
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="concise">Concise</option>
                </select>
              </div>
            </div>
            <Area id="desc" label="What does your business do?" value={form.description} onChange={(v) => set("description", v)} max={4000} placeholder="We help small restaurants get more bookings with…" />
            <Area id="svc" label="Products, services & prices" value={form.services} onChange={(v) => set("services", v)} max={4000} placeholder={"Website design: from $1,500\nSEO package: $499/month"} />
            <Area id="faq" label="Common questions & answers" value={form.faq} onChange={(v) => set("faq", v)} max={6000} placeholder={"Q: Do you work with clients abroad?\nA: Yes, we work remotely worldwide."} />
          </div>
        </section>

        <section className="card-surface p-6">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block font-bold">Appointment booking</span>
              <span className="block text-sm text-muted">Let your AI book meetings into your open hours.</span>
            </span>
            <input type="checkbox" checked={form.booking_enabled} onChange={(e) => set("booking_enabled", e.target.checked)} className="peer sr-only" />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-line transition peer-checked:bg-success after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          </label>
          {form.booking_enabled && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="label">Working days</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d, i) => {
                    const on = form.work_days.includes(i);
                    return (
                      <button key={d} type="button" onClick={() => set("work_days", on ? form.work_days.filter((x) => x !== i) : [...form.work_days, i].sort())} className={cn("h-10 w-12 rounded-xl border text-sm font-semibold transition", on ? "border-navy bg-navy text-white" : "border-line bg-white text-muted")} aria-pressed={on}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="ds">Day starts</label>
                <input id="ds" type="time" value={form.day_start} onChange={(e) => set("day_start", e.target.value)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="de">Day ends</label>
                <input id="de" type="time" value={form.day_end} onChange={(e) => set("day_end", e.target.value)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="sl">Meeting length</label>
                <select id="sl" value={form.slot_minutes} onChange={(e) => set("slot_minutes", Number(e.target.value) as Form["slot_minutes"])} className="input">
                  {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tz">Timezone</label>
                <select id="tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className="input">
                  {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
          )}
        </section>

        <div className="sticky bottom-4 z-10 flex items-center gap-4 rounded-2xl border border-line bg-white/90 p-3 shadow-lg backdrop-blur">
          <button type="submit" className="btn btn-primary" disabled={pending || learning}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {pending ? "Saving…" : "Save AI agent"}
          </button>
          {status.error && <p role="alert" className="text-sm text-stamp">{status.error}</p>}
          {status.ok && <p role="status" className="text-sm text-success">{status.ok}</p>}
        </div>
      </form>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-3 text-sm font-semibold text-muted">Test your AI</p>
        {saved && slug ? (
          <ChatPanel slug={slug} businessName={form.business_name || businessName} ownerName={ownerName} preview className="h-[600px] rounded-[24px] border border-line shadow-lg" />
        ) : (
          <div className="card-surface grid h-[300px] place-items-center p-8 text-center text-sm text-muted">{saved ? "Add an employee card to test your company AI." : "Save your AI agent to start chatting with it."}</div>
        )}
      </aside>
    </div>
  );
}

function Area({ id, label, value, onChange, max, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={max} placeholder={placeholder} className="input" />
    </div>
  );
}
