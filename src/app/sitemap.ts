import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return pages;

  // Public cards of paying members help their owners show up in search.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: subs } = await admin.from("subscriptions").select("user_id").in("status", ["active", "trialing", "past_due"]);
  const ids = (subs ?? []).map((s) => s.user_id as string);
  if (!ids.length) return pages;
  const { data: cards } = await admin.from("cards").select("slug, updated_at").eq("published", true).in("user_id", ids).limit(5000);
  return [
    ...pages,
    ...(cards ?? []).map((c) => ({ url: `${SITE_URL}/c/${c.slug}`, lastModified: new Date(c.updated_at as string), changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
