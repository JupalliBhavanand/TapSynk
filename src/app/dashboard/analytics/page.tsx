import Link from "next/link";
import { DailyViews, SourceSplit, StatTiles } from "@/components/Analytics";
import { summarize, sinceIso } from "@/lib/analytics";
import { requireDashboardData } from "@/lib/data";
import type { CardEvent } from "@/lib/types";

export default async function AnalyticsPage() {
  const { supabase, card } = await requireDashboardData();
  const { data } = card
    ? await supabase.from("card_events").select("kind, source, created_at").eq("card_id", card.id).gte("created_at", sinceIso()).limit(20000)
    : { data: [] };
  const summary = summarize((data ?? []) as CardEvent[]);

  return (
    <div className="fade-up mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
      <p className="mb-8 mt-1 text-muted">How your card performed over the last 30 days.</p>
      {!card ? (
        <div className="card-surface p-10 text-center">
          <p className="text-muted">Create your card to start collecting analytics.</p>
          <Link href="/dashboard/card" className="btn btn-primary mt-4">Create my card</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <StatTiles totals={summary.totals} />
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <DailyViews daily={summary.daily} />
            <SourceSplit sources={summary.sources} />
          </div>
          <p className="text-sm text-muted">
            All-time: {card.views.toLocaleString()} views · {card.saves.toLocaleString()} contacts saved · {card.ai_opens.toLocaleString()} AI chats.
          </p>
        </div>
      )}
    </div>
  );
}
