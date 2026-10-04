import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getDashboardData } from "@/lib/data";
import { isActive } from "@/lib/types";
import { AgentEditor } from "./AgentEditor";

export default async function AiPage() {
  const data = (await getDashboardData())!;
  const aiPlan = isActive(data.subscription) && data.subscription?.tier === "ai";

  return (
    <div className="fade-up mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">AI marketing agent</h1>
      <p className="mb-6 mt-1 text-muted">Your agent explains your business, answers questions and books appointments from your card.</p>

      {!data.card ? (
        <div className="card-surface p-10 text-center">
          <p className="text-muted">Create your card first, then train its AI.</p>
          <Link href="/dashboard/card" className="btn btn-primary mt-4">Create my card</Link>
        </div>
      ) : (
        <>
          {!aiPlan && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand-soft/60 px-5 py-4">
              <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
                <Sparkles className="h-4 w-4 text-brand" /> Set up and test your AI now. The “Talk to AI” button appears on your card with the AI Card plan.
              </p>
              <Link href="/dashboard/billing" className="btn btn-primary py-2 text-sm">Get the AI Card</Link>
            </div>
          )}
          <AgentEditor initial={data.agent} slug={data.card.slug} businessName={data.card.company || data.card.full_name} ownerName={data.card.full_name} />
        </>
      )}
    </div>
  );
}
