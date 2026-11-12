"use client";

import { SyncAllMeetingsButton } from "@/components/SyncAllMeetingsButton";
import { useState, useTransition } from "react";
import { CalendarDays, Check, CheckCircle2, RefreshCw, ShieldCheck, Video } from "lucide-react";
import { disconnectCalendar, syncCalendar, setGoogleMeetEnabled } from "./calendar-actions";

const notices: Record<string, string> = {
  connected: "Google Calendar connected. Your past and upcoming meetings are syncing.",
  denied: "Calendar access was not granted. You can connect again whenever you’re ready.",
  expired: "The connection request expired. Please try again.",
  failed: "Google Calendar could not connect. Try again and allow calendar access.",
  storage: "Calendar storage is unavailable. The database needs the calendar migration.",
  setup: "Google Calendar is not configured on this server yet.",
  signin: "Sign in again, then connect your calendar.",
};
export function CalendarConnection({ connected, configured, error, notice, googleEmail, calendarSummary, meetEnabled = true }: { connected: boolean; configured: boolean; error: string | null; notice?: string; googleEmail?: string | null; calendarSummary?: string; meetEnabled?: boolean }) {
  const [meet, setMeet] = useState(meetEnabled);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const ready = configured && connected;
  return <section id="calendar-connection" aria-label="Google Calendar and Meet connection" className="card-surface mb-6 overflow-hidden border-brand/15">
    <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex shrink-0 items-center rounded-2xl bg-brand-soft p-3 text-brand"><CalendarDays size={24} /></span>
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Your calendar. Your meetings.</h2><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? "bg-success/10 text-success" : "bg-bg text-muted"}`}>{ready && <Check size={12} />}{ready ? "Connected" : "Not connected"}</span></div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">Connect your Google account to add TapSynk appointments to your calendar and create Google Meet links automatically.</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2">
        {configured ? <a href="/api/google-calendar/connect" className="btn btn-primary px-5 py-3 text-sm"><GoogleAccountIcon />{connected ? "Change Google account" : "Connect Google account"}</a> : <button type="button" disabled className="btn btn-primary cursor-not-allowed px-5 py-3 text-sm opacity-50"><GoogleAccountIcon />Connection unavailable</button>}
        <span className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck size={13} />Connect securely with Google</span>
      </div>
    </div>
    {!connected && <ol className="grid gap-4 border-t border-line bg-bg/50 p-5 sm:grid-cols-3 sm:p-6">
      {[{ title: "Choose your account", text: "Use the Google account where you manage your meetings." }, { title: "Allow calendar access", text: "Approve access on Google’s secure sign-in page." }, { title: "Keep meetings together", text: "Sync bookings, send invitations, and add Meet links." }].map((step, index) => <li key={step.title} className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/15 bg-white text-xs font-bold text-brand">{index + 1}</span><div><p className="text-xs font-bold">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{step.text}</p></div></li>)}
    </ol>}
    {connected && <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 sm:p-6">
      <div className="min-w-0 rounded-xl border border-line p-4"><p className="flex items-center gap-2 text-xs font-bold text-muted"><CalendarDays size={15} />GOOGLE CALENDAR</p><p className="mt-3 break-all text-sm font-semibold">{googleEmail || "Your Google account"}</p><p className="mt-1 break-all text-xs text-muted">{calendarSummary || "Primary Google Calendar"}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 size={13} />New bookings sync automatically</p><div className="mt-4">{configured && <SyncAllMeetingsButton accountEmail={googleEmail} autoStart={notice === "connected"} />}</div></div>
      <div className="rounded-xl border border-line p-4"><p className="flex items-center gap-2 text-xs font-bold text-muted"><Video size={15} />GOOGLE MEET</p><label className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold"><span>Create a Meet link for bookings</span><input type="checkbox" role="switch" checked={meet} disabled={pending || !configured} onChange={e => { const enabled = e.target.checked; setMeet(enabled); start(async () => { try { const result = await setGoogleMeetEnabled(enabled); if (!result.ok) setMeet(!enabled); setMessage(result.message); } catch { setMeet(!enabled); setMessage("Could not update Google Meet. Please try again."); } }); }} className="h-5 w-5 shrink-0 accent-blue-600" /></label><p className="mt-2 text-xs leading-relaxed text-muted">Uses your connected Google account. Guests can join using the link in their calendar invitation.</p><p className="mt-3 text-xs text-muted">{meet ? "Sync existing appointments to add missing Meet links." : "Existing Meet links stay available when this is off."}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-muted">TapSynk sends appointments to your primary Google calendar.</p><button type="button" disabled={pending} className="text-xs font-semibold text-stamp disabled:opacity-50" onClick={() => { if (!confirm("Disconnect your Google account? New bookings will stop syncing. Existing Google events will remain.")) return; start(async () => { try { const result = await disconnectCalendar(); setMessage(result.message); } catch { setMessage("Could not disconnect. Please try again."); } }); }}>{pending ? "Updating…" : "Disconnect account"}</button></div>
    </div>}
    {!configured && <p role="status" className="border-t border-line bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-800 sm:px-6">Google connection is temporarily unavailable. Please try again once the site’s Google integration is enabled.</p>}
    {(message || error || (notice && notices[notice])) && <p role="status" className="border-t border-line px-5 py-4 text-xs leading-relaxed text-muted sm:px-6">{message || error || notices[notice!]}</p>}
  </section>;
}
function GoogleAccountIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0"><path fill="currentColor" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.61-2.41l-3.24-2.51c-.9.6-2.05.96-3.37.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22ZM6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59ZM12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" /></svg>;

}
export function AppointmentCalendar({ id, syncStatus, error, calendarConnected }: { id: string; syncStatus?: string; error?: string | null; calendarConnected?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  if (calendarConnected === false) return <a href="#calendar-connection" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand"><CalendarDays size={12} />Connect Google to sync</a>;
  return <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
    <button type="button" disabled={pending} onClick={() => start(async () => { const result = await syncCalendar(id); setMessage(result.message || "Calendar updated."); })} className="inline-flex items-center gap-1 font-semibold text-brand disabled:opacity-50"><RefreshCw size={11} className={pending ? "animate-spin" : ""} />{syncStatus === "synced" ? "Refresh calendar" : "Sync to calendar"}</button>
    {(message || error) && <span role="status" className="w-full text-muted">{message || error}</span>}
  </div>;
}
