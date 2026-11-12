import type { Appointment, Lead } from "@/lib/types";

function accountLink(base: string, email?: string | null) {
  const url = new URL(base);
  if (email?.trim()) url.searchParams.set("authuser", email.trim());
  return url.href;
}
export const googleCalendarUrl = (email?: string | null) => accountLink("https://calendar.google.com/calendar/r", email);
export const googleMeetHomeUrl = (email?: string | null) => accountLink("https://meet.google.com/", email);
export function googleMeetJoinUrl(value?: string | null, email?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "meet.google.com" || url.port || url.username || url.password || !/^\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}\/?$/i.test(url.pathname)) return null;
    if (email?.trim()) url.searchParams.set("authuser", email.trim());
    return url.href;
  } catch { return null; }
}
export type LeadMeeting = Pick<Appointment, "id" | "card_id" | "email" | "starts_at" | "ends_at" | "status" | "google_meet_url" | "calendar_sync_status">;
/** Match only a real, active booking on the same card and email; never guess from a name. */
export function matchLeadMeetings(leads: Pick<Lead, "id" | "card_id" | "email">[], appointments: LeadMeeting[], now = Date.now()) {
  const lookup = new Map<string, LeadMeeting>();
  for (const booking of [...appointments].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
    if (booking.status !== "confirmed" || Date.parse(booking.ends_at) <= now || !booking.email.trim()) continue;
    const key = `${booking.card_id}:${booking.email.trim().toLowerCase()}`;
    if (!lookup.has(key)) {
      const { id, card_id, email, starts_at, ends_at, status, google_meet_url, calendar_sync_status } = booking;
      lookup.set(key, { id, card_id, email, starts_at, ends_at, status, google_meet_url, calendar_sync_status });
    }
  }
  return Object.fromEntries(leads.flatMap(lead => {
    if (!lead.email.trim()) return [];
    const booking = lookup.get(`${lead.card_id}:${lead.email.trim().toLowerCase()}`);
    return booking ? [[lead.id, booking]] : [];
  })) as Record<string, LeadMeeting>;
}
