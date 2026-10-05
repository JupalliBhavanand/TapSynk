import { redirect } from "next/navigation";
import { DailyViews, SourceSplit, StatTiles } from "@/components/Analytics";
import { emptyTotals, rate } from "@/lib/analytics";
import { getCompanyTeam } from "@/lib/company";
import { isActive } from "@/lib/types";

export default async function CompanyAnalyticsPage() {
  const { company, cards, perCard, summary } = await getCompanyTeam();
  if (!company || !isActive(company)) redirect("/dashboard/company");
  const ranked = [...cards].sort((a, b) => (perCard[b.id]?.view ?? 0) - (perCard[a.id]?.view ?? 0));
  const maxViews = Math.max(1, ...ranked.map((c) => perCard[c.id]?.view ?? 0));

  return (
    <div className="space-y-6">
      <p className="text-muted">Team performance over the last 30 days across {cards.length} cards.</p>
      <StatTiles totals={summary.totals} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <DailyViews daily={summary.daily} />
        <SourceSplit sources={summary.sources} />
      </div>
      <section className="card-surface p-6">
        <h2 className="font-bold">Leaderboard</h2>
        <p className="text-sm text-muted">Ranked by card views. Conversion is the share of views that became a saved contact, lead or booking.</p>
        {ranked.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Add employee cards to see how each one performs.</p>
        ) : (
          <ol className="mt-5 space-y-4">
            {ranked.map((c, i) => {
              const t = perCard[c.id] ?? emptyTotals();
              return (
                <li key={c.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-muted">#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-semibold">{c.full_name}<span className="font-normal text-muted"> · {c.job_title || "Team member"}</span></span>
                      <span className="shrink-0 tabular-nums text-muted">{t.view} views</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(t.view / maxViews) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-20 text-right text-xs text-muted">{rate(t.save + t.lead + t.booking, t.view)} conv.</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
