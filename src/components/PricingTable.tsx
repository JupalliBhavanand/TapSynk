"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { INTERVALS, PLANS, TRIAL_DAYS, savingsPercent, type BillingInterval, type Tier } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function PricingTable({
  mode = "marketing",
  currentTier,
  currentInterval,
  periodEnd,
  trialing = false,
  initialInterval = "month",
  trial = true,
}: {
  mode?: "marketing" | "dashboard";
  currentTier?: Tier | null;
  currentInterval?: BillingInterval | null;
  /** When the current paid period ends (AI → Virtual switches happen then). */
  periodEnd?: string | null;
  trialing?: boolean;
  initialInterval?: BillingInterval;
  /** Whether this visitor still gets the free first month (Virtual Card only). */
  trial?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fixed locale and zone so the server and browser render the same date (no hydration mismatch).
  const endDate = periodEnd ? new Date(periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
  const switchNote = (tier: Tier) => {
    if (!currentTier || currentTier === tier) return null;
    if (tier === "ai") return trialing ? "AI unlocks right away. Your free month ends and AI is charged from today." : "AI unlocks right away. You only pay the prorated difference today.";
    return trialing ? "Switches right away. Still free until your first charge." : `You keep AI until ${endDate ?? "your plan renews"}, then switch to Virtual Card.`;
  };

  async function checkout(tier: Tier) {
    if (currentTier && currentTier !== tier) {
      const note = switchNote(tier);
      if (!confirm(`Switch to ${PLANS[tier].name} (${INTERVALS[interval].label.toLowerCase()})?\n\n${note}`)) return;
    }
    setLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Could not start checkout.");
      window.location.assign(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="mx-auto flex w-fit rounded-2xl border border-line bg-white p-1 shadow-sm" role="tablist" aria-label="Billing period">
        {(Object.keys(INTERVALS) as BillingInterval[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={interval === key}
            onClick={() => setInterval(key)}
            className={cn(
              "relative rounded-xl px-4 py-2 text-sm font-semibold transition",
              interval === key ? "bg-navy text-white shadow" : "text-muted hover:text-ink",
            )}
          >
            {INTERVALS[key].label}
            {key === "year" && <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">BEST</span>}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mx-auto mt-4 max-w-md text-center text-sm text-stamp">{error}</p>}

      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
        {(Object.keys(PLANS) as Tier[]).map((tier) => {
          const plan = PLANS[tier];
          const featured = tier === "ai";
          const save = savingsPercent(tier, interval);
          const isCurrent = currentTier === tier && (!currentInterval || currentInterval === interval);
          const isSwitch = Boolean(currentTier) && !isCurrent;
          const note = switchNote(tier);
          const next = `/dashboard/billing?plan=${tier}&interval=${interval}`;
          // The free month is for the Virtual Card only; AI Card plans are charged from day one.
          const freeMonth = trial && tier === "virtual";
          return (
            <div
              key={tier}
              className={cn(
                "relative flex flex-col rounded-3xl p-8 transition hover:-translate-y-1",
                featured ? "bg-navy text-white shadow-[0_30px_60px_-25px_rgba(29,91,255,0.55)]" : "card-surface",
              )}
            >
              {featured && (
                <>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                    <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand/50 blur-3xl" />
                  </div>
                  <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand to-brand-2 px-3 py-1 text-xs font-bold text-white shadow">
                    <Sparkles className="h-3 w-3" /> MOST POPULAR
                  </span>
                </>
              )}
              <div className="relative">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className={cn("mt-1 text-sm", featured ? "text-white/70" : "text-muted")}>{plan.tagline}</p>
                {freeMonth && !currentTier ? (
                  <>
                    <span className={cn("mt-6 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", featured ? "bg-success/20 text-[#5ff0ae]" : "bg-success/10 text-success")}>
                      FIRST MONTH FREE
                    </span>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-5xl font-extrabold tracking-tight">$0</span>
                      <span className={cn("mb-1.5 text-sm", featured ? "text-white/60" : "text-muted")}>for {TRIAL_DAYS} days</span>
                    </div>
                    <p className={cn("mt-1 text-sm", featured ? "text-white/70" : "text-muted")}>
                      then <span className={cn("font-semibold", featured ? "text-white" : "text-ink")}>${plan.prices[interval]}{INTERVALS[interval].short}</span>
                      {save > 0 && <span className={cn("font-semibold", featured ? "text-brand-2" : "text-success")}> · save {save}%</span>}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="text-5xl font-extrabold tracking-tight">${plan.prices[interval]}</span>
                      <span className={cn("mb-1.5 text-sm", featured ? "text-white/60" : "text-muted")}>{INTERVALS[interval].short}</span>
                    </div>
                    <p className={cn("mt-1 h-5 text-sm font-semibold", featured ? "text-brand-2" : "text-success")}>
                      {save > 0 ? `Save ${save}% vs monthly` : "Cancel any time"}
                    </p>
                  </>
                )}
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", featured ? "text-brand-2" : "text-brand")} />
                      <span className={featured ? "text-white/85" : "text-ink-2"}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-8 pt-2">
                {mode === "marketing" ? (
                  <Link href={`/signup?next=${encodeURIComponent(next)}`} className={cn("btn w-full", featured ? "btn-primary" : "btn-dark")}>
                    {freeMonth ? "Start free month" : `Get ${plan.name}`}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => checkout(tier)}
                    disabled={loading !== null || isCurrent}
                    className={cn("btn w-full", featured ? "btn-primary" : "btn-dark")}
                  >
                    {loading === tier && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isCurrent
                      ? "Your current plan"
                      : loading === tier
                        ? isSwitch ? "Switching…" : "Opening secure checkout…"
                        : isSwitch
                          ? currentTier === tier ? `Switch to ${INTERVALS[interval].label.toLowerCase()} billing` : tier === "ai" ? "Upgrade to AI Card" : "Switch to Virtual Card"
                          : freeMonth ? "Start my free month" : `Choose ${plan.name}`}
                  </button>
                )}
                <p className={cn("mt-3 text-center text-xs", featured ? "text-white/50" : "text-muted")}>
                  {mode === "dashboard" && note
                    ? note
                    : freeMonth && !currentTier
                      ? "$0 today · cancel any time in the first month · smart card ships free"
                      : "Physical smart card + free shipping included · cancel any time"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
