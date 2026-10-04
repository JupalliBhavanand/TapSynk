// Every price in the app comes from here. Change a number and the landing page,
// dashboard, Stripe checkout and receipts all follow.

export type Tier = "virtual" | "ai";
export type BillingInterval = "month" | "quarter" | "year";

export interface Plan {
  tier: Tier;
  name: string;
  tagline: string;
  features: string[];
  prices: Record<BillingInterval, number>; // whole US dollars
}

export const PLANS: Record<Tier, Plan> = {
  virtual: {
    tier: "virtual",
    name: "Virtual Card",
    tagline: "Your digital business card, one tap away.",
    features: [
      "Premium NFC card shipped to your door",
      "Live digital business card page",
      "One-tap “Save contact” for iPhone & Android",
      "QR code backup and shareable link",
      "Edit your details any time",
      "View & save analytics",
    ],
    prices: { month: 20, quarter: 49, year: 149 },
  },
  ai: {
    tier: "ai",
    name: "AI Card",
    tagline: "A card that talks, sells and books for you.",
    features: [
      "Everything in Virtual Card",
      "“Talk to AI” marketing agent on your card",
      "AI learns from your website automatically",
      "Answers every visitor question 24/7",
      "Books appointments straight into your dashboard",
      "AI conversation & booking analytics",
    ],
    prices: { month: 49, quarter: 119, year: 399 },
  },
};

export const INTERVALS: Record<
  BillingInterval,
  { label: string; short: string; stripe: { interval: "month" | "year"; interval_count: number } }
> = {
  month: { label: "Monthly", short: "/month", stripe: { interval: "month", interval_count: 1 } },
  quarter: { label: "3 Months", short: "/3 months", stripe: { interval: "month", interval_count: 3 } },
  year: { label: "Yearly", short: "/year", stripe: { interval: "year", interval_count: 1 } },
};

export function isTier(v: unknown): v is Tier {
  return v === "virtual" || v === "ai";
}
export function isInterval(v: unknown): v is BillingInterval {
  return v === "month" || v === "quarter" || v === "year";
}

/** Percent saved versus paying monthly for the same period. */
export function savingsPercent(tier: Tier, interval: BillingInterval): number {
  const months = interval === "month" ? 1 : interval === "quarter" ? 3 : 12;
  const monthly = PLANS[tier].prices.month * months;
  return Math.round(((monthly - PLANS[tier].prices[interval]) / monthly) * 100);
}

/** Countries we ship physical NFC cards to (Stripe Checkout needs an explicit list). */
export const SHIPPING_COUNTRIES = [
  "US", "CA", "GB", "IE", "AU", "NZ", "IN", "AE", "SA", "QA", "SG", "MY", "PH", "JP",
  "DE", "FR", "ES", "IT", "NL", "BE", "SE", "NO", "DK", "FI", "CH", "AT", "PT", "PL", "ZA", "MX", "BR",
] as const;
