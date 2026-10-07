"use client";

import { Bot, IdCard, Minus, Plus } from "lucide-react";
import { COMPANY_DISCOUNTS, COMPANY_MAX_SEATS, COMPANY_MIN_SEATS, PLANS, companyQuote, type Tier } from "@/lib/plans";
import { cn, formatMoney } from "@/lib/utils";

/** Card type + team size, with the live monthly bill. */
export function CompanyPlanPicker({
  tier,
  seats,
  onChange,
  minSeats = COMPANY_MIN_SEATS,
  dark = false,
}: {
  tier: Tier;
  seats: number;
  onChange: (next: { tier: Tier; seats: number }) => void;
  minSeats?: number;
  dark?: boolean;
}) {
  const clamp = (n: number) => Math.max(Math.max(COMPANY_MIN_SEATS, minSeats), Math.min(COMPANY_MAX_SEATS, Math.round(n) || 0));
  return (
    <div>
      <p className={cn("mb-1.5 block text-sm font-semibold", dark ? "text-white/75" : "text-ink-2")}>Card type for your team</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["virtual", "ai"] as Tier[]).map((t) => {
          const Icon = t === "ai" ? Bot : IdCard;
          const selected = tier === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ tier: t, seats })}
              aria-pressed={selected}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                selected ? (dark ? "border-brand bg-brand/25 ring-4 ring-brand/20" : "border-brand bg-brand-soft/60 ring-4 ring-brand/10") : dark ? "border-white/15 bg-white/5 hover:border-white/30" : "border-line bg-white hover:border-brand/40",
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? (dark ? "text-brand-2" : "text-brand") : dark ? "text-white/70" : "text-muted")} />
              <span>
                <span className={cn("block font-semibold", dark && "text-white")}>{PLANS[t].name}</span>
                <span className={cn("block text-sm", dark ? "text-white/65" : "text-muted")}>
                  ${PLANS[t].prices.month}/card list price{t === "ai" ? " · shared AI agent" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <label className={cn("mb-1.5 mt-6 block text-sm font-semibold", dark ? "text-white/75" : "text-ink-2")} htmlFor="seats">Number of employee cards</label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange({ tier, seats: clamp(seats - 1) })} className={cn("btn px-3", dark ? "bg-white/10 text-white" : "btn-ghost")} aria-label="Fewer cards">
          <Minus className="h-4 w-4" />
        </button>
        <div className="w-24 shrink-0">
          <input
            id="seats"
            type="number"
            inputMode="numeric"
            min={Math.max(COMPANY_MIN_SEATS, minSeats)}
            max={COMPANY_MAX_SEATS}
            value={seats}
            onChange={(e) => onChange({ tier, seats: clamp(Number(e.target.value)) })}
            className="input text-center text-lg font-bold tabular-nums text-ink"
          />
        </div>
        <button type="button" onClick={() => onChange({ tier, seats: clamp(seats + 1) })} className={cn("btn px-3", dark ? "bg-white/10 text-white" : "btn-ghost")} aria-label="More cards">
          <Plus className="h-4 w-4" />
        </button>
        <input
          type="range"
          aria-label="Number of employee cards"
          min={Math.max(COMPANY_MIN_SEATS, minSeats)}
          max={100}
          value={Math.min(seats, 100)}
          onChange={(e) => onChange({ tier, seats: clamp(Number(e.target.value)) })}
          className="hidden flex-1 accent-[var(--brand)] sm:block"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {COMPANY_DISCOUNTS.map((d) => {
          const on = companyQuote(tier, seats).percent === d.percent;
          return (
            <span key={d.minSeats} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", on ? "bg-success/15 text-success" : dark ? "bg-white/10 text-white/60" : "bg-bg text-muted")}>
              {d.label}: {d.percent}% off
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The monthly company bill, line by line. */
export function CompanyBill({ tier, seats, dark = false }: { tier: Tier; seats: number; dark?: boolean }) {
  const q = companyQuote(tier, seats);
  const row = "flex justify-between gap-4";
  return (
    <div className={cn("rounded-2xl p-5 font-mono text-sm", dark ? "bg-white/5 text-white/85" : "bg-cream text-ink-2")}>
      <p className={cn("mb-3 text-xs font-bold tracking-[0.15em]", dark ? "text-brand-2" : "text-brand")}>MONTHLY BILL</p>
      <div className={row}><span>{seats} × {PLANS[tier].name} @ {formatMoney(q.listUnit)}</span><span className="tabular-nums">{formatMoney(q.subtotal)}</span></div>
      <div className={cn(row, "text-success")}><span>Team discount ({q.percent}%)</span><span className="tabular-nums">−{formatMoney(q.discount)}</span></div>
      <div className={row}><span>{seats} × smart cards + shipping</span><span>INCLUDED</span></div>
      <div className={cn(row, "mt-3 border-t border-dashed pt-3 text-base font-bold", dark ? "border-white/20 text-white" : "border-cream-line text-ink")}>
        <span>Total / month</span><span className="tabular-nums">{formatMoney(q.total)}</span>
      </div>
      <p className={cn("mt-1 text-xs", dark ? "text-white/50" : "text-muted")}>{formatMoney(q.unit)} per card per month · billed monthly · no free trial</p>
    </div>
  );
}
