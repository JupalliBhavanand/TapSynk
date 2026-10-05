import "server-only";
import { emptyTotals, sinceIso, summarize, type Totals } from "@/lib/analytics";
import { getDashboardData } from "@/lib/data";
import type { Card, CardEvent } from "@/lib/types";

/** Employee cards plus their last-30-day numbers, for the team and analytics pages. */
export async function getCompanyTeam() {
  const data = (await getDashboardData())!;
  const { supabase, company } = data;
  if (!company) return { ...data, cards: [] as Card[], perCard: {} as Record<string, Totals>, summary: summarize([]) };
  const [{ data: cards }, { data: events }] = await Promise.all([
    supabase.from("cards").select("*").eq("company_id", company.id).order("created_at"),
    supabase.from("card_events").select("card_id, kind, source, created_at").eq("company_id", company.id).gte("created_at", sinceIso()).limit(50000),
  ]);
  const list = (events ?? []) as CardEvent[];
  const perCard: Record<string, Totals> = {};
  for (const e of list) (perCard[e.card_id] ??= emptyTotals())[e.kind] += 1;
  return { ...data, cards: (cards ?? []) as Card[], perCard, summary: summarize(list) };
}
