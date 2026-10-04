import Anthropic from "@anthropic-ai/sdk";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { chatHistorySchema, runAgent } from "@/lib/agent";
import { getPublicCard } from "@/lib/data";
import { REQUIRE_SUBSCRIPTION } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { isActive } from "@/lib/types";
import { clientIp } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/chat/[slug]">) {
  const { slug } = await ctx.params;
  const body = z.object({ messages: chatHistorySchema, preview: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

  const found = await getPublicCard(slug);
  if (!found?.agent) return NextResponse.json({ error: "This assistant isn't available." }, { status: 404 });
  const { card, agent, subscription } = found;

  // Owners can test their own agent from the dashboard before going live.
  let isOwner = false;
  if (body.data.preview) {
    const { user } = await getUser();
    isOwner = user?.id === card.user_id;
  }
  const aiPlanActive = isActive(subscription) && subscription?.tier === "ai";
  if (!isOwner && (!card.published || (REQUIRE_SUBSCRIPTION && !aiPlanActive))) {
    return NextResponse.json({ error: "This assistant isn't available." }, { status: 404 });
  }

  const ip = clientIp(request.headers);
  const allowed = (await rateLimit(`chat:${ip}`, 30, 600)) && (await rateLimit(`chat-card:${card.id}`, 600, 3600));
  if (!allowed) return NextResponse.json({ error: "You're sending messages quickly. Please wait a moment." }, { status: 429 });

  if (!isOwner && body.data.messages.length === 1) {
    after(async () => {
      await createAdminClient().rpc("bump_card_stat", { p_slug: slug, p_kind: "ai" });
    });
  }

  try {
    const result = await runAgent({
      card,
      agent,
      history: body.data.messages,
      canBook: () => rateLimit(`book:${ip}:${card.id}`, 3, 86400),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The assistant is busy. Please try again in a moment." }, { status: 503 });
    if (e instanceof Anthropic.APIError) console.error("Claude API error", e.status, e.message);
    else console.error("Chat error", e);
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 500 });
  }
}
