import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERVALS, PLANS, isInterval, isTier, type BillingInterval, type Tier } from "@/lib/plans";
import { stripe } from "@/lib/stripe";

/** Products get fixed ids so prices can be created inline from lib/plans.ts without dashboard setup. */
export async function ensureProduct(tier: Tier) {
  const id = `tapsync_${tier}`;
  try {
    await stripe().products.retrieve(id);
  } catch {
    try {
      await stripe().products.create({
        id,
        name: `TapSync ${PLANS[tier].name}`,
        description: PLANS[tier].tagline,
      });
    } catch (e) {
      // Another request created it at the same moment.
      if ((e as { code?: string }).code !== "resource_already_exists") throw e;
    }
  }
  return id;
}

export async function priceData(tier: Tier, interval: BillingInterval) {
  return {
    currency: "usd",
    product: await ensureProduct(tier),
    unit_amount: PLANS[tier].prices[interval] * 100,
    recurring: INTERVALS[interval].stripe,
  };
}

function receiptNumber(sessionId: string, created: number) {
  const d = new Date(created * 1000);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `TXN-${ymd}-${sessionId.slice(-8).toUpperCase()}`;
}

/** Mirrors a Stripe subscription into Supabase. Safe to call repeatedly. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) return;
  const tier = sub.metadata?.tier;
  const interval = sub.metadata?.interval;
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;
  await createAdminClient()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        tier: isTier(tier) ? tier : "virtual",
        billing_interval: isInterval(interval) ? interval : "month",
        status: sub.status,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
}

/**
 * Records a completed checkout: subscription + paid order with shipping address.
 * Called by the webhook and by the success page (whichever runs first), so it is idempotent.
 */
export async function fulfillCheckout(sessionId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "subscription.default_payment_method"],
  });
  if (session.status !== "complete" || session.payment_status === "unpaid") return null;
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const tier = session.metadata?.tier;
  const interval = session.metadata?.interval;
  if (!userId || !isTier(tier) || !isInterval(interval)) return null;

  const sub = session.subscription as Stripe.Subscription | null;
  if (sub) await syncSubscription(sub);

  const pm = sub?.default_payment_method as Stripe.PaymentMethod | null | undefined;
  const shipping = session.collected_information?.shipping_details;
  const admin = createAdminClient();
  await admin.from("orders").upsert(
    {
      user_id: userId,
      stripe_session_id: session.id,
      receipt_number: receiptNumber(session.id, session.created),
      tier,
      billing_interval: interval,
      amount_subtotal: session.amount_subtotal ?? 0,
      amount_discount: session.total_details?.amount_discount ?? 0,
      amount_tax: session.total_details?.amount_tax ?? 0,
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      card_brand: pm?.card?.brand ?? null,
      card_last4: pm?.card?.last4 ?? null,
      shipping_name: shipping?.name ?? session.customer_details?.name ?? null,
      shipping_address: shipping?.address ?? null,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  return { userId, sessionId: session.id };
}
