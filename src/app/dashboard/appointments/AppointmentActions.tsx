"use client";

import { GoogleMeetButton } from "@/components/GoogleMeetButton";
import { useState, useTransition } from "react";
import { setAppointmentStatus } from "../actions";
import { emailBookingConfirmation } from "./actions";
import type { Appointment } from "@/lib/types";

export function AppointmentActions({ id, status, emailStatus, meetUrl, accountEmail, calendarConnected }: { id: string; status: string; emailStatus?: Appointment["confirmation_email_status"]; meetUrl?: string | null; accountEmail?: string | null; calendarConnected?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const email = () => {
    if (emailStatus === "failed" && !confirm("Check the company Sent folder first: a connection error may occur after delivery. Send confirmation again?")) return;
    start(async () => { const result = await emailBookingConfirmation(id); setMessage(result.error || result.message || ""); });
  };
  const act = (s: "cancelled" | "completed" | "confirmed") => start(async () => void (await setAppointmentStatus(id, s)));
  if (status !== "confirmed") {
    return (
      <div className="flex items-center gap-3"><button disabled={pending} onClick={() => act("confirmed")} className="text-sm font-semibold text-brand disabled:opacity-50">
        Restore
      </button><GoogleMeetButton id={id} status={status} meetUrl={meetUrl} accountEmail={accountEmail} calendarConnected={calendarConnected} iconOnly /></div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 text-sm font-semibold sm:items-end">
      <div className="flex flex-wrap items-center gap-3 sm:justify-end [&>button]:whitespace-nowrap">
      {emailStatus === "sent" ? <span className="text-muted">Confirmation emailed</span> : emailStatus === "sending" ? <span className="text-muted">Sending confirmation…</span> : <button disabled={pending} onClick={email} className="text-brand disabled:opacity-50">{emailStatus === "failed" ? "Retry email" : "Send confirmation"}</button>}
      <button disabled={pending} onClick={() => act("completed")} className="text-success disabled:opacity-50">Mark done</button>
      <div className="inline-flex shrink-0 items-center gap-3"><button disabled={pending} onClick={() => { if (confirm("Cancel this appointment?")) act("cancelled"); }} className="text-stamp disabled:opacity-50">Cancel</button>
      <GoogleMeetButton id={id} status={status} meetUrl={meetUrl} accountEmail={accountEmail} calendarConnected={calendarConnected} iconOnly onMessage={setMessage} /></div>
      </div>
      {message && <p role="status" className="max-w-xs text-xs font-normal text-muted">{message}</p>}
    </div>
  );
}
