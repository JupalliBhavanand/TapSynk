import { notFound } from "next/navigation";
import { requireDashboardData } from "@/lib/data";
import { isAdminEmail, SITE_URL } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Card, Order } from "@/lib/types";
import { FulfillmentOrders, type CardPrintDetails, type FulfillmentOrder } from "./FulfillmentOrders";

export const metadata = { title: "Card fulfillment" };

/** Global shipping queue. Only emails listed in ADMIN_EMAILS can open this page. */
export default async function FulfillmentPage() {
  const { user } = await requireDashboardData();
  if (!isAdminEmail(user.email)) notFound();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id,user_id,receipt_number,tier,billing_interval,amount_total,currency,shipping_name,shipping_address,fulfillment_status,company_id,quantity,created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  let fulfillmentOrders: FulfillmentOrder[] = [];
  let cardDetailsError = false;
  if (!error && data?.length) {
    const orders = data as Pick<Order, "id" | "user_id" | "receipt_number" | "tier" | "billing_interval" | "amount_total" | "currency" | "shipping_name" | "shipping_address" | "fulfillment_status" | "company_id" | "quantity" | "created_at">[];
    const personalUserIds = [...new Set(orders.filter((order) => !order.company_id).map((order) => order.user_id))];
    const companyIds = [...new Set(orders.flatMap((order) => order.company_id ? [order.company_id] : []))];
    const cardSelect = "user_id,company_id,slug,full_name,job_title,company,accent,logo_url";
    const cardsByUser = new Map<string, CardPrintDetails>();
    const cardsByCompany = new Map<string, CardPrintDetails[]>();

    if (personalUserIds.length) {
      const { data: cards, error: cardsError } = await admin.from("cards").select(cardSelect).in("user_id", personalUserIds).is("company_id", null);
      cardDetailsError ||= Boolean(cardsError);
      for (const card of (cards ?? []) as Pick<Card, "user_id" | "company_id" | "slug" | "full_name" | "job_title" | "company" | "accent" | "logo_url">[]) {
        cardsByUser.set(card.user_id, card);
      }
    }

    if (companyIds.length) {
      const { data: cards, error: cardsError } = await admin.from("cards").select(cardSelect).in("company_id", companyIds).order("created_at");
      cardDetailsError ||= Boolean(cardsError);
      for (const card of (cards ?? []) as Pick<Card, "user_id" | "company_id" | "slug" | "full_name" | "job_title" | "company" | "accent" | "logo_url">[]) {
        if (!card.company_id) continue;
        cardsByCompany.set(card.company_id, [...(cardsByCompany.get(card.company_id) ?? []), card]);
      }
    }

    fulfillmentOrders = orders.map((order) => ({
      id: order.id,
      receipt_number: order.receipt_number,
      tier: order.tier,
      billing_interval: order.billing_interval,
      amount_total: order.amount_total,
      currency: order.currency,
      shipping_name: order.shipping_name,
      shipping_address: order.shipping_address,
      fulfillment_status: order.fulfillment_status,
      company_id: order.company_id,
      quantity: order.quantity,
      created_at: order.created_at,
      cardDetails: order.company_id
        ? cardsByCompany.get(order.company_id) ?? []
        : cardsByUser.has(order.user_id) ? [cardsByUser.get(order.user_id)!] : [],
    }));
  }

  return (
    <div className="fade-up mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">Card fulfillment</h1>
      <p className="mt-1 text-muted">Review paid card orders, confirm shipping addresses, and update delivery status.</p>
      {error ? (
        <p className="mt-8 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">
          Couldn&apos;t load orders. Check the Supabase orders table and service role configuration.
        </p>
      ) : (
        <FulfillmentOrders orders={fulfillmentOrders} cardDetailsError={cardDetailsError} siteUrl={SITE_URL} />
      )}
    </div>
  );
}
