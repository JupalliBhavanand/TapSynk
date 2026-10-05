import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { Agent, Card, Company, Subscription } from "@/lib/types";

/** Everything the dashboard needs about the signed-in user, fetched once per request. */
export const getDashboardData = cache(async () => {
  const { supabase, user } = await getUser();
  if (!user) return null;
  const [{ data: card }, { data: subscription }, { data: profile }, { data: company }] = await Promise.all([
    supabase.from("cards").select("*").eq("user_id", user.id).is("company_id", null).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name, trial_used_at").eq("id", user.id).maybeSingle(),
    supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);
  let agent: Agent | null = null;
  if (card) {
    const { data } = await supabase.from("ai_agents").select("*").eq("card_id", card.id).maybeSingle();
    agent = data as Agent | null;
  }
  return {
    supabase,
    user,
    name: (profile?.full_name as string) || user.email?.split("@")[0] || "there",
    card: card as Card | null,
    subscription: subscription as Subscription | null,
    agent,
    company: company as Company | null,
    trialAvailable: !profile?.trial_used_at && !subscription,
  };
});

/** Public card plus its owner's plan and agent (service role, server-only; agent config never reaches the browser). */
export const getPublicCard = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const admin = createAdminClient();
  const { data: card } = await admin.from("cards").select("*").eq("slug", slug).maybeSingle();
  if (!card) return null;

  // Employee cards run on their company's plan and share the company's AI agent.
  if (card.company_id) {
    const [{ data: company }, { data: agent }] = await Promise.all([
      admin.from("companies").select("*").eq("id", card.company_id).maybeSingle(),
      admin.from("ai_agents").select("*").eq("company_id", card.company_id).maybeSingle(),
    ]);
    const c = company as Company | null;
    const subscription: Subscription | null = c
      ? {
          user_id: c.owner_id,
          tier: c.tier,
          billing_interval: "month",
          status: c.status,
          stripe_customer_id: c.stripe_customer_id,
          stripe_subscription_id: c.stripe_subscription_id,
          current_period_end: c.current_period_end,
        }
      : null;
    return { card: card as Card, subscription, agent: agent as Agent | null };
  }

  const [{ data: subscription }, { data: agent }] = await Promise.all([
    admin.from("subscriptions").select("*").eq("user_id", card.user_id).maybeSingle(),
    admin.from("ai_agents").select("*").eq("card_id", card.id).maybeSingle(),
  ]);
  return { card: card as Card, subscription: subscription as Subscription | null, agent: agent as Agent | null };
});
