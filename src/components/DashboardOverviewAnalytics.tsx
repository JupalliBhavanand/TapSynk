"use client";

import { useState } from "react";
import { Bot, CalendarDays, Eye, UserPlus } from "lucide-react";

export type OverviewMetricSet = { views: number; saves: number; ai: number; upcoming: number };
type Period = "daily" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Daily",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function DashboardOverviewAnalytics({
  metrics,
  orderedAt,
  hasOrderDate,
  asOf,
}: {
  metrics: Record<Period, OverviewMetricSet>;
  orderedAt: string;
  hasOrderDate: boolean;
  asOf: string;
}) {
  const [period, setPeriod] = useState<Period>("yearly");
  const selected = metrics[period];
  const dateLabel = period === "daily"
    ? `Today · ${formatDate(asOf)}`
    : period === "monthly"
      ? `Month to date · ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(asOf))}`
      : `${hasOrderDate ? "Since card ordered" : "Since card created"} · ${formatDate(orderedAt)} – ${formatDate(asOf)}`;
  const tiles = [
    { label: "Card views", value: selected.views, icon: Eye },
    { label: "Contacts saved", value: selected.saves, icon: UserPlus },
    { label: "AI conversations", value: selected.ai, icon: Bot },
    { label: "Upcoming bookings", value: selected.upcoming, icon: CalendarDays },
  ];

  return (
    <section className="mt-8" aria-label="Card analytics">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Card analytics</h2>
          <p className="text-xs text-muted">{dateLabel}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <span className="sr-only">Analytics period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="input w-auto py-2 text-sm">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => <option key={key} value={key}>{PERIOD_LABELS[key]}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card-surface p-5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-sm font-medium">{tile.label}</span>
              <tile.icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">{tile.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Yearly totals run from {hasOrderDate ? "your card order date" : "your card creation date"} through today; upcoming bookings count confirmed future appointments booked during the selected period.</p>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
