"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownUp, Building2, CalendarDays, Clock, Mail, Phone, Users } from "lucide-react";
import { Chips, ListSkeleton, matches, NoMatches, SearchBox, Select, useHydrated } from "@/components/ListToolbar";
import { DEMO_INTERESTS, DEMO_STATUSES, DEMO_TIMES } from "@/lib/demo";
import type { DemoRequest } from "@/lib/types";
import { initials } from "@/lib/utils";
import { setDemoStatus } from "./actions";

type Status = keyof typeof DEMO_STATUSES;

export function DemoRequests({ items }: { items: DemoRequest[] }) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [interest, setInterest] = useState<"all" | DemoRequest["interest"]>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "date">("newest");

  const counts = useMemo(() => {
    const c = Object.fromEntries(Object.keys(DEMO_STATUSES).map((k) => [k, 0])) as Record<Status, number>;
    for (const d of items) c[d.status] += 1;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const t = (d: DemoRequest) => new Date(d.created_at).getTime();
    return items
      .filter((d) => (status === "all" || d.status === status) && (interest === "all" || d.interest === interest) && matches(query, d.name, d.email, d.phone, d.company, d.role, d.message))
      .sort((a, b) =>
        sort === "oldest" ? t(a) - t(b) : sort === "date" ? (a.preferred_date ?? "9999").localeCompare(b.preferred_date ?? "9999") || t(b) - t(a) : t(b) - t(a),
      );
  }, [items, status, interest, query, sort]);

  if (items.length === 0) return <div className="card-surface mt-8 p-10 text-center text-sm text-muted">No demo requests yet. They appear here when someone fills in the form at /demo.</div>;

  return (
    <div className="mt-8 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, company or message" />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select label="Interest" value={interest} onChange={setInterest} options={[{ value: "all", label: "Any interest" }, ...Object.entries(DEMO_INTERESTS).map(([k, v]) => ({ value: k as DemoRequest["interest"], label: v.label }))]} />
          <Select label="Sort" icon={ArrowDownUp} value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "date", label: "Preferred day" }]} />
        </div>
      </div>
      <Chips label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All", count: items.length }, ...(Object.keys(DEMO_STATUSES) as Status[]).map((k) => ({ value: k, label: DEMO_STATUSES[k], count: counts[k] }))]} />

      {!hydrated ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <NoMatches onClear={() => { setQuery(""); setStatus("all"); setInterest("all"); }} />
      ) : (
        <ul className="card-surface mt-4 divide-y divide-line overflow-hidden">
          {shown.map((d) => (
            <li key={d.id} className="flex gap-4 p-4 sm:p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">{initials(d.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.name} <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">{DEMO_INTERESTS[d.interest].label}</span></p>
                    <p className="text-sm text-muted">{[d.role, d.company].filter(Boolean).join(" · ") || "No company given"}</p>
                  </div>
                  <StatusSelect id={d.id} status={d.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                  <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Mail className="h-3.5 w-3.5 text-muted" /> {d.email}</a>
                  {d.phone && <a href={`tel:${d.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Phone className="h-3.5 w-3.5 text-muted" /> {d.phone}</a>}
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted" /> {d.team_size === "1" ? "Just them" : `${d.team_size} people`}</span>
                  {(d.preferred_date || d.preferred_time) && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted" />
                      {[d.preferred_date && new Date(`${d.preferred_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), d.preferred_time && DEMO_TIMES[d.preferred_time]].filter(Boolean).join(", ")}
                      {d.timezone && <span className="text-muted">({d.timezone.replace(/_/g, " ")})</span>}
                    </span>
                  )}
                </div>
                {d.message && <p className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm text-ink-2">“{d.message}”</p>}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3 w-3" /> Requested {new Date(d.created_at).toLocaleString()}{d.interest === "company" && <><Building2 className="ml-2 h-3 w-3" /> Team lead</>}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Demo status"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Status;
        setValue(next);
        start(async () => {
          if (!(await setDemoStatus(id, next)).ok) setValue(status);
        });
      }}
      className="input w-auto py-1.5 text-xs font-bold"
    >
      {(Object.keys(DEMO_STATUSES) as Status[]).map((k) => (
        <option key={k} value={k}>{DEMO_STATUSES[k]}</option>
      ))}
    </select>
  );
}
