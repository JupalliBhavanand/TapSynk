import { socialLinks } from "@/lib/socials";
import { safeUrl } from "@/lib/utils";
import type { Card } from "@/lib/types";

export type ProfileLink = { id: string; label: string; href: string };
export type LinkClickSource = "nfc" | "qr" | "link" | "unknown";
export type LinkClickTotal = { card_id: string; link_id: string; link_url: string; clicks: number };
export type LinkClickEvent = {
  id: string; card_id: string; link_id: string; link_label: string; link_url: string;
  clicked_at: string; source: LinkClickSource; visitor_hash: string;
  user_agent: string | null; referrer: string | null;
};
export type LinkClickRow = ProfileLink & { cardId: string; profileName: string; clicks: number; share: number };
export type LinkPeriod = "7" | "30" | "all";
export type LinkProfile = Pick<Card, "website" | "phone" | "email" | "address" | "socials">;

/** One inventory for validation and reporting, including custom URLs entered for a platform. */
export function profileLinks(card: LinkProfile): ProfileLink[] {
  const links: ProfileLink[] = [];
  if (card.phone) links.push({ id: "phone", label: "Phone", href: `tel:${card.phone.replace(/[^\d+]/g, "")}` });
  if (card.email) links.push({ id: "email", label: "Email", href: `mailto:${card.email}` });
  const website = safeUrl(card.website);
  if (website) links.push({ id: "website", label: "Website", href: website });
  if (card.address) links.push({ id: "address", label: "Address", href: `https://maps.google.com/?q=${encodeURIComponent(card.address)}` });
  for (const social of socialLinks(card.socials)) links.push({ id: `social:${social.key}`, label: social.label, href: social.href });
  return links;
}

export function linkClickSource(raw: unknown): LinkClickSource {
  if (raw === "t" || raw === "tap" || raw === "nfc") return "nfc";
  if (raw === "q" || raw === "qr") return "qr";
  if (raw === "l" || raw === "link") return "link";
  return "unknown";
}

export function linkPeriod(raw: unknown): LinkPeriod {
  return raw === "7" || raw === "all" ? raw : "30";
}

/** Rolling UTC intervals. All-time queries have no lower bound. */
export function linkSince(period: LinkPeriod, now = new Date()): string | null {
  return period === "all" ? null : new Date(now.getTime() - Number(period) * 86400_000).toISOString();
}

export function linkClickRows(cards: Pick<Card, "id" | "full_name" | "website" | "phone" | "email" | "address" | "socials">[], totals: LinkClickTotal[]): LinkClickRow[] {
  const counts = new Map(totals.map((t) => [JSON.stringify([t.card_id, t.link_id, t.link_url]), Number(t.clicks)]));
  const rows = cards.flatMap((card) => profileLinks(card).map((link) => ({ ...link, cardId: card.id, profileName: card.full_name, clicks: counts.get(JSON.stringify([card.id, link.id, link.href])) ?? 0, share: 0 })));
  const total = rows.reduce((sum, row) => sum + row.clicks, 0);
  return rows.map((row) => ({ ...row, share: total ? row.clicks / total * 100 : 0 })).sort((a, b) => b.clicks - a.clicks || a.profileName.localeCompare(b.profileName) || a.label.localeCompare(b.label));
}

export function clickNoise(headers: Headers): boolean {
  return /prefetch|prerender/i.test(`${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`)
    || /bot\b|crawler|spider|headless|facebookexternalhit|slackbot|telegrambot|bingpreview/i.test(headers.get("user-agent") ?? "");
}
