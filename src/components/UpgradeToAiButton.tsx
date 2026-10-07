"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { BillingInterval } from "@/lib/plans";

/** One-click Virtual → AI switch for existing subscribers (prorated, unlocks right away). */
export function UpgradeToAiButton({ interval, className = "btn btn-primary" }: { interval: BillingInterval; className?: string }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  async function upgrade() {
    if (!confirm("Upgrade to the AI Card now?\n\nYour AI agent unlocks right away and you only pay the prorated difference today.")) return;
    setState({ busy: true });
    const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier: "ai", interval }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) return setState({ error: json.error || "Could not upgrade your plan." });
    window.location.assign(json.url);
  }
  return (
    <span className="inline-flex flex-col items-center gap-2">
      <button type="button" onClick={upgrade} disabled={state.busy} className={className}>
        {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Upgrade to AI Card
      </button>
      {state.error && <span role="alert" className="text-xs text-stamp">{state.error}</span>}
    </span>
  );
}
