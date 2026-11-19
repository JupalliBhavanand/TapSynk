"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Check, Loader2, X } from "lucide-react";
import type { EventSource } from "@/lib/types";

export function DirectBookingForm({ slug, source, onClose }: { slug: string; source: EventSource; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [booked, setBooked] = useState<{ starts_at: string; timezone: string; email_status: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/appointments/${encodeURIComponent(slug)}${date ? `?date=${date}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw Error(result.error || "Could not load appointment times."); return result; })
      .then((result) => { if (controller.signal.aborted) return; setTimezone(result.timezone); setSlots(result.slots); if (!date) { setToday(result.date); setDate(result.date); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load appointment times."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, reload, slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || !slots.includes(slot)) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(slug)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), website: form.get("website") || "", slot, source }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 409) { setLoading(true); setSlot(""); setSlots([]); setReload((value) => value + 1); } throw Error(result.error || "Could not book your appointment."); }
      setBooked(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not finish booking. Check your email before retrying."); }
    finally { setBusy(false); }
  }
  const label = (value: string, zone = timezone) => new Intl.DateTimeFormat("en", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <div className="relative max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
    <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-bg text-muted" aria-label="Close appointment booking"><X className="h-4 w-4" /></button>
    <h2 className="flex items-center gap-2 pr-10 text-xl font-bold"><CalendarDays className="h-5 w-5 text-brand" />Book an appointment</h2>
    {booked ? <div className="mt-6" role="status"><Check className="mb-3 h-10 w-10 text-success" /><h3 className="font-bold">Your appointment is booked</h3><p className="mt-2">{label(booked.starts_at, booked.timezone)}</p><p className="text-sm text-muted">{booked.timezone}</p><p className="mt-3 text-sm text-muted">{booked.email_status === "unavailable" ? "Your appointment is saved. Contact the business if you need confirmation details." : "Check your email for confirmation. Contact the business if it does not arrive."}</p><button type="button" onClick={onClose} className="btn btn-primary mt-5 w-full">Done</button></div> : <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="text-sm text-muted">Choose an available time and enter your details. Times are shown in {timezone}.</p>
      <label className="block text-sm font-medium">Date<input type="date" className="input mt-1 w-full" value={date} min={today || undefined} required disabled={busy} onChange={(event) => { setLoading(true); setDate(event.target.value); setSlot(""); setSlots([]); setError(""); }} /></label>
      <label className="block text-sm font-medium">Time<select className="input mt-1 w-full" value={slot} required disabled={loading || busy || !slots.length} onChange={(event) => setSlot(event.target.value)}><option value="">{loading ? "Loading available times…" : "Choose a time"}</option>{slots.map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value))}</option>)}</select></label>
      {!loading && !slots.length && !error && <p role="status" className="text-sm text-muted">No appointments are available on this date. Please choose another day.</p>}
      <label className="block text-sm font-medium">Name<input className="input mt-1 w-full" name="name" autoComplete="name" maxLength={100} required disabled={busy} /></label>
      <label className="block text-sm font-medium">Email<input className="input mt-1 w-full" name="email" type="email" autoComplete="email" maxLength={120} required disabled={busy} /></label>
      <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy || loading || !slot || !slots.includes(slot)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Booking…" : "Confirm appointment"}</button>
    </form>}
  </div>;
}
