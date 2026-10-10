"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, CalendarCheck, CalendarDays, CalendarRange, CheckCircle2, Clock, Mail, Phone, XCircle } from "lucide-react";
import { Chips, ListSkeleton, matches, NoMatches, SearchBox, Select, useHydrated } from "@/components/ListToolbar";
import { formatInZone } from "@/lib/slots";
import type { Appointment } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { AppointmentActions } from "./AppointmentActions";

type View = "upcoming" | "confirmed" | "completed" | "cancelled" | "all";
type Range = "any" | "today" | "week" | "month" | "past30";
type Sort = "soonest" | "latest" | "booked" | "name";

const DAY = 86_400_000;
const STATUS_STYLE: Record<Appointment["status"], string> = {
  confirmed: "bg-success/10 text-success",
  completed: "bg-brand-soft text-brand",
  cancelled: "bg-stamp/10 text-stamp",
};

/** The calendar day of `iso` in the agent's timezone, as YYYY-MM-DD (sortable and comparable). */
function dayKey(iso: string | number, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function AppointmentsBoard({ items, tz }: { items: Appointment[]; tz: string }) {
  const hydrated = useHydrated();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("upcoming");
  const [range, setRange] = useState<Range>("any");
  const [sort, setSort] = useState<Sort>("soonest");

  const isUpcoming = (a: Appointment) => a.status === "confirmed" && new Date(a.starts_at).getTime() >= now;
  const counts = useMemo(() => {
    const c = { upcoming: 0, confirmed: 0, completed: 0, cancelled: 0, all: items.length };
    for (const a of items) {
      c[a.status] += 1;
      if (a.status === "confirmed" && new Date(a.starts_at).getTime() >= now) c.upcoming += 1;
    }
    return c;
  }, [items, now]);

  const shown = useMemo(() => {
    const today = dayKey(now, tz);
    const inRange = (a: Appointment) => {
      const t = new Date(a.starts_at).getTime();
      const day = dayKey(a.starts_at, tz);
      if (range === "today") return day === today;
      if (range === "week") return t >= now - DAY && t <= now + 7 * DAY;
      if (range === "month") return day.slice(0, 7) === today.slice(0, 7);
      if (range === "past30") return t < now && t >= now - 30 * DAY;
      return true;
    };
    const list = items.filter(
      (a) =>
        (view === "all" || (view === "upcoming" ? isUpcoming(a) : a.status === view)) &&
        inRange(a) &&
        matches(query, a.name, a.email, a.phone, a.notes),
    );
    const at = (a: Appointment) => new Date(a.starts_at).getTime();
    const by: Record<Sort, (a: Appointment, b: Appointment) => number> = {
      soonest: (a, b) => at(a) - at(b),
      latest: (a, b) => at(b) - at(a),
      booked: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isUpcoming only reads `now`
  }, [items, view, range, query, sort, now, tz]);

  const today = dayKey(now, tz);
  const tomorrow = dayKey(now + DAY, tz);
  const dayTitle = (iso: string) => {
    const k = dayKey(iso, tz);
    if (k === today) return "Today";
    if (k === tomorrow) return "Tomorrow";
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));
  };
  const groups: { title: string; items: Appointment[] }[] = [];
  for (const a of shown) {
    const title = sort === "soonest" || sort === "latest" ? dayTitle(a.starts_at) : "";
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(a);
    else groups.push({ title, items: [a] });
  }

  const stats = [
    { label: "Upcoming", value: counts.upcoming, icon: CalendarCheck, tone: "bg-brand-soft text-brand" },
    { label: "Today", value: items.filter((a) => a.status === "confirmed" && dayKey(a.starts_at, tz) === today).length, icon: Clock, tone: "bg-amber-50 text-amber-700" },
    { label: "Completed", value: counts.completed, icon: CheckCircle2, tone: "bg-success/10 text-success" },
    { label: "Cancelled", value: counts.cancelled, icon: XCircle, tone: "bg-stamp/10 text-stamp" },
  ];
  const clear = () => {
    setQuery("");
    setView("all");
    setRange("any");
  };

  return (
    <div>
      {hydrated && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card-surface flex items-center gap-3 p-4">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", s.tone)}><s.icon className="h-5 w-5" /></span>
              <span>
                <span className="block text-2xl font-bold tabular-nums leading-tight">{s.value}</span>
                <span className="block text-xs font-medium text-muted">{s.label}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, phone or notes" />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              label="Date"
              icon={CalendarRange}
              value={range}
              onChange={setRange}
              options={[
                { value: "any", label: "Any date" },
                { value: "today", label: "Today" },
                { value: "week", label: "Next 7 days" },
                { value: "month", label: "This month" },
                { value: "past30", label: "Past 30 days" },
              ]}
            />
            <Select
              label="Sort"
              icon={ArrowDownUp}
              value={sort}
              onChange={setSort}
              options={[
                { value: "soonest", label: "Soonest first" },
                { value: "latest", label: "Latest first" },
                { value: "booked", label: "Recently booked" },
                { value: "name", label: "Name A–Z" },
              ]}
            />
          </div>
        </div>
        <Chips
          label="Status"
          value={view}
          onChange={setView}
          options={[
            { value: "upcoming", label: "Upcoming", count: hydrated ? counts.upcoming : undefined },
            { value: "confirmed", label: "Confirmed", count: counts.confirmed, dot: "bg-success" },
            { value: "completed", label: "Completed", count: counts.completed, dot: "bg-brand" },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled, dot: "bg-stamp" },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      {!hydrated ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="card-surface mt-4 flex items-center gap-3 p-6 text-sm text-muted"><CalendarDays className="h-5 w-5" /> No appointments yet. Share your card and your AI will fill your calendar.</div>
      ) : shown.length === 0 ? (
        view === "upcoming" && !query && range === "any" ? (
          <div className="card-surface mt-4 flex items-center gap-3 p-6 text-sm text-muted"><CalendarDays className="h-5 w-5" /> No upcoming appointments. Share your card and your AI will fill your calendar.</div>
        ) : (
          <NoMatches onClear={clear} />
        )
      ) : (
        groups.map((g) => (
          <section key={g.title || "all"} className="mt-5">
            {g.title && <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{g.title}</h2>}
            <ul className="card-surface divide-y divide-line overflow-hidden">
              {g.items.map((a) => (
                <li key={a.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5", a.status === "cancelled" && "opacity-70")}>
                  <div className="flex min-w-0 gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">{initials(a.name)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{a.name}</p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", STATUS_STYLE[a.status])}>{a.status}</span>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-2"><Clock className="h-3.5 w-3.5 text-muted" /> {formatInZone(a.starts_at, tz)}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
                        <a href={`mailto:${a.email}`} className="flex min-w-0 items-center gap-1 hover:text-ink"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.email}</span></a>
                        {a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1 hover:text-ink"><Phone className="h-3.5 w-3.5" /> {a.phone}</a>}
                      </div>
                      {a.notes && <p className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm text-ink-2">“{a.notes}”</p>}
                    </div>
                  </div>
                  <AppointmentActions id={a.id} status={a.status} emailStatus={a.confirmation_email_status} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
