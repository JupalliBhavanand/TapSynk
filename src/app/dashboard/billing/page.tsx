import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, Package, Receipt as ReceiptIcon, Truck } from "lucide-react";
import { PricingTable } from "@/components/PricingTable";
import { requireDashboardData } from "@/lib/data";
import { INTERVALS, PLANS, isInterval } from "@/lib/plans";
import { isActive, type Order } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { KeepPlanButton } from "./KeepPlanButton";

const FULFILLMENT: Record<Order["fulfillment_status"], { label: string; icon: typeof Package }> = {
  processing: { label: "Processing", icon: Package },
  printing: { label: "Printing your card", icon: Package },
  shipped: { label: "Shipped", icon: Truck },
  delivered: { label: "Delivered", icon: CheckCircle2 },
};

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const sp = await searchParams;
  const { supabase, subscription, user, trialAvailable } = await requireDashboardData();
  const active = isActive(subscription);
  const { data } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];
  const requested = typeof sp.interval === "string" && isInterval(sp.interval) ? sp.interval : undefined;

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Plan & billing</h1>
      <p className="mb-8 mt-1 text-muted">
        Every new plan ships a premium smart card to the address you enter at checkout.
        {trialAvailable && <> The <strong className="text-ink">Virtual Card's first month is free</strong>: $0 today, then the plan's price.</>}
      </p>

      {sp.canceled && <p className="mb-6 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">Checkout was canceled. No payment was taken.</p>}
      {typeof sp.changed === "string" && (
        <p className="mb-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {sp.changed === "ai" ? "You're on the AI Card now. Your AI agent is unlocked." : "Your plan was changed."} Updates can take a few seconds to appear.
        </p>
      )}
      {typeof sp.scheduled === "string" && (
        <p className="mb-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Done. You keep your AI Card until the end of this billing period, then switch to the Virtual Card.</p>
      )}
      {typeof sp.kept === "string" && (
        <p className="mb-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Your scheduled switch was cancelled. You stay on your current plan.</p>
      )}

      {active && subscription && (
        <section className="card-surface mb-10 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-semibold text-muted">Current plan</p>
            <p className="mt-1 text-2xl font-bold">
              {PLANS[subscription.tier].name} <span className="text-base font-medium text-muted">· ${PLANS[subscription.tier].prices[subscription.billing_interval]}{INTERVALS[subscription.billing_interval].short}</span>
            </p>
            <p className="text-sm text-muted">
              Status: <span className="font-semibold capitalize text-ink">{subscription.status === "trialing" ? "Free month" : subscription.status.replace("_", " ")}</span>
              {subscription.current_period_end && (
                <> · {subscription.status === "trialing" ? "first charge on" : "renews"} {formatDate(subscription.current_period_end)}</>
              )}
            </p>
          </div>
          <form action="/api/stripe/portal" method="post">
            <button className="btn btn-ghost">Manage billing & invoices</button>
          </form>
          {subscription.pending_tier && subscription.pending_interval && (
            <div className="flex w-full flex-col gap-3 rounded-2xl border border-cream-line bg-cream px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-ink-2">
                <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>
                  Switching to <strong className="text-ink">{PLANS[subscription.pending_tier].name}</strong> ({INTERVALS[subscription.pending_interval].label.toLowerCase()})
                  {subscription.pending_change_at && <> on {formatDate(subscription.pending_change_at)}</>}. Your AI keeps working until then.
                </span>
              </p>
              <KeepPlanButton tier={subscription.tier} interval={subscription.billing_interval} label={`Keep ${PLANS[subscription.tier].name}`} />
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-center text-xl font-bold">{active ? "Switch plan any time" : "Choose your plan"}</h2>
        {active && (
          <p className="mx-auto mb-6 mt-2 max-w-xl text-center text-sm text-muted">
            Upgrading to the AI Card unlocks your AI agent right away and you only pay the prorated difference. Moving to the Virtual Card keeps AI until your paid period ends.
          </p>
        )}
        <div className={active ? "" : "mt-6"}>
          <PricingTable
            mode="dashboard"
            trial={trialAvailable}
            currentTier={active ? subscription?.tier : null}
            currentInterval={active ? subscription?.billing_interval : null}
            periodEnd={active ? subscription?.current_period_end : null}
            trialing={subscription?.status === "trialing"}
            initialInterval={requested ?? subscription?.billing_interval ?? "month"}
          />
        </div>
      </section>

      {orders.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-bold">Card orders & receipts</h2>
          <ul className="card-surface divide-y divide-line">
            {orders.map((o) => {
              const f = FULFILLMENT[o.fulfillment_status];
              return (
                <li key={o.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{o.company_id ? `Company · ${o.quantity} × ${PLANS[o.tier].name}` : `${PLANS[o.tier].name} · ${INTERVALS[o.billing_interval].label}`}</p>
                    <p className="font-mono text-xs text-muted">{o.receipt_number} · {formatDate(o.created_at)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2"><f.icon className="h-4 w-4 text-brand" /> {f.label}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold tabular-nums">{formatMoney(o.amount_total, o.currency)}</span>
                    <Link href={`/dashboard/billing/receipt/${o.id}`} className="btn btn-cream py-2 text-sm"><ReceiptIcon className="h-4 w-4" /> Receipt</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
