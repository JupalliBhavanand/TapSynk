import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MousePointerClick, Trophy } from "lucide-react";
import { linkClickRows, linkSince, type LinkClickTotal, type LinkPeriod } from "@/lib/profile-links";
import type { Card } from "@/lib/types";

/** Always use the authenticated client. The aggregate RPC retains the caller's RLS. */
export async function PerLinkAnalytics({ supabase, cards, period, team = false }: { supabase: SupabaseClient; cards: Card[]; period: LinkPeriod; team?: boolean }) {
  const result = cards.length
    ? await supabase.rpc("link_click_totals", { p_card_ids: cards.map((card) => card.id), p_since: linkSince(period) })
    : { data: [], error: null };
  if (result.error) console.error("Link analytics query failed", result.error.code);
  const rows = linkClickRows(cards, Array.isArray(result.data) ? result.data as LinkClickTotal[] : []);
  const total = rows.reduce((sum, row) => sum + row.clicks, 0);
  const top = rows[0]?.clicks ? rows[0] : null;
  return (
    <section className="card-surface overflow-hidden" aria-labelledby="per-link-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div><h2 id="per-link-heading" className="flex items-center gap-2 font-bold"><MousePointerClick className="h-4 w-4 text-brand" />Per-Link Clicks</h2><p className="mt-1 text-sm text-muted">Clicks on currently configured profile links{team ? " across your team" : ""}.</p></div>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="link-period" className="sr-only">Link clicks time range</label>
          <select id="link-period" name="links" defaultValue={period} className="input w-auto py-2 text-sm"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select>
          <button type="submit" className="btn btn-ghost px-3 py-2 text-sm">Apply</button>
        </form>
      </div>
      {result.error ? <p role="status" className="px-6 pb-6 text-sm text-muted">Link analytics are temporarily unavailable. Please try again later.</p> : !rows.length ? <p className="px-6 pb-6 text-sm text-muted">Add a website or contact/social links to your profile to see their performance here.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line bg-bg/60 px-6 py-4"><p className="text-sm"><strong className="text-xl tabular-nums">{total.toLocaleString()}</strong> <span className="text-muted">total link clicks</span></p>{top && <p className="flex items-center gap-2 text-sm font-medium text-brand"><Trophy className="h-4 w-4" />Top link: {top.label}{team && ` · ${top.profileName}`}</p>}</div>
        <div className="overflow-x-auto"><table className="w-full table-fixed text-left text-sm sm:table-auto"><thead className="text-xs uppercase text-muted"><tr><th scope="col" className="w-[48%] px-6 py-3 sm:w-auto">Link</th>{team && <th scope="col" className="hidden px-4 py-3 md:table-cell">Profile</th>}<th scope="col" className="px-2 py-3 text-right sm:px-4">Clicks</th><th scope="col" className="px-3 py-3 text-right sm:px-6">Share</th></tr></thead><tbody className="divide-y divide-line">{rows.map((row) => <tr key={`${row.cardId}:${row.id}`} className={top === row ? "bg-brand-soft/40" : undefined}><th scope="row" className="max-w-[22rem] px-6 py-4 font-medium"><span className="block">{row.label}</span>{team && <span className="mt-1 block truncate text-xs font-normal text-muted md:hidden">{row.profileName || "Team member"}</span>}<span className="mt-1 block truncate text-xs font-normal text-muted" title={row.href}>{row.href}</span></th>{team && <td className="hidden px-4 py-4 md:table-cell">{row.profileName || "Team member"}</td>}<td className="px-2 py-4 text-right font-semibold tabular-nums sm:px-4">{row.clicks.toLocaleString()}</td><td className="px-3 py-4 text-right tabular-nums text-muted sm:px-6">{row.share.toFixed(1)}%</td></tr>)}</tbody></table></div>
        <p className="border-t border-line px-6 py-4 text-xs text-muted">Shares use clicks on currently configured destinations. Changed or removed URLs do not inflate a replacement link. Tracking starts when this feature is enabled; it cannot reconstruct past clicks.</p>
      </>}
    </section>
  );
}
