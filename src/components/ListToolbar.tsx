"use client";

import { useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** True after hydration. Lists that depend on the viewer's clock and timezone render then. */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" style={{ paddingLeft: "2.5rem", paddingRight: "2.25rem" }} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

export function Chips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number; dot?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
              on ? "border-navy bg-navy text-white shadow" : "border-line bg-white text-ink-2 hover:border-[#cfd5e1] hover:text-ink",
            )}
          >
            {o.dot && <span className={cn("h-2 w-2 rounded-full", o.dot)} />}
            {o.label}
            {o.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-white/15" : "bg-bg text-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  icon: Icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="relative block shrink-0">
      <span className="sr-only">{label}</span>
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="input w-full cursor-pointer py-2.5 text-sm font-medium sm:w-auto" style={Icon ? { paddingLeft: "2.25rem" } : undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Lower-case text match across several fields. */
export function matches(query: string, ...fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="card-surface mt-4 p-10 text-center">
      <p className="font-semibold">Nothing matches these filters.</p>
      <button type="button" onClick={onClear} className="btn btn-ghost mt-4 py-2 text-sm">Clear filters</button>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card-surface mt-4 divide-y divide-line" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-5">
          <div className="h-10 w-10 animate-pulse rounded-full bg-bg" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-bg" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-bg" />
          </div>
        </div>
      ))}
    </div>
  );
}
