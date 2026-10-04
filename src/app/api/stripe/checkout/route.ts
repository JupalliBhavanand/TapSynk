import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { priceData } from "@/lib/billing";
import { SITE_URL } from "@/lib/env";
import { PLANS, SHIPPING_COUNTRIES } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
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

    // Plan change for an existing subscriber: swap the price in place with proration.
    if (isActive(current) && current?.stripe_subscription_id) {
      if (current.tier === tier && current.billing_interval === interval) {
        return NextResponse.json({ error: "You're already on this plan." }, { status: 400 });
      }
      const sub = await stripe().subscriptions.retrieve(current.stripe_subscription_id);
      await stripe().subscriptions.update(sub.id, {
        items: [{ id: sub.items.data[0]!.id, price_data: await priceData(tier, interval) }],
        proration_behavior: "always_invoice",
        metadata,
      });
      return NextResponse.json({ url: `/dashboard/billing?changed=${tier}` });
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price_data: await priceData(tier, interval), quantity: 1 }],
      ...(current?.stripe_customer_id ? { customer: current.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata,
      subscription_data: { metadata, description: `TapSync ${PLANS[tier].name}` },
      shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
      phone_number_collection: { enabled: true },
      custom_text: {
        shipping_address: { message: "We'll print your NFC card and ship it here for free." },
        submit: { message: "Your plan starts today and your card ships within 3–5 business days." },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${SITE_URL}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/dashboard/billing?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Checkout error", e);
    return NextResponse.json({ error: "Payments aren't available right now. Please try again." }, { status: 500 });
  }
}
