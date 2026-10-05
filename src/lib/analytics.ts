import type { CardEvent, EventKind, EventSource } from "@/lib/types";

export const DAYS = 30;
export const KINDS: { kind: EventKind; label: string }[] = [
  { kind: "view", label: "Card views" },
  { kind: "save", label: "Contacts saved" },
  { kind: "lead", label: "Leads" },
  { kind: "ai", label: "AI chats" },
  { kind: "booking", label: "Bookings" },
];
export const SOURCES: { source: EventSource; label: string }[] = [
  { source: "tap", label: "Card tap" },
  { source: "qr", label: "QR code" },
  { source: "link", label: "Shared link" },
];

export function sinceIso(days = DAYS) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString();
}

export type Totals = Record<EventKind, number>;
export const emptyTotals = (): Totals => ({ view: 0, save: 0, lead: 0, ai: 0, booking: 0 });

/** Rolls raw events up into totals, a per-day view series and a source split for views. */
export function summarize(events: Pick<CardEvent, "kind" | "source" | "created_at">[], days = DAYS) {
  const totals = emptyTotals();
  const sources: Record<EventSource, number> = { tap: 0, qr: 0, link: 0 };
  const start = new Date(sinceIso(days)).getTime();
  const daily = Array.from({ length: days }, (_, i) => ({ date: new Date(start + i * 86400e3).toISOString().slice(0, 10), views: 0 }));
  for (const e of events) {
    totals[e.kind] += 1;
    if (e.kind === "view") {
      sources[e.source] += 1;
      const i = Math.floor((new Date(e.created_at).getTime() - start) / 86400e3);
      if (i >= 0 && i < days) daily[i]!.views += 1;
    }
  }
  return { totals, sources, daily };
}

export const rate = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");
