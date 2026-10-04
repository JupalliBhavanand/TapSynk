import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return new NextResponse(null, { status: 403 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const { data } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!data?.stripe_customer_id) return NextResponse.redirect(new URL("/dashboard/billing", request.url), { status: 303 });
  const session = await stripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${SITE_URL}/dashboard/billing` });
  return NextResponse.redirect(session.url, { status: 303 });
}
