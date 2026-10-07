"use client";

import { useState, useTransition } from "react";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setLeadStatus } from "../actions";

export const LEAD_STATUS: Record<Lead["status"], { label: string; dot: string; pill: string }> = {
  new: { label: "New", dot: "bg-brand", pill: "border-brand/25 bg-brand-soft text-brand" },
  contacted: { label: "Contacted", dot: "bg-amber-500", pill: "border-amber-300/60 bg-amber-50 text-amber-700" },
  won: { label: "Won", dot: "bg-success", pill: "border-success/30 bg-success/10 text-success" },
  lost: { label: "Lost", dot: "bg-muted", pill: "border-line bg-bg text-muted" },
};

export function LeadStatus({ id, status }: { id: string; status: Lead["status"] }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Lead status"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Lead["status"];
        setValue(next);
        start(async () => {
          const res = await setLeadStatus(id, next);
          if (!res.ok) setValue(status);
        });
      }}
      className={cn("shrink-0 cursor-pointer rounded-full border py-1.5 pl-3 pr-7 text-xs font-bold outline-none transition focus:ring-4 focus:ring-brand/15 disabled:opacity-60", LEAD_STATUS[value].pill)}
    >
      {(Object.keys(LEAD_STATUS) as Lead["status"][]).map((k) => (
        <option key={k} value={k}>{LEAD_STATUS[k].label}</option>
      ))}
    </select>
  );
}
