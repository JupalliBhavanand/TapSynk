"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { CompanyBill, CompanyPlanPicker } from "@/components/CompanyPlanPicker";
import { ImageUpload } from "@/components/ImageUpload";
import type { Tier } from "@/lib/plans";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveCompany } from "./actions";

const ACCENTS = ["#1d5bff", "#7c5cff", "#0ea5a4", "#10a765", "#f59e0b", "#e11d48", "#0f1426"];

/**
 * Company profile + plan. Before the first payment it ends in Stripe Checkout;
 * once active (`profileOnly`) it just saves branding, which is copied to every employee card.
 */
export function CompanySetup({
  initial,
  userId,
  profileOnly = false,
  defaultTier = "ai",
  defaultSeats = 5,
}: {
  initial: Company | null;
  userId: string;
  profileOnly?: boolean;
  defaultTier?: Tier;
  defaultSeats?: number;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    website: initial?.website ?? "",
    address: initial?.address ?? "",
    logo_url: initial?.logo_url ?? "",
    accent: initial?.accent ?? ACCENTS[0]!,
  });
  const [plan, setPlan] = useState<{ tier: Tier; seats: number }>({ tier: initial?.tier ?? defaultTier, seats: initial?.seats ?? defaultSeats });
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setStatus({});
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveCompany({ ...form, ...plan });
      if (!res.ok) return setStatus({ error: res.error });
      if (profileOnly) return setStatus({ saved: true });
      const pay = await fetch("/api/stripe/company-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(plan),
      });
      const json = await pay.json().catch(() => ({}));
      if (!pay.ok || !json.url) return setStatus({ error: json.error || "Could not start checkout." });
      window.location.assign(json.url);
    });
  }

  const profile = (
    <section className="card-surface p-6">
      <h2 className="font-bold">Company profile</h2>
      <p className="text-sm text-muted">Shown on every employee card.</p>
      <div className="mt-5 flex flex-wrap items-center gap-6">
        <ImageUpload userId={userId} name="company-logo" label="Company logo" value={form.logo_url} onChange={(v) => set("logo_url", v)} onError={(error) => setStatus({ error })} />
        <div>
          <p className="label">Brand colour</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button key={c} type="button" onClick={() => set("accent", c)} className={cn("grid h-8 w-8 place-items-center rounded-full ring-offset-2 transition", form.accent === c && "ring-2 ring-ink")} style={{ background: c }} aria-label={`Colour ${c}`}>
                {form.accent === c && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="co-name">Company name</label>
          <input id="co-name" className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={80} autoComplete="organization" />
        </div>
        <div>
          <label className="label" htmlFor="co-web">Website</label>
          <input id="co-web" className="input" value={form.website} onChange={(e) => set("website", e.target.value)} maxLength={200} placeholder="yourcompany.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="co-addr">Office address</label>
          <input id="co-addr" className="input" value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={200} autoComplete="street-address" />
        </div>
      </div>
    </section>
  );

  if (profileOnly) {
    return (
      <form onSubmit={submit} className="space-y-4">
        {profile}
        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : status.saved ? <Check className="h-4 w-4" /> : null}
            {status.saved ? "Saved to every card" : "Save company profile"}
          </button>
          {status.error && <p role="alert" className="text-sm text-stamp">{status.error}</p>}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-8 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        {profile}
        <section className="card-surface p-6">
          <h2 className="mb-4 font-bold">Your team plan</h2>
          <CompanyPlanPicker tier={plan.tier} seats={plan.seats} onChange={setPlan} />
        </section>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <CompanyBill tier={plan.tier} seats={plan.seats} />
        {status.error && <p role="alert" className="text-sm text-stamp">{status.error}</p>}
        <button type="submit" className="btn btn-primary w-full py-3" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {pending ? "Opening secure checkout…" : "Continue to secure payment"}
        </button>
        <p className="text-center text-xs text-muted">Company plans are billed monthly with no free trial. Change seats or cancel any time.</p>
      </aside>
    </form>
  );
}
