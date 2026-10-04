import type { Agent } from "@/lib/types";

/** Offset in minutes of `timeZone` from UTC at the given instant. */
function tzOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}

/** Converts a wall-clock time in `timeZone` to a UTC Date. */
export function zonedToUtc(dateStr: string, time: string, timeZone: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!));
  const offset = tzOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Correct across DST boundaries.
  const offset2 = tzOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatInZone(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Available start times (UTC ISO strings) on a local date, excluding past and booked slots. */
export function availableSlots(agent: Agent, dateStr: string, bookedStarts: string[], now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const tz = isValidTimeZone(agent.timezone) ? agent.timezone : "UTC";
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  if (!agent.work_days.includes(weekday)) return [];

  const start = zonedToUtc(dateStr, agent.day_start.slice(0, 5), tz);
  const end = zonedToUtc(dateStr, agent.day_end.slice(0, 5), tz);
  const booked = new Set(bookedStarts.map((s) => new Date(s).getTime()));
  const step = agent.slot_minutes * 60000;
  const earliest = now.getTime() + 60 * 60000; // at least one hour of notice

  const slots: string[] = [];
  for (let t = start.getTime(); t + step <= end.getTime(); t += step) {
    if (t >= earliest && !booked.has(t)) slots.push(new Date(t).toISOString());
  }
  return slots;
}
