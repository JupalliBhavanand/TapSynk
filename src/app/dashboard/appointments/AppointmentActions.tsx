"use client";

import { useState, useTransition } from "react";
import { setAppointmentStatus } from "../actions";
import { emailBookingConfirmation } from "./actions";
import type { Appointment } from "@/lib/types";

export function AppointmentActions({ id, status, emailStatus }: { id: string; status: string; emailStatus?: Appointment["confirmation_email_status"] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const email = () => {
    if (emailStatus === "failed" && !confirm("Check the company Sent folder first: a connection error may occur after delivery. Send confirmation again?")) return;
    start(async () => { const result = await emailBookingConfirmation(id); setMessage(result.error || result.message || ""); });
  };
  const act = (s: "cancelled" | "completed" | "confirmed") => start(async () => void (await setAppointmentStatus(id, s)));
  if (status !== "confirmed") {
    return (
      <button disabled={pending} onClick={() => act("confirmed")} className="text-sm font-semibold text-brand disabled:opacity-50">
        Restore
      </button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2 text-sm font-semibold sm:items-end">
      <div className="flex flex-wrap gap-3">
      {emailStatus === "sent" ? <span className="text-muted">Confirmation emailed</span> : emailStatus === "sending" ? <span className="text-muted">Sending confirmation…</span> : <button disabled={pending} onClick={email} className="text-brand disabled:opacity-50">{emailStatus === "failed" ? "Retry email" : "Send confirmation"}</button>}
      <button disabled={pending} onClick={() => act("completed")} className="text-success disabled:opacity-50">Mark done</button>
      <button disabled={pending} onClick={() => { if (confirm("Cancel this appointment?")) act("cancelled"); }} className="text-stamp disabled:opacity-50">Cancel</button>
      </div>
      {message && <p role="status" className="max-w-xs text-xs font-normal text-muted">{message}</p>}
    </div>
  );
}
