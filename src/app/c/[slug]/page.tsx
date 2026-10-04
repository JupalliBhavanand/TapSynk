import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { LogoMark } from "@/components/Logo";
import { ProfileCard } from "@/components/ProfileCard";
import { getPublicCard } from "@/lib/data";
import { REQUIRE_SUBSCRIPTION, SITE_URL } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { isActive } from "@/lib/types";
import { CardActions } from "./CardActions";

type Props = PageProps<"/c/[slug]">;

function isLive(found: NonNullable<Awaited<ReturnType<typeof getPublicCard>>>) {
  return found.card.published && (!REQUIRE_SUBSCRIPTION || isActive(found.subscription));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await getPublicCard(slug);
  if (!found || !isLive(found)) return { title: "Card not found", robots: { index: false } };
  const { card } = found;
  const title = [card.full_name, card.company].filter(Boolean).join(" · ");
  const description = card.bio || `${card.full_name}${card.job_title ? `, ${card.job_title}` : ""}${card.company ? ` at ${card.company}` : ""}. Save my contact or chat with my AI assistant.`;
  return {
    title,
    description,
    alternates: { canonical: `/c/${card.slug}` },
    openGraph: { type: "profile", title, description, url: `${SITE_URL}/c/${card.slug}`, images: card.avatar_url ? [card.avatar_url] : undefined },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicCardPage({ params }: Props) {
  const { slug } = await params;
  const found = await getPublicCard(slug);
  if (!found) notFound();
  const { card, subscription, agent } = found;

  const live = isLive(found);
  const { user } = await getUser();
  const isOwner = user?.id === card.user_id;
  if (!live && !isOwner) notFound();

  const aiEnabled = Boolean(agent) && isActive(subscription) && subscription?.tier === "ai";
  const businessName = agent?.business_name || card.company || card.full_name;

  if (live && !isOwner) {
    after(async () => {
      await createAdminClient().rpc("bump_card_stat", { p_slug: slug, p_kind: "view" });
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: card.full_name,
    jobTitle: card.job_title || undefined,
    worksFor: card.company ? { "@type": "Organization", name: card.company, url: card.website || undefined } : undefined,
    email: card.email ? `mailto:${card.email}` : undefined,
    telephone: card.phone || undefined,
    image: card.avatar_url || undefined,
    url: `${SITE_URL}/c/${card.slug}`,
    sameAs: Object.values(card.socials ?? {}).filter((v) => typeof v === "string" && v.startsWith("http")),
  };

  return (
    <div className="grid-bg min-h-dvh px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="fade-up mx-auto max-w-md">
        {!live && isOwner && (
          <div className="mb-4 rounded-2xl border border-cream-line bg-cream px-4 py-3 text-sm">
            <strong>Only you can see this.</strong> {card.published ? "Choose a plan to make your card live." : "Your card is a draft."}{" "}
            <Link href={card.published ? "/dashboard/billing" : "/dashboard/card"} className="font-semibold text-brand underline">
              {card.published ? "See plans" : "Publish it"}
            </Link>
          </div>
        )}
        <ProfileCard card={card} actions={<CardActions slug={card.slug} ai={aiEnabled} businessName={businessName} ownerName={card.full_name} />} />
        <Link href="/" className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs font-medium text-muted hover:text-ink">
          <LogoMark className="h-5 w-5" /> Get your own AI business card
        </Link>
      </main>
    </div>
  );
}
