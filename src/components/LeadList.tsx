"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownUp, CalendarRange, Check, ContactRound, Mail, MessageCircle, Phone, StickyNote, Trophy, UserRound, Users } from "lucide-react";
import { Chips, ListSkeleton, matches, NoMatches, SearchBox, Select, useHydrated } from "@/components/ListToolbar";
import { LEAD_STATUS, LeadStatus } from "@/app/dashboard/leads/LeadStatus";
import { setLeadNotes } from "@/app/dashboard/actions";
import type { Lead } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

type StatusFilter = "all" | Lead["status"];
type Range = "all" | "today" | "7" | "30" | "90";
type Sort = "newest" | "oldest" | "az" | "za" | "status";

const DAY = 86_400_000;
const STATUS_ORDER: Lead["status"][] = ["new", "contacted", "won", "lost"];
const AVATAR = ["bg-brand", "bg-[#7c5cff]", "bg-[#0ea5a4]", "bg-[#e0559b]", "bg-[#f08c2e]", "bg-navy"];

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Today / Yesterday / This week / This month / Month name, for date-sorted lists. */
function bucket(iso: string, now: number) {
  const t = new Date(iso).getTime();
  const today = startOfDay(now);
  if (t >= today) return "Today";
  if (t >= today - DAY) return "Yesterday";
  if (t >= today - 6 * DAY) return "This week";
  const d = new Date(t);
  const n = new Date(now);
  if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()) return "Earlier this month";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Downloads the lead as a contact file so it can be saved to the phone in one tap. */
function downloadVcard(l: Lead) {
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(l.name)}`,
    l.company && `ORG:${esc(l.company)}`,
    l.email && `EMAIL;TYPE=INTERNET:${esc(l.email)}`,
    l.phone && `TEL;TYPE=CELL:${esc(l.phone)}`,
    (l.message || l.notes) && `NOTE:${esc([l.message, l.notes].filter(Boolean).join("\n"))}`,
    "END:VCARD",
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/vcard" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${l.name.replace(/[^\w -]/g, "").trim() || "lead"}.vcf` });
  a.click();
  URL.revokeObjectURL(url);
}

export function LeadList({ leads, empty, cardNames }: { leads: Lead[]; empty: string; cardNames?: Record<string, string> }) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [range, setRange] = useState<Range>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [card, setCard] = useState("all");
  // The clock is read once per mount so filters and "time ago" agree.
  const [now] = useState(() => Date.now());

  const counts = useMemo(() => {
    const c: Record<Lead["status"], number> = { new: 0, contacted: 0, won: 0, lost: 0 };
    for (const l of leads) c[l.status] += 1;
    return c;
  }, [leads]);

  const shown = useMemo(() => {
    const since = range === "all" ? 0 : range === "today" ? startOfDay(now) : now - Number(range) * DAY;
    const list = leads.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (card === "all" || l.card_id === card) &&
        new Date(l.created_at).getTime() >= since &&
        matches(query, l.name, l.email, l.phone, l.company, l.message, l.notes, cardNames?.[l.card_id]),
    );
    const time = (l: Lead) => new Date(l.created_at).getTime();
    const by: Record<Sort, (a: Lead, b: Lead) => number> = {
      newest: (a, b) => time(b) - time(a),
      oldest: (a, b) => time(a) - time(b),
      az: (a, b) => a.name.localeCompare(b.name),
      za: (a, b) => b.name.localeCompare(a.name),
      status: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || time(b) - time(a),
    };
    return list.sort(by[sort]);
  }, [leads, status, card, range, query, sort, now, cardNames]);

  if (leads.length === 0) {
    return (
      <div className="card-surface mt-8 flex flex-col items-center p-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Users className="h-6 w-6" /></span>
        <p className="mt-4 max-w-sm text-sm text-muted">{empty}</p>
      </div>
    );
  }

  const decided = counts.won + counts.lost;
  const stats = [
    { label: "Total leads", value: leads.length, icon: Users, tone: "text-brand bg-brand-soft" },
    { label: "Need follow-up", value: counts.new, icon: UserRound, tone: "text-brand bg-brand-soft" },
    { label: "Contacted", value: counts.contacted, icon: MessageCircle, tone: "text-amber-700 bg-amber-50" },
    { label: "Win rate", value: decided ? `${Math.round((counts.won / decided) * 100)}%` : "–", icon: Trophy, tone: "text-success bg-success/10" },
  ];
  const clear = () => {
    setQuery("");
    setStatus("all");
    setRange("all");
    setCard("all");
  };

  // Group by day when sorted by date, by status when sorted by status.
  const groups: { title: string; items: Lead[] }[] = [];
  for (const l of shown) {
    const title = sort === "newest" || sort === "oldest" ? bucket(l.created_at, now) : sort === "status" ? LEAD_STATUS[l.status].label : "";
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(l);
    else groups.push({ title, items: [l] });
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface flex items-center gap-3 p-4">
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", s.tone)}><s.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-2xl font-bold tabular-nums leading-tight">{s.value}</span>
              <span className="block truncate text-xs font-medium text-muted">{s.label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, phone, company or note" />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              label="Date"
              icon={CalendarRange}
              value={range}
              onChange={setRange}
              options={[
                { value: "all", label: "All time" },
                { value: "today", label: "Today" },
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
              ]}
            />
            <Select
              label="Sort"
              icon={ArrowDownUp}
              value={sort}
              onChange={setSort}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "status", label: "By status" },
                { value: "az", label: "Name A–Z" },
                { value: "za", label: "Name Z–A" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Chips
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: leads.length },
              ...STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS[s].label, count: counts[s], dot: LEAD_STATUS[s].dot })),
            ]}
          />
          {cardNames && Object.keys(cardNames).length > 1 && (
            <Select
              label="Employee"
              icon={UserRound}
              value={card}
              onChange={setCard}
              options={[{ value: "all", label: "All employees" }, ...Object.entries(cardNames).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ value: id, label: name }))]}
            />
          )}
        </div>
      </div>

      {!hydrated ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <NoMatches onClear={clear} />
      ) : (
        <>
          <p className="mt-5 text-xs font-medium text-muted">
            Showing {shown.length} of {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </p>
          {groups.map((g) => (
            <section key={g.title || "all"} className="mt-3">
              {g.title && (
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
                  {g.title} <span className="rounded-full bg-white px-2 py-0.5 tabular-nums ring-1 ring-line">{g.items.length}</span>
                </h2>
              )}
              <ul className="card-surface divide-y divide-line overflow-hidden">
                {g.items.map((l) => (
                  <LeadRow key={l.id} lead={l} now={now} via={cardNames?.[l.card_id]} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function LeadRow({ lead: l, now, via }: { lead: Lead; now: number; via?: string }) {
  const [open, setOpen] = useState(false);
  const color = AVATAR[[...l.id].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR.length];
  const wa = l.phone.replace(/[^\d]/g, "");
  const action = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-brand/40 hover:text-brand";

  return (
    <li className={cn("group p-4 transition sm:p-5", l.status === "new" && "bg-brand-soft/25")}>
      <div className="flex gap-4">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white", color)}>{initials(l.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                {l.name}
                {l.status === "new" && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">New</span>}
              </p>
              {(l.company || via) && (
                <p className="truncate text-sm text-muted">{[l.company, via && `via ${via}'s card`].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <time dateTime={l.created_at} title={new Date(l.created_at).toLocaleString()} className="text-xs text-muted">{timeAgo(l.created_at, now)}</time>
              <LeadStatus id={l.id} status={l.status} />
            </div>
          </div>

          {(l.email || l.phone) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              {l.email && <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0 text-muted" /> <span className="truncate">{l.email}</span></span>}
              {l.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted" /> {l.phone}</span>}
            </div>
          )}
          {l.message && <p className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm text-ink-2">“{l.message}”</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {l.email && <a href={`mailto:${l.email}`} className={action}><Mail className="h-3.5 w-3.5" /> Email</a>}
            {l.phone && <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className={action}><Phone className="h-3.5 w-3.5" /> Call</a>}
            {wa.length >= 7 && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={action}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
            <button type="button" onClick={() => downloadVcard(l)} className={action}><ContactRound className="h-3.5 w-3.5" /> Save contact</button>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn(action, (open || l.notes) && "border-cream-line bg-cream")}>
              <StickyNote className="h-3.5 w-3.5" /> {l.notes ? "Note" : "Add note"}
            </button>
          </div>
          {l.notes && !open && <p className="mt-2 whitespace-pre-line border-l-2 border-cream-line pl-3 text-sm text-ink-2">{l.notes}</p>}
          {open && <NoteEditor id={l.id} initial={l.notes ?? ""} onDone={() => setOpen(false)} />}
        </div>
      </div>
    </li>
  );
}

function NoteEditor({ id, initial, onDone }: { id: string; initial: string; onDone: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={3}
        autoFocus
        placeholder="Private note: what you talked about, next step, follow-up date…"
        className="input text-sm"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setLeadNotes(id, value);
              if (res.ok) onDone();
              else setError(res.error);
            })
          }
          className="btn btn-dark py-1.5 text-xs"
        >
          <Check className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save note"}
        </button>
        <button type="button" onClick={onDone} className="btn py-1.5 text-xs text-muted hover:text-ink">Cancel</button>
        {error && <span role="alert" className="text-xs text-stamp">{error}</span>}
      </div>
    </div>
  );
}
