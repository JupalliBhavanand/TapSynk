import type { Socials } from "@/lib/types";

export type SocialKey = keyof Socials;

type Platform = {
  key: SocialKey;
  label: string;
  /** Brand colour used for the logo tile (CSS background). */
  bg: string;
  placeholder: string;
  /** Turns a bare handle (with or without @) into a profile link. */
  profile?: (handle: string) => string;
};

/** Every social platform a card can link to, in display order. */
export const SOCIAL_PLATFORMS: Platform[] = [
  { key: "linkedin", label: "LinkedIn", bg: "#0A66C2", placeholder: "linkedin.com/in/you", profile: (h) => `https://www.linkedin.com/in/${h}` },
  { key: "instagram", label: "Instagram", bg: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)", placeholder: "@you", profile: (h) => `https://www.instagram.com/${h}` },
  { key: "whatsapp", label: "WhatsApp", bg: "#25D366", placeholder: "+1 555 123 4567" },
  { key: "x", label: "X", bg: "#000000", placeholder: "@you", profile: (h) => `https://x.com/${h}` },
  { key: "facebook", label: "Facebook", bg: "#1877F2", placeholder: "facebook.com/you", profile: (h) => `https://www.facebook.com/${h}` },
  { key: "youtube", label: "YouTube", bg: "#FF0000", placeholder: "@yourchannel", profile: (h) => `https://www.youtube.com/@${h}` },
  { key: "tiktok", label: "TikTok", bg: "#000000", placeholder: "@you", profile: (h) => `https://www.tiktok.com/@${h}` },
  { key: "threads", label: "Threads", bg: "#000000", placeholder: "@you", profile: (h) => `https://www.threads.net/@${h}` },
  { key: "telegram", label: "Telegram", bg: "#26A5E4", placeholder: "@you", profile: (h) => `https://t.me/${h}` },
  { key: "github", label: "GitHub", bg: "#181717", placeholder: "@you", profile: (h) => `https://github.com/${h}` },
  { key: "pinterest", label: "Pinterest", bg: "#E60023", placeholder: "@you", profile: (h) => `https://www.pinterest.com/${h}` },
  { key: "snapchat", label: "Snapchat", bg: "#FFFC00", placeholder: "@you", profile: (h) => `https://www.snapchat.com/add/${h}` },
];

const HANDLE = /^@?([A-Za-z0-9._-]{1,60})$/;

/**
 * Normalises what the owner typed for one platform: a full link, a bare domain
 * link, or just a handle like "@you". Returns "" when it can't be used.
 */
export function socialHref(key: SocialKey, raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (key === "whatsapp") {
    const digits = value.replace(/[^\d]/g, "");
    return digits.length >= 6 ? `https://wa.me/${digits}` : "";
  }
  const platform = SOCIAL_PLATFORMS.find((p) => p.key === key);
  const handle = value.match(HANDLE);
  // "@jo", "jo" and "jo.smith" are handles; "t.me" or "site.com" (a bare domain) is a link.
  const looksLikeDomain = /\.(com|net|org|me|io|co|app|ly|tv|gg|in|uk|us|ca|de|link|page|bio)$/i.test(value);
  if (handle && platform?.profile && (value.startsWith("@") || !looksLikeDomain)) return platform.profile(handle[1]!);
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (!url.hostname.includes(".")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

/** The card's social links that can be shown, in display order. */
export function socialLinks(socials: Socials | null | undefined) {
  const s = socials ?? {};
  return SOCIAL_PLATFORMS.map((p) => ({ ...p, href: socialHref(p.key, s[p.key]) })).filter((p) => p.href);
}
