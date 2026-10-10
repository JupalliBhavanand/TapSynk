import { NextResponse, type NextRequest } from "next/server";
import { checkoutFailure } from "@/lib/checkout-error";
import { z } from "zod";
import { companyPriceData } from "@/lib/billing";
import { SITE_URL } from "@/lib/env";
import { COMPANY_MAX_SEATS, COMPANY_MIN_SEATS, PLANS, SHIPPING_COUNTRIES, companyQuote } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { isActive, type Company } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

const body = z.object({
  tier: z.enum(["virtual", "ai"]),
  seats: z.number().int().min(COMPANY_MIN_SEATS).max(COMPANY_MAX_SEATS),
});

/** Starts (or changes) a company's monthly per-seat subscription. Companies get no free trial. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `Choose between ${COMPANY_MIN_SEATS} and ${COMPANY_MAX_SEATS} cards.` }, { status: 400 });
  if (!(await rateLimit(`company-checkout:${user.id}`, 10, 600))) return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });

  const { data } = await supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle();
  const company = data as Company | null;
  if (!company) return NextResponse.json({ error: "Set up your company first." }, { status: 400 });
  const { tier, seats } = parsed.data;

  const { count } = await supabase.from("cards").select("id", { count: "exact", head: true }).eq("company_id", company.id);
  if ((count ?? 0) > seats) return NextResponse.json({ error: `You have ${count} employee cards. Remove some before going below that.` }, { status: 400 });

  const metadata = { kind: "company", user_id: user.id, company_id: company.id, tier, seats: String(seats), interval: "month" };
  const quote = companyQuote(tier, seats);

  try {
    // Existing company: change seats or card type in place, prorated on the next monthly bill.
    if (isActive(company) && company.stripe_subscription_id) {
      if (company.tier === tier && company.seats === seats) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
      const sub = await stripe().subscriptions.retrieve(company.stripe_subscription_id);
      await stripe().subscriptions.update(sub.id, {
        items: [{ id: sub.items.data[0]!.id, price_data: await companyPriceData(tier, seats), quantity: seats }],
        proration_behavior: "create_prorations",
        metadata,
      });
      // Keep the seat limit in step right away; the webhook confirms it.
      await createAdminClient().from("companies").update({ tier, seats, updated_at: new Date().toISOString() }).eq("id", company.id);
      return NextResponse.json({ url: "/dashboard/company/billing?changed=1" });
    }

    await createAdminClient().from("companies").update({ tier, seats, updated_at: new Date().toISOString() }).eq("id", company.id);
    const session = await stripe().checkout.sessions.create({
      // Account-level Managed Payments defaults reject our custom checkout copy.
      managed_payments: { enabled: false },
      mode: "subscription",
      line_items: [{ price_data: await companyPriceData(tier, seats), quantity: seats }],
      ...(company.stripe_customer_id ? { customer: company.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata,
      subscription_data: { metadata, description: `TapSynk Company · ${company.name} · ${seats} × ${PLANS[tier].name}` },
      shipping_address_collection: { allowed_countries: [...SHIPPING_COUNTRIES] },
      phone_number_collection: { enabled: true },
      custom_text: {
        shipping_address: { message: `We'll print ${seats} smart cards for your team and ship them here for free.` },
        submit: {
          message: `Billed monthly: ${seats} cards × ${formatMoney(quote.unit)} = ${formatMoney(quote.total)}/month (${quote.percent}% team discount).`,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: `${SITE_URL}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/dashboard/company/billing?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const failure = checkoutFailure(e);
    console.error("Company checkout error", failure.diagnostics);
    return NextResponse.json({ error: failure.message }, { status: 500 });
  }
}
