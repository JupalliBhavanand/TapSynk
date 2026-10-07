import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicCard } from "@/lib/data";
import { REQUIRE_SUBSCRIPTION } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { parseSource } from "@/lib/source";
import { createAdminClient } from "@/lib/supabase/admin";
import { isActive } from "@/lib/types";
import { clientIp } from "@/lib/utils";

const leadSchema = z
  .object({
    name: z.string().trim().min(1, "Add your name.").max(100),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(120)]).default(""),
    phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, "Enter a valid phone number.").default(""),
    company: z.string().trim().max(100).default(""),
    message: z.string().trim().max(1000).default(""),
    source: z.string().max(8).optional(),
    website: z.string().max(0).optional(), // honeypot: real people never fill this in
  })
  .refine((v) => v.email || v.phone, "Add an email or phone number.");

/** A visitor shares their own contact details with the card owner ("exchange contacts"). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/leads/[slug]">) {
  const { slug } = await ctx.params;
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });

  const found = await getPublicCard(slug);
  if (!found || !found.card.published || (REQUIRE_SUBSCRIPTION && !isActive(found.subscription))) {
    return NextResponse.json({ error: "This card isn't available." }, { status: 404 });
  }
  const ip = clientIp(request.headers);
  // Per card per visitor, plus a looser per-network cap, so people on shared event Wi-Fi can still swap details with many cards.
  const allowed =
    (await rateLimit(`lead:${ip}:${found.card.id}`, 3, 3600)) && (await rateLimit(`lead:${ip}`, 30, 3600)) && (await rateLimit(`lead-card:${found.card.id}`, 200, 86400));
  if (!allowed) {
    return NextResponse.json({ error: "You've already shared your details. Thanks!" }, { status: 429 });
  }

  const { name, email, phone, company, message, source } = parsed.data;
  const lead = { name, email, phone, company, message };
  const { card } = found;
  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({ ...lead, card_id: card.id, owner_id: card.user_id, company_id: card.company_id });
  if (error) return NextResponse.json({ error: "Could not send your details. Please try again." }, { status: 500 });
  after(async () => {
    await admin.rpc("bump_card_stat", { p_slug: slug, p_kind: "lead", p_source: parseSource(source) });
  });
  return NextResponse.json({ ok: true });
}
