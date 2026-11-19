import "server-only";
import { availableSlots, isValidTimeZone } from "@/lib/slots";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agent, Card } from "@/lib/types";

export function bookingZone(agent: Agent) {
  return isValidTimeZone(agent.timezone) ? agent.timezone : "UTC";
}

export function bookingDate(time: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  const get = (part: string) => parts.find((value) => value.type === part)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function validBookingDate(date: string, timezone: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return false;
  return date >= bookingDate(now, timezone) && date <= bookingDate(new Date(now.getTime() + 90 * 86400e3), timezone);
}

/** Failure to read existing bookings must never mean every slot is free. */
export async function publicBookingSlots(card: Card, agent: Agent, date: string) {
  const day = Date.parse(`${date}T00:00:00Z`);
  const { data, error } = await createAdminClient().from("appointments").select("starts_at, ends_at")
    .eq("card_id", card.id).eq("status", "confirmed")
    .gte("starts_at", new Date(day - 36 * 3600e3).toISOString())
    .lt("starts_at", new Date(day + 60 * 3600e3).toISOString());
  if (error) throw new Error("Availability is temporarily unavailable. Please try again.");
  return availableSlots(agent, date, data ?? []);
}
