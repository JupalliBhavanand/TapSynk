import Link from "next/link";
import { CheckCircle2, Package, Receipt as ReceiptIcon, Truck } from "lucide-react";
import { PricingTable } from "@/components/PricingTable";
import { getDashboardData } from "@/lib/data";
import { INTERVALS, PLANS, isInterval } from "@/lib/plans";
import { isActive, type Order } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

const FULFILLMENT: Record<Order["fulfillment_status"], { label: string; icon: typeof Package }> = {
  processing: { label: "Processing", icon: Package },
  printing: { label: "Printing your card", icon: Package },
  shipped: { label: "Shipped", icon: Truck },
  delivered: { label: "Delivered", icon: CheckCircle2 },
};

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const sp = await searchParams;
  const { supabase, subscription, user, trialAvailable } = (await getDashboardData())!;
  const active = isActive(subscription);
  const { data } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];
  const requested = typeof sp.interval === "string" && isInterval(sp.interval) ? sp.interval : undefined;

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Plan & billing</h1>
      <p className="mb-8 mt-1 text-muted">
        Every new plan ships a premium NFC card to the address you enter at checkout.
        {trialAvailable && <> Your <strong className="text-ink">first month is free</strong>: $0 today, then your plan's price.</>}
      </p>

      {sp.canceled && <p className="mb-6 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">Checkout was canceled. No payment was taken.</p>}
      {typeof sp.changed === "string" && (
        <p className="mb-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Your plan was changed. Updates can take a few seconds to appear.</p>
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
                <> · {subscription.status === "trialing" ? "first charge on" : "renews"} {new Date(subscription.current_period_end).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <form action="/api/stripe/portal" method="post">
            <button className="btn btn-ghost">Manage billing & invoices</button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-6 text-center text-xl font-bold">{active ? "Change plan" : "Choose your plan"}</h2>
        <PricingTable mode="dashboard" trial={trialAvailable} currentTier={active ? subscription?.tier : null} initialInterval={requested ?? subscription?.billing_interval ?? "year"} />
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
                    <p className="font-mono text-xs text-muted">{o.receipt_number} · {new Date(o.created_at).toLocaleDateString()}</p>
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
