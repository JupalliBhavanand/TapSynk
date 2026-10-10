import { NextResponse, type NextRequest } from "next/server";
import { checkoutFailure } from "@/lib/checkout-error";
import { z } from "zod";
import { priceData, releaseSchedule, scheduleSwitchAtPeriodEnd } from "@/lib/billing";
import { SITE_URL } from "@/lib/env";
import { INTERVALS, PLANS, SHIPPING_COUNTRIES, TRIAL_DAYS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { isActive, type Subscription } from "@/lib/types";

const body = z.object({ tier: z.enum(["virtual", "ai"]), interval: z.enum(["month", "quarter", "year"]) });

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  if (!(await rateLimit(`checkout:${user.id}`, 10, 600))) return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  const { tier, interval } = parsed.data;
  const metadata = { user_id: user.id, tier, interval };

  try {
    const { data: existing } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    const current = existing as Subscription | null;

    // Plan change for an existing subscriber. Customers can switch between Virtual and AI any time:
    // - Virtual → AI (or a new billing period) starts now; the price difference is prorated and charged today.
    // - AI → Virtual starts when the paid period ends, so they keep the AI they already paid for.
    if (isActive(current) && current?.stripe_subscription_id) {
      const admin = createAdminClient();
      const clearPending = () =>
        admin.from("subscriptions").update({ pending_tier: null, pending_interval: null, pending_change_at: null, stripe_schedule_id: null }).eq("user_id", user.id);
      const sub = await stripe().subscriptions.retrieve(current.stripe_subscription_id);
      const scheduleId = typeof sub.schedule === "string" ? sub.schedule : (sub.schedule?.id ?? null);

      if (current.tier === tier && current.billing_interval === interval) {
        // Picking the current plan again cancels a switch that hasn't happened yet.
        if (!scheduleId && !current.pending_tier) return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
        await releaseSchedule(scheduleId);
        await clearPending();
        return NextResponse.json({ url: `/dashboard/billing?kept=${tier}` });
      }
      if (current.pending_tier === tier && current.pending_interval === interval && scheduleId) {
        return NextResponse.json({ error: "This switch is already scheduled." }, { status: 400 });
      }

      if (current.tier === "ai" && tier === "virtual" && sub.status !== "trialing") {
        const { scheduleId: id, at } = await scheduleSwitchAtPeriodEnd(sub, tier, interval);
        await admin
          .from("subscriptions")
          .update({ pending_tier: tier, pending_interval: interval, pending_change_at: at, stripe_schedule_id: id })
          .eq("user_id", user.id);
        return NextResponse.json({ url: `/dashboard/billing?scheduled=${tier}` });
      }

      await releaseSchedule(scheduleId);
      // The new plan only applies once the prorated charge goes through.
      // The free month is for the Virtual Card only, so moving to AI ends it and AI is charged from today.
      const endTrial = tier === "ai" && sub.status === "trialing";
      const updated = await stripe().subscriptions.update(sub.id, {
        items: [{ id: sub.items.data[0]!.id, price_data: await priceData(tier, interval) }],
        proration_behavior: "always_invoice",
        payment_behavior: "pending_if_incomplete",
        ...(endTrial ? { trial_end: "now" as const } : {}),
      });
      if (updated.pending_update) {
        return NextResponse.json({ error: "Your card was declined, so your plan wasn't changed. Update your card under “Manage billing” and try again." }, { status: 402 });
      }
      await stripe().subscriptions.update(sub.id, { metadata });
      // Unlock (or lock) AI features right away; the webhook confirms the same values.
      await admin
        .from("subscriptions")
        .update({ tier, billing_interval: interval, pending_tier: null, pending_interval: null, pending_change_at: null, stripe_schedule_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return NextResponse.json({ url: `/dashboard/billing?changed=${tier}` });
    }

    // First month free on the Virtual Card only, once per account (never after a previous subscription).
    // AI Card plans are charged from day one.
    const { data: profile } = await supabase.from("profiles").select("trial_used_at").eq("id", user.id).maybeSingle();
    const trial = tier === "virtual" && !current && !profile?.trial_used_at;
    const price = `$${PLANS[tier].prices[interval]}${INTERVALS[interval].short}`;

    const session = await stripe().checkout.sessions.create({
      // TapSynk uses standard Checkout with custom copy and physical card shipping.
      managed_payments: { enabled: false },
      mode: "subscription",
      line_items: [{ price_data: await priceData(tier, interval), quantity: 1 }],
      ...(current?.stripe_customer_id ? { customer: current.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata,
      subscription_data: {
        metadata,
        description: `TapSynk ${PLANS[tier].name}`,
        ...(trial ? { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } } } : {}),
      },
      payment_method_collection: "always",
      shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
      phone_number_collection: { enabled: true },
      custom_text: {
        shipping_address: { message: "We'll print your smart card and ship it here for free." },
        submit: {
          message: trial
            ? `You pay $0 today. Your first ${TRIAL_DAYS} days are free, then ${price}. Cancel any time before then and you won't be charged. Your card ships within 3–5 business days.`
            : "Your plan starts today and your card ships within 3–5 business days.",
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${SITE_URL}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/dashboard/billing?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if ((e as { type?: string }).type === "StripeCardError") {
      return NextResponse.json({ error: "Your card was declined, so your plan wasn't changed. Update your card under “Manage billing” and try again." }, { status: 402 });
    }
    const failure = checkoutFailure(e);
    console.error("Checkout error", failure.diagnostics);
    return NextResponse.json({ error: failure.message }, { status: 500 });
  }
}
