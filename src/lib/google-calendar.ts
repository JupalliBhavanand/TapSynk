import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCalendarToken } from "@/lib/calendar-tokens";
import { SITE_URL } from "@/lib/env";
import type { Appointment } from "@/lib/types";

export const GOOGLE_IDENTITY_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";
export const calendarRedirectUri = () => `${SITE_URL}/api/google-calendar/callback`;
export function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && Buffer.from(process.env.GOOGLE_CALENDAR_TOKEN_KEY || "", "base64").length === 32);
}
export async function calendarConnectionStatus(userId: string) {
  const { data, error } = await createAdminClient().from("google_calendar_connections").select("connected_at,last_error,google_email,calendar_summary,meet_enabled").eq("user_id", userId).maybeSingle();
  return { connected: Boolean(data), error: error ? "Calendar storage is unavailable. Apply the calendar database migration." : data?.last_error || null, configured: calendarConfigured(), googleEmail: data?.google_email || null, calendarSummary: data?.calendar_summary || "Primary calendar", meetEnabled: data?.meet_enabled !== false };
}
export function calendarEventId(id: string, version: number) { return `ts${id.replace(/-/g, "")}${version.toString(16)}`; }
export function validMeetUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "meet.google.com" && !url.username && !url.password; } catch { return false; }
}
type GoogleEvent = { id: string; hangoutLink?: string; status?: string; conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[]; createRequest?: { status?: { statusCode: string } } } };
export function conferenceRequest(booking: Appointment) {
  return { createRequest: { requestId: `tapsynk-${booking.id}-${booking.google_event_version || 1}`, conferenceSolutionKey: { type: "hangoutsMeet" } } };
}
export function eventBody(booking: Appointment, host: { full_name: string; company: string; slug: string }, createMeet = true) {
  return {
    summary: `${host.company || host.full_name} · ${booking.name}`,
    description: [`Meeting with ${host.full_name}`, booking.notes, `${SITE_URL}/c/${host.slug}`].filter(Boolean).join("\n\n"),
    start: { dateTime: booking.starts_at }, end: { dateTime: booking.ends_at },
    attendees: [{ email: booking.email, displayName: booking.name }],
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }, { method: "popup", minutes: 0 }] },
    ...(createMeet ? { conferenceData: conferenceRequest(booking) } : {}),
    extendedProperties: { private: { tapsynkAppointmentId: booking.id } },
  };
}

/** Idempotent per booking/version: retries retrieve the same event, never invite twice. */
export async function syncAppointmentToGoogle(id: string, ownerId: string): Promise<{ ok: boolean; message?: string; meetUrl?: string }> {
  const db = createAdminClient();
  const { data: connection, error: connectionError } = await db.from("google_calendar_connections").select("refresh_token_encrypted,meet_enabled").eq("user_id", ownerId).maybeSingle();
  if (connectionError) return { ok: false, message: "Calendar storage is unavailable." };
  if (!connection) return { ok: false, message: "Connect Google Calendar to sync this meeting." };
  const { data, error } = await db.from("appointments").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
  if (error || !data) return { ok: false, message: "Appointment not found." };
  const booking = data as Appointment;
  const wantsMeet = connection.meet_enabled !== false;
  const historical = booking.status === "completed" || Date.parse(booking.ends_at) <= Date.now();
  const sendUpdates = historical ? "none" : "all";
  const version = booking.google_event_version || 1;
  const eventId = calendarEventId(booking.id, version);
  const save = (values: Record<string, unknown>) => db.from("appointments").update(values).eq("id", id).eq("owner_id", ownerId).eq("status", booking.status).eq("google_event_version", version).eq("starts_at", booking.starts_at).eq("ends_at", booking.ends_at);
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: decryptCalendarToken(connection.refresh_token_encrypted), grant_type: "refresh_token" }), signal: AbortSignal.timeout(10000), cache: "no-store" });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) {
      if (token.error === "invalid_grant") await db.from("google_calendar_connections").update({ last_error: "Google access expired. Reconnect your calendar." }).eq("user_id", ownerId);
      throw new Error("Could not access Google Calendar. Reconnect your calendar and retry.");
    }
    const call = (path: string, init?: RequestInit, timeout = 10000) => fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, { ...init, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(timeout), cache: "no-store" });
    if (booking.status === "cancelled") {
      {
        const deleted = await call(`/${eventId}?sendUpdates=${sendUpdates}`, { method: "DELETE" });
        if (!deleted.ok && ![404, 410].includes(deleted.status)) throw new Error("Could not cancel the Google Calendar event. Retry sync.");
      }
      await save({ calendar_sync_status: "synced", calendar_sync_error: null, google_meet_url: null });
      return { ok: true };
    }
    let response = await call(`/${eventId}`);
    let event: GoogleEvent;
    if (response.status === 404) {
      const { data: host } = await db.from("cards").select("full_name,company,slug").eq("id", booking.card_id).eq("user_id", ownerId).single();
      if (!host) throw new Error("Card details are unavailable.");
      const payload = eventBody(booking, host, wantsMeet);
      response = await call(`?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, { method: "POST", body: JSON.stringify({ id: eventId, ...payload, ...(historical ? { attendees: [] } : {}) }) });
      if (response.status === 409) response = await call(`/${eventId}`);
    }
    if (!response.ok) throw new Error("Google could not sync this meeting. Check calendar access and retry.");
    event = await response.json();
    // Reflect time edits without issuing another conference request.
    if (booking.google_event_id && booking.calendar_sync_status !== "synced") {
      const update = await call(`/${eventId}?sendUpdates=${sendUpdates}`, { method: "PATCH", body: JSON.stringify({ start: { dateTime: booking.starts_at }, end: { dateTime: booking.ends_at } }) });
      if (!update.ok) throw new Error("Could not update the Google Calendar event. Retry sync.");
      event = await update.json();
    }
    if (wantsMeet && !event.hangoutLink && !event.conferenceData) {
      const updated = await call(`/${eventId}?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, { method: "PATCH", body: JSON.stringify({ conferenceData: conferenceRequest(booking) }) });
      if (updated.ok) event = await updated.json();
    }
    for (let attempt = 0; attempt < 5 && event.conferenceData?.createRequest?.status?.statusCode === "pending"; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const refreshed = await call(`/${eventId}`, undefined, 4000);
      if (!refreshed.ok) break;
      event = await refreshed.json();
    }
    const candidate = event.hangoutLink || event.conferenceData?.entryPoints?.find(p => p.entryPointType === "video")?.uri;
    const meetUrl = validMeetUrl(candidate) ? candidate : null;
    const pending = event.conferenceData?.createRequest?.status?.statusCode === "pending";
    const { error: saveError } = await save({ google_event_id: eventId, google_meet_url: meetUrl, calendar_sync_status: pending ? "pending" : "synced", calendar_sync_error: wantsMeet && !meetUrl && !pending ? "Google did not create a Meet link. Check Meet availability for this Google account." : null });
    if (saveError) throw new Error("The event exists in Google, but its sync status could not be saved. Retry sync.");
    // A cancellation racing event creation must not leave a live Google event.
    const { data: latest } = await db.from("appointments").select("status,google_event_version,starts_at,ends_at").eq("id", id).eq("owner_id", ownerId).single();
    if (latest && (latest.status === "cancelled" || latest.google_event_version !== version)) {
      await call(`/${eventId}?sendUpdates=${sendUpdates}`, { method: "DELETE" });
      return { ok: false, message: "Booking changed during sync. Retry to refresh its calendar status." };
    }
    if (latest && (latest.starts_at !== booking.starts_at || latest.ends_at !== booking.ends_at)) return { ok: false, message: "Meeting time changed during sync. Retry to refresh Google Calendar." };
    return { ok: true, meetUrl: meetUrl || undefined, message: !wantsMeet ? "Calendar synced. Automatic Google Meet is switched off." : pending ? "Calendar event added. Meet link is being prepared; sync again shortly." : meetUrl ? "Calendar and Google Meet are ready." : "Calendar event added; Google Meet is not available for this account." };
  } catch (error) {
    const message = error instanceof Error && /^(Could not|Google |Card details|The event)/.test(error.message) ? error.message : "Calendar sync failed. Please reconnect or retry.";
    await save({ calendar_sync_status: "failed", calendar_sync_error: message });
    return { ok: false, message };
  }
}
export async function syncUpcomingAppointments(ownerId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("appointments").select("id").eq("owner_id", ownerId).eq("status", "confirmed").gte("starts_at", new Date().toISOString()).or("calendar_sync_status.neq.synced,google_event_id.is.null").order("starts_at").limit(10);
  if (error) return { ok: false, message: "Could not load appointments for sync." };
  let synced = 0, failed = 0;
  const results = await Promise.all((data || []).map(item => syncAppointmentToGoogle(item.id, ownerId)));
  for (const result of results) { if (result.ok) synced++; else failed++; }
  return { ok: failed === 0, message: `${synced} meeting(s) synced.${failed ? ` ${failed} need attention.` : ""}${data?.length === 10 ? " Sync again to process the next batch." : ""}` };
}

export type CalendarSyncBatch = { processed: number; total: number; synced: number; failed: number; nextCursor: string | null; fatal?: boolean; message?: string };
/** Walk every appointment, including history, without a page-size cutoff. */
export async function syncAllCalendarBatch(ownerId: string, cursor?: string): Promise<CalendarSyncBatch> {
  const empty = { processed: 0, total: 0, synced: 0, failed: 0, nextCursor: null };
  const connection = await calendarConnectionStatus(ownerId);
  if (!connection.configured || !connection.connected || connection.error) return { ...empty, fatal: true, message: connection.error || (!connection.configured ? "Google Calendar setup is not complete for this site." : "Link your Google Calendar first, then sync your meetings.") };
  const db = createAdminClient();
  let query = db.from("appointments").select("id", { count: "exact" }).eq("owner_id", ownerId).or("status.neq.cancelled,google_event_id.not.is.null").order("id").limit(5);
  if (cursor) query = query.gt("id", cursor);
  const { data, count, error } = await query;
  if (error) return { ...empty, fatal: true, message: "Could not load meetings. Try syncing again." };
  const records = data || [];
  const results = await Promise.all(records.map(item => syncAppointmentToGoogle(item.id, ownerId).catch(() => ({ ok: false }))));
  const synced = results.filter(result => result.ok).length;
  return { processed: records.length, total: count ?? records.length, synced, failed: records.length - synced, nextCursor: records.length === 5 ? records[records.length - 1].id : null };
}
