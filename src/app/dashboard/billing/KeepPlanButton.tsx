"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { BillingInterval, Tier } from "@/lib/plans";

/** Cancels a scheduled switch by choosing the current plan again. */
export function KeepPlanButton({ tier, interval, label }: { tier: Tier; interval: BillingInterval; label: string }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  async function keep() {
    setState({ busy: true });
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier, interval }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) return setState({ error: json.error || "Could not update your plan." });
    window.location.assign(json.url);
  }
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={keep} disabled={state.busy} className="btn btn-primary py-2 text-sm">
        {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </button>
      {state.error && <p role="alert" className="text-xs text-stamp">{state.error}</p>}
    </div>
  );
}
