"use client";

import { useState, useTransition } from "react";
import { Video, LoaderCircle, ArrowUpRight } from "lucide-react";
import { syncCalendar } from "@/app/dashboard/appointments/calendar-actions";
import { googleMeetJoinUrl } from "@/lib/google-links";

export function GoogleMeetIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="#00832d" d="M16 8.5 22 4v16l-6-4.5z" /><path fill="#0066da" d="M2 7h12v12H4a2 2 0 0 1-2-2z" /><path fill="#e94235" d="M2 7V5a2 2 0 0 1 2-2h3v4z" /><path fill="#2684fc" d="M7 3h7v4H7z" /><path fill="#00ac47" d="M14 7h3v10a2 2 0 0 1-2 2h-1z" /><path fill="#ffba00" d="M14 3h1a2 2 0 0 1 2 2v3.5L14 11z" /></svg>;
}

export function GoogleMeetButton({ id, meetUrl, accountEmail, status, iconOnly = false, onMessage, calendarConnected }: { id: string; meetUrl?: string | null; accountEmail?: string | null; status: string; iconOnly?: boolean; onMessage?: (message: string) => void; calendarConnected?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const reportMessage = (value: string) => { setMessage(value); onMessage?.(value); };
  const joinUrl = googleMeetJoinUrl(meetUrl, accountEmail);
  const className = iconOnly ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white transition hover:border-success/40 hover:bg-success/5 disabled:cursor-not-allowed disabled:opacity-40" : "inline-flex items-center gap-1.5 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-xs font-semibold text-success transition hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50";
  if (joinUrl && status !== "cancelled") return <a href={joinUrl} target="_blank" rel="noopener noreferrer" className={className} aria-label="Join Google Meet" title={accountEmail ? `Join using ${accountEmail}` : "Join this appointment’s Google Meet"}>{iconOnly ? <GoogleMeetIcon /> : <><Video size={14} />Join Google Meet<ArrowUpRight size={12} /></>}</a>;
  const unavailable = status !== "confirmed";
  if (!unavailable && calendarConnected === false) return <a href="#calendar-connection" className={className} aria-label="Connect Google to create a Meet link" title="Connect your Google account to create a Meet link">{iconOnly ? <GoogleMeetIcon /> : <><Video size={14} />Connect Google</>}</a>;
  return <div className="inline-flex flex-col items-start gap-1.5"><button type="button" disabled={pending || unavailable} aria-label={pending ? "Preparing Google Meet" : unavailable ? "Google Meet unavailable" : "Set up Google Meet"} className={className} title={unavailable ? "This appointment has no active Google Meet link." : "Sync this appointment, then open its Google Meet."} onClick={() => start(async () => {
    reportMessage("");
    try {
      const result = await syncCalendar(id);
      const url = googleMeetJoinUrl(result.meetUrl, accountEmail);
      if (result.ok && url) { window.location.assign(url); return; }
      reportMessage(result.message || "Link Google Calendar and turn on automatic Google Meet, then try again.");
    } catch { reportMessage("Could not prepare this meeting. Please try again."); }
  })}>{pending ? <LoaderCircle size={14} className="animate-spin" /> : iconOnly ? <GoogleMeetIcon /> : <Video size={14} />}{!iconOnly && (status === "cancelled" ? "Meeting cancelled" : unavailable ? "No Meet link" : pending ? "Preparing Google Meet…" : "Set up Google Meet")}</button>{message && !onMessage && <p role="status" className="max-w-xs text-xs font-normal leading-relaxed text-muted">{message}</p>}</div>;
}
