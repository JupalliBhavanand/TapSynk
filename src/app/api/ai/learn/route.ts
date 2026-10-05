import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { summarizeWebsite } from "@/lib/agent";
import { rateLimit } from "@/lib/rate-limit";
import { extractPage, safeFetchHtml } from "@/lib/safe-fetch";
import { getUser } from "@/lib/supabase/server";
import { safeUrl } from "@/lib/utils";

export const maxDuration = 120;

const PRIORITY = /(about|service|product|pricing|price|plan|package|menu|contact|faq|team|work|portfolio|solution|offer)/i;

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = z.object({ url: z.string().max(300), company: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  const start = body.success ? safeUrl(body.data.url) : "";
  if (!start) return NextResponse.json({ error: "Enter a valid website link." }, { status: 400 });

  if (!(await rateLimit(`learn:${user.id}`, 6, 3600))) {
    return NextResponse.json({ error: "You've refreshed your website a few times this hour. Try again later." }, { status: 429 });
  }

  // Either the personal card's agent or the company-wide agent.
  let target: { card_id: string } | { company_id: string };
  if (body.data?.company) {
    const { data: company } = await supabase.from("companies").select("id").eq("owner_id", user.id).maybeSingle();
    if (!company) return NextResponse.json({ error: "Set up your company first." }, { status: 400 });
    target = { company_id: company.id };
  } else {
    const { data: card } = await supabase.from("cards").select("id").eq("user_id", user.id).is("company_id", null).maybeSingle();
    if (!card) return NextResponse.json({ error: "Create your card first." }, { status: 400 });
    target = { card_id: card.id };
  }

  try {
    const home = await safeFetchHtml(start);
    const first = extractPage(home.html, home.url);
    const pages = [{ url: home.url, title: first.title, text: `${first.description}\n${first.text}`.slice(0, 15000) }];

    const candidates = first.links
      .filter((l) => l !== home.url)
      .sort((a, b) => Number(PRIORITY.test(b)) - Number(PRIORITY.test(a)))
      .slice(0, 6);
    const more = await Promise.allSettled(candidates.map((u) => safeFetchHtml(u)));
    for (const r of more) {
      if (r.status !== "fulfilled") continue;
      const p = extractPage(r.value.html, r.value.url);
      if (p.text.length > 200) pages.push({ url: r.value.url, title: p.title, text: p.text.slice(0, 10000) });
    }

    if (pages.every((p) => p.text.trim().length < 100)) {
      return NextResponse.json({ error: "We couldn't read text from that site. It may be built entirely with JavaScript; add your info manually instead." }, { status: 422 });
    }

    const knowledge = await summarizeWebsite(pages);
    const { error } = await supabase.from("ai_agents").upsert(
      { ...target, user_id: user.id, website_url: start, knowledge, knowledge_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "company_id" in target ? "company_id" : "card_id" },
    );
    if (error) throw new Error("Could not save what we learned.");
    return NextResponse.json({ knowledge, pages: pages.map((p) => p.url) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    return NextResponse.json({ error: `We couldn't learn from that website. ${message}` }, { status: 422 });
  }
}
