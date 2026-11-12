"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCalendarToken } from "@/lib/calendar-tokens";
import { syncAppointmentToGoogle, syncUpcomingAppointments, syncAllCalendarBatch } from "@/lib/google-calendar";
import { rateLimit } from "@/lib/rate-limit";

export async function syncCalendar(id?: string): Promise<{ ok: boolean; message?: string; meetUrl?: string }> {
  const { user } = await getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (id && !z.string().uuid().safeParse(id).success) return { ok: false, message: "Unknown appointment." };
  if (!(await rateLimit(`calendar:${user.id}`, 15, 60))) return { ok: false, message: "Please wait a minute before syncing again." };
  const result = id ? await syncAppointmentToGoogle(id, user.id) : await syncUpcomingAppointments(user.id);
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/company/leads");
  return result;
}
export async function disconnectCalendar() {
  const { user } = await getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const db = createAdminClient();
  const { data } = await db.from("google_calendar_connections").select("refresh_token_encrypted").eq("user_id", user.id).maybeSingle();
  let revoked = false;
  if (data) {
    try {
      const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: decryptCalendarToken(data.refresh_token_encrypted) }), signal: AbortSignal.timeout(8000) });
      revoked = response.ok;
    } catch { /* Removing local credentials still stops all future syncing. */ }
  }
  const { error } = await db.from("google_calendar_connections").delete().eq("user_id", user.id);
  if (error) return { ok: false, message: "Could not disconnect. Try again." };
  revalidatePath("/dashboard/appointments");
  return { ok: true, message: `Calendar disconnected. Existing Google events remain.${!revoked && data ? " You can also revoke TapSynk access in your Google account settings." : ""}` };
}

export async function setGoogleMeetEnabled(enabled: boolean) {
  const { user } = await getUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (typeof enabled !== "boolean") return { ok: false, message: "Invalid meeting preference." };
  const db = createAdminClient();
  const { data, error } = await db.from("google_calendar_connections").update({ meet_enabled: enabled, updated_at: new Date().toISOString() }).eq("user_id", user.id).select("user_id").maybeSingle();
  if (error || !data) return { ok: false, message: "Connect your Google account first." };
  if (enabled) await db.from("appointments").update({ calendar_sync_status: "pending" }).eq("owner_id", user.id).eq("status", "confirmed").is("google_meet_url", null).gte("starts_at", new Date().toISOString());
  revalidatePath("/dashboard/appointments");
  return { ok: true, message: enabled ? "Google Meet enabled. New meetings get a Meet link; sync existing meetings to add one." : "Automatic Google Meet is off for new meetings. Existing Meet links remain available." };
}

export async function syncAllMeetingsBatch(cursor?: string) {
  const { user } = await getUser();
  const empty = { processed: 0, total: 0, synced: 0, failed: 0, nextCursor: null, fatal: true };
  if (!user) return { ...empty, message: "Please sign in again." };
  if (cursor && !z.string().uuid().safeParse(cursor).success) return { ...empty, message: "Invalid sync position. Start sync again." };
  if (!(await rateLimit(`calendar:bulk:${user.id}`, 120, 60))) return { ...empty, message: "Sync is busy. Wait a minute, then retry." };
  const result = await syncAllCalendarBatch(user.id, cursor);
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/company/leads");
  return result;
}
