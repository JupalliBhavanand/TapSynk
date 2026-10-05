"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CompanyBill, CompanyPlanPicker } from "@/components/CompanyPlanPicker";
import { COMPANY_MIN_SEATS, type Tier } from "@/lib/plans";

export function PlanChanger({ tier, seats, used }: { tier: Tier; seats: number; used: number }) {
  const [plan, setPlan] = useState({ tier, seats });
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const changed = plan.tier !== tier || plan.seats !== seats;

  async function apply() {
    setState({ busy: true });
    const res = await fetch("/api/stripe/company-checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(plan) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) return setState({ error: json.error || "Could not update your plan." });
    window.location.assign(json.url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <CompanyPlanPicker tier={plan.tier} seats={plan.seats} onChange={setPlan} minSeats={Math.max(COMPANY_MIN_SEATS, used)} />
      <div className="space-y-3">
        <CompanyBill tier={plan.tier} seats={plan.seats} />
        {state.error && <p role="alert" className="text-sm text-stamp">{state.error}</p>}
        <button type="button" onClick={apply} disabled={!changed || state.busy} className="btn btn-primary w-full">
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} {changed ? "Update plan" : "No changes"}
        </button>
        <p className="text-xs text-muted">Changes are prorated on your next monthly bill. You can't go below the {used} cards you already have.</p>
      </div>
    </div>
  );
}
