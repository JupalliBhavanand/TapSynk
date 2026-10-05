"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Check } from "lucide-react";
import { CompanyBill, CompanyPlanPicker } from "@/components/CompanyPlanPicker";
import { COMPANY_FEATURES, type Tier } from "@/lib/plans";

/** Marketing-site Company plan section with a live seat calculator. */
export function CompanyPricing() {
  const [plan, setPlan] = useState<{ tier: Tier; seats: number }>({ tier: "ai", seats: 10 });
  return (
    <div className="relative overflow-hidden rounded-[32px] bg-navy p-8 text-white shadow-[0_40px_80px_-40px_rgba(15,20,38,0.8)] sm:p-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
      <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wider"><Building2 className="h-3.5 w-3.5" /> COMPANY PLAN</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Cards for your whole team, <span className="text-brand-2">at a team price</span></h2>
          <p className="mt-3 text-white/70">Create branded cards for every employee, watch how each one performs, and get one monthly bill. The bigger the team, the bigger the discount.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {COMPANY_FEATURES.map((f) => (
              <li key={f} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-2" /><span className="text-white/85">{f}</span></li>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <CompanyPlanPicker tier={plan.tier} seats={plan.seats} onChange={setPlan} dark />
          <CompanyBill tier={plan.tier} seats={plan.seats} dark />
          <Link href={`/signup?next=${encodeURIComponent(`/dashboard/company?tier=${plan.tier}&seats=${plan.seats}`)}`} className="btn btn-primary w-full py-3">
            Set up my company
          </Link>
        </div>
      </div>
    </div>
  );
}
