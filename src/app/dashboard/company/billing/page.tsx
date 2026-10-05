import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt as ReceiptIcon } from "lucide-react";
import { CompanyBill } from "@/components/CompanyPlanPicker";
import { getDashboardData } from "@/lib/data";
import { PLANS } from "@/lib/plans";
import { isActive, type Order } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { PlanChanger } from "./PlanChanger";

export default async function CompanyBillingPage({ searchParams }: PageProps<"/dashboard/company/billing">) {
  const sp = await searchParams;
  const { supabase, company } = (await getDashboardData())!;
  if (!company || !isActive(company)) redirect("/dashboard/company");
  const [{ count }, { data }] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("orders").select("*").eq("company_id", company.id).order("created_at", { ascending: false }),
  ]);
  const orders = (data ?? []) as Order[];

  return (
    <div className="space-y-8">
      {typeof sp.changed === "string" && (
        <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">Your team plan was updated. The difference shows on your next monthly bill.</p>
      )}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card-surface p-6">
          <p className="text-sm font-semibold text-muted">Current plan</p>
          <p className="mt-1 text-2xl font-bold">{company.seats} × {PLANS[company.tier].name}</p>
          <p className="text-sm text-muted">
            Status: <span className="font-semibold capitalize text-ink">{company.status.replace("_", " ")}</span>
            {company.current_period_end && <> · next bill {new Date(company.current_period_end).toLocaleDateString()}</>}
          </p>
          <p className="mt-1 text-sm text-muted">{count ?? 0} of {company.seats} cards in use</p>
          <form action="/api/stripe/portal" method="post" className="mt-5">
            <input type="hidden" name="kind" value="company" />
            <button className="btn btn-ghost">Monthly invoices & payment method</button>
          </form>
        </div>
        <CompanyBill tier={company.tier} seats={company.seats} />
      </section>

      <section className="card-surface p-6">
        <h2 className="mb-5 font-bold">Change seats or card type</h2>
        <PlanChanger tier={company.tier} seats={company.seats} used={count ?? 0} />
      </section>

      {orders.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Card orders & receipts</h2>
          <ul className="card-surface divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{o.quantity} × {PLANS[o.tier].name} cards</p>
                  <p className="font-mono text-xs text-muted">{o.receipt_number} · {new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold tabular-nums">{formatMoney(o.amount_total, o.currency)}</span>
                  <Link href={`/dashboard/billing/receipt/${o.id}`} className="btn btn-cream py-2 text-sm"><ReceiptIcon className="h-4 w-4" /> Receipt</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
