"use client";

import { useTransition } from "react";
import { setAppointmentStatus } from "../actions";

export function AppointmentActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const act = (s: "cancelled" | "completed" | "confirmed") => start(async () => void (await setAppointmentStatus(id, s)));
  if (status !== "confirmed") {
    return (
      <button disabled={pending} onClick={() => act("confirmed")} className="text-sm font-semibold text-brand disabled:opacity-50">
        Restore
      </button>
    );
  }
  return (
    <div className="flex gap-3 text-sm font-semibold">
      <button disabled={pending} onClick={() => act("completed")} className="text-success disabled:opacity-50">Mark done</button>
      <button disabled={pending} onClick={() => { if (confirm("Cancel this appointment?")) act("cancelled"); }} className="text-stamp disabled:opacity-50">Cancel</button>
    </div>
  );
}
