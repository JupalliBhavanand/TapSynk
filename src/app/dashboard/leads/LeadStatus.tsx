"use client";

import { useState, useTransition } from "react";
import type { Lead } from "@/lib/types";
import { setLeadStatus } from "../actions";

const LABELS: Record<Lead["status"], string> = { new: "New", contacted: "Contacted", won: "Won", lost: "Lost" };

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
      className="input w-auto shrink-0 py-2 text-sm"
    >
      {(Object.keys(LABELS) as Lead["status"][]).map((k) => (
        <option key={k} value={k}>{LABELS[k]}</option>
      ))}
    </select>
  );
}
