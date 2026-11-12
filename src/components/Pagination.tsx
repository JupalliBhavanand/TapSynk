"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function usePagination<T>(items: T[], scope: string) {
  const [state, setState] = useState({ scope, page: 1, size: 20 });
  const pages = Math.max(1, Math.ceil(items.length / state.size));
  const page = Math.min(state.scope === scope ? state.page : 1, pages);
  return {
    items: items.slice((page - 1) * state.size, page * state.size),
    props: { page, pages, size: state.size, total: items.length,
      onPage: (next: number) => setState({ ...state, scope, page: Math.max(1, Math.min(pages, next)) }),
      onSize: (size: number) => setState({ scope, page: 1, size }),
    },
  };
}

export function Pagination({ page, pages, size, total, onPage, onSize }: { page: number; pages: number; size: number; total: number; onPage: (page: number) => void; onSize: (size: number) => void }) {
  if (!total) return null;
  return <nav aria-label="List pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-xs">
    <span className="text-muted">{(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}</span>
    <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-muted">Per page<select aria-label="Rows per page" value={size} onChange={e => onSize(Number(e.target.value))} className="rounded-md border border-line p-1.5 text-ink">{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border border-line p-2 disabled:opacity-30"><ChevronLeft size={14} /></button>
      <span aria-live="polite">{page} / {pages}</span>
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-md border border-line p-2 disabled:opacity-30"><ChevronRight size={14} /></button>
    </div>
  </nav>;
}
