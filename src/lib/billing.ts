import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERVALS, PLANS, companyQuote, isInterval, isTier, type BillingInterval, type Tier } from "@/lib/plans";
import { stripe } from "@/lib/stripe";

/** Products get fixed ids so prices can be created inline from lib/plans.ts without dashboard setup. */
export async function ensureProduct(tier: Tier, company = false) {
  const id = company ? `tapsync_company_${tier}` : `tapsync_${tier}`;
  const name = company ? `TapSynk Company · ${PLANS[tier].name} (per employee)` : `TapSynk ${PLANS[tier].name}`;
  let product: Stripe.Product;
  try {
    product = await stripe().products.retrieve(id);
  } catch {
    try {
      await stripe().products.create({
        id,
        name,
        description: company ? "Monthly price per employee card, team discount applied." : PLANS[tier].tagline,
      });
    } catch (e) {
      // Another request created it at the same moment.
      if ((e as { code?: string }).code !== "resource_already_exists") throw e;
      await stripe().products.update(id, { name });
    }
    return id;
  }
  // Rebrand existing checkout products without changing their stable IDs or prices.
  if (product.name !== name) await stripe().products.update(id, { name });
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

/** Per-seat monthly price for a company; the discount bracket depends on the seat count. */
export async function companyPriceData(tier: Tier, seats: number) {
  return {
    currency: "usd",
    product: await ensureProduct(tier, true),
    unit_amount: companyQuote(tier, seats).unit,
    recurring: { interval: "month" as const, interval_count: 1 },
  };
}

function receiptNumber(sessionId: string, created: number) {
  const d = new Date(created * 1000);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `TXN-${ymd}-${sessionId.slice(-8).toUpperCase()}`;
}

/** Mirrors a company's Stripe subscription onto its companies row. */
async function syncCompany(sub: Stripe.Subscription) {
  const companyId = sub.metadata?.company_id;
  if (!companyId) return;
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;
  const tier = sub.metadata?.tier;
  await createAdminClient()
    .from("companies")
    .update({
      status: sub.status,
      ...(isTier(tier) ? { tier } : {}),
      ...(item?.quantity ? { seats: item.quantity } : {}),
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
}

/** Mirrors a Stripe subscription into Supabase. Safe to call repeatedly. */
export async function syncSubscription(sub: Stripe.Subscription) {
  if (sub.metadata?.kind === "company") return syncCompany(sub);
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
  // A scheduled switch is done once Stripe has applied it, or was dropped if the schedule is gone.
  const pending = createAdminClient().from("subscriptions").update({ pending_tier: null, pending_interval: null, pending_change_at: null, stripe_schedule_id: null }).eq("user_id", userId);
  if (!sub.schedule) await pending;
  else if (isTier(tier) && isInterval(interval)) await pending.eq("pending_tier", tier).eq("pending_interval", interval);
}

/** Stops a scheduled switch; the subscription carries on unchanged. */
export async function releaseSchedule(scheduleId: string | null | undefined) {
  if (!scheduleId) return;
  try {
    await stripe().subscriptionSchedules.release(scheduleId);
  } catch (e) {
    // Already released or finished.
    if ((e as { code?: string }).code !== "resource_missing" && !/released|completed|canceled/i.test(String((e as Error).message))) throw e;
  }
}

/**
 * Keeps the current plan until the paid period ends, then moves to the new one
 * (used for AI Card → Virtual Card, so nobody loses AI time they paid for).
 * Returns when the switch happens.
 */
export async function scheduleSwitchAtPeriodEnd(sub: Stripe.Subscription, tier: Tier, interval: BillingInterval) {
  await releaseSchedule(typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id);
  const item = sub.items.data[0]!;
  const schedule = await stripe().subscriptionSchedules.create({ from_subscription: sub.id });
  const now = schedule.phases[0]!;
  // Promo codes used at checkout stay on the current phase.
  const discounts = (now.discounts ?? []).flatMap((d): Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[] =>
    d.discount ? [{ discount: typeof d.discount === "string" ? d.discount : d.discount.id }] : d.coupon ? [{ coupon: typeof d.coupon === "string" ? d.coupon : d.coupon.id }] : [],
  );
  await stripe().subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
        start_date: now.start_date,
        end_date: item.current_period_end,
        proration_behavior: "none",
        metadata: { ...sub.metadata },
        ...(discounts.length ? { discounts } : {}),
      },
      {
        items: [{ price_data: await priceData(tier, interval), quantity: 1 }],
        duration: INTERVALS[interval].stripe,
        proration_behavior: "none",
        metadata: { ...sub.metadata, tier, interval },
      },
    ],
  });
  return { scheduleId: schedule.id, at: new Date(item.current_period_end * 1000).toISOString() };
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
  const isCompany = session.metadata?.kind === "company";
  const companyId = isCompany ? session.metadata?.company_id ?? null : null;
  const quantity = Number(session.metadata?.seats) || 1;

  const pm = sub?.default_payment_method as Stripe.PaymentMethod | null | undefined;
  const shipping = session.collected_information?.shipping_details;
  const admin = createAdminClient();
  // The free month can only be used once per account.
  if (!isCompany && sub?.status === "trialing") {
    await admin.from("profiles").update({ trial_used_at: new Date().toISOString() }).eq("id", userId).is("trial_used_at", null);
  }
  await admin.from("orders").upsert(
    {
      user_id: userId,
      stripe_session_id: session.id,
      receipt_number: receiptNumber(session.id, session.created),
      tier,
      billing_interval: interval,
      company_id: companyId,
      quantity,
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
