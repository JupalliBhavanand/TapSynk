import { NextResponse, type NextRequest } from "next/server";
import { demoSchema } from "@/lib/demo";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/utils";

/** "Book a demo" form on the website. Stored in demo_requests for the TapSynk team. */
export async function POST(request: NextRequest) {
  const parsed = demoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
  // Bots that fill the hidden field get a normal-looking answer and nothing is stored.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const ip = clientIp(request.headers);
  if (!(await rateLimit(`demo:${ip}`, 5, 3600))) {
    return NextResponse.json({ error: "We already have your request. We'll be in touch soon." }, { status: 429 });
  }
  // A date in the past (or more than a year out) is dropped rather than rejected.
  const { name, email, phone, company, role, team_size, interest, preferred_date, preferred_time, timezone, message } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const date = preferred_date && preferred_date >= today && preferred_date <= nextYear ? preferred_date : null;

  const { error } = await createAdminClient().from("demo_requests").insert({ name, email, phone, company, role, team_size, interest, preferred_date: date, preferred_time, timezone, message });
  if (error) {
    console.error("Demo request failed", error.message);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
