import { Bot, CalendarCheck, Eye, Handshake, UserPlus } from "lucide-react";
import { KINDS, SOURCES, rate, type summarize } from "@/lib/analytics";
import type { EventKind } from "@/lib/types";

type Summary = ReturnType<typeof summarize>;
const ICONS: Record<EventKind, typeof Eye> = { view: Eye, save: UserPlus, lead: Handshake, ai: Bot, booking: CalendarCheck };

export function StatTiles({ totals }: { totals: Summary["totals"] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {KINDS.map(({ kind, label }) => {
        const Icon = ICONS[kind];
        return (
          <div key={kind} className="card-surface p-5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-sm font-medium">{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">{totals[kind].toLocaleString()}</p>
            {kind !== "view" && <p className="mt-1 text-xs text-muted">{rate(totals[kind], totals.view)} of views</p>}
          </div>
        );
      })}
    </section>
  );
}

/** Daily views for the last 30 days. Single series, so the title names it and no legend is needed. */
export function DailyViews({ daily }: { daily: Summary["daily"] }) {
  const max = Math.max(4, ...daily.map((d) => d.views));
  const W = 600, H = 160, gap = 2, bw = W / daily.length - gap;
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <figure className="card-surface p-6">
      <figcaption className="flex items-baseline justify-between">
        <span className="font-bold">Card views per day</span>
        <span className="text-xs text-muted">Last 30 days · busiest day {Math.max(...daily.map((d) => d.views))}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="mt-4 w-full" role="img" aria-label="Bar chart of card views per day over the last 30 days">
        {[0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="var(--line)" strokeWidth="1" />
        ))}
        <line x1="0" x2={W} y1={H} y2={H} stroke="#cfd5e1" strokeWidth="1" />
        {daily.map((d, i) => {
          const h = d.views === 0 ? 0 : Math.max(3, (d.views / max) * (H - 6));
          const x = i * (bw + gap);
          return (
            <g key={d.date} className="group">
              <rect x={x} y="0" width={bw + gap} height={H} fill="transparent" />
              <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(4, bw / 2)} fill="var(--brand)" className="transition group-hover:opacity-80" />
              <title>{`${fmt(d.date)}: ${d.views} view${d.views === 1 ? "" : "s"}`}</title>
            </g>
          );
        })}
        <text x="0" y={H + 16} fontSize="11" fill="var(--muted)">{fmt(daily[0]!.date)}</text>
        <text x={W} y={H + 16} fontSize="11" fill="var(--muted)" textAnchor="end">Today</text>
      </svg>
    </figure>
  );
}

/** Where views came from: a tapped card, the QR code or a shared link. */
export function SourceSplit({ sources }: { sources: Summary["sources"] }) {
  const total = sources.tap + sources.qr + sources.link;
  return (
    <section className="card-surface p-6">
      <h2 className="font-bold">How people open your card</h2>
      <ul className="mt-5 space-y-4">
        {SOURCES.map(({ source, label }) => {
          const n = sources[source];
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={source}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-ink-2">{label}</span>
                <span className="tabular-nums text-muted">{n.toLocaleString()} · {pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {total === 0 && <p className="mt-4 text-sm text-muted">No views in the last 30 days yet.</p>}
    </section>
  );
}
