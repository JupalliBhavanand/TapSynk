import Link from "next/link";
import { AiLocked } from "@/components/AiLocked";
import { requireDashboardData } from "@/lib/data";
import { hasAi, isActive } from "@/lib/types";
import { AgentEditor } from "./AgentEditor";

export default async function AiPage() {
  const data = await requireDashboardData();
  const { subscription } = data;

  return (
    <div className="fade-up mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">AI marketing agent</h1>
      <p className="mb-6 mt-1 text-muted">Your agent explains your business, answers questions and books appointments from your card.</p>

      {!hasAi(subscription) ? (
        <AiLocked upgradeInterval={isActive(subscription) && subscription?.stripe_subscription_id ? subscription.billing_interval : undefined} />
      ) : !data.card ? (
        <div className="card-surface p-10 text-center">
          <p className="text-muted">Create your card first, then train its AI.</p>
          <Link href="/dashboard/card" className="btn btn-primary mt-4">Create my card</Link>
        </div>
      ) : (
        <AgentEditor initial={data.agent} slug={data.card.slug} businessName={data.card.company || data.card.full_name} ownerName={data.card.full_name} />
      )}
    </div>
  );
}
