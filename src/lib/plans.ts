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
      "Lead capture: visitors share their contact back",
      "Analytics: views, saves and tap vs QR vs link",
      "Export your leads to CSV",
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
      "Priority support",
    ],
    prices: { month: 49, quarter: 119, year: 399 },
  },
};

/** Every new individual subscriber gets their first month free (once per account). */
export const TRIAL_DAYS = 30;

// ───────────────────────── Company plans ─────────────────────────
// Billed monthly per employee card ("seat"). No free trial; every company gets a
// discount on the individual monthly price, growing with team size.

export const COMPANY_MIN_SEATS = 2;
export const COMPANY_MAX_SEATS = 500;

export const COMPANY_DISCOUNTS = [
  { minSeats: 2, percent: 10, label: "2–9 cards" },
  { minSeats: 10, percent: 15, label: "10–24 cards" },
  { minSeats: 25, percent: 20, label: "25+ cards" },
] as const;

export const COMPANY_FEATURES = [
  "A branded card for every employee",
  "Company logo, colours and website on every card",
  "Team analytics: views, saves, leads and bookings per card",
  "See your top performers at a glance",
  "One shared AI agent that knows your company (AI cards)",
  "Physical cards for the whole team, shipped to your office",
  "One monthly bill for the whole team",
];

export function companyDiscountPercent(seats: number) {
  let percent = 0;
  for (const d of COMPANY_DISCOUNTS) if (seats >= d.minSeats) percent = d.percent;
  return percent;
}

/** Monthly company bill in cents: list price, discount and total. */
export function companyQuote(tier: Tier, seats: number) {
  const list = PLANS[tier].prices.month * 100;
  const percent = companyDiscountPercent(seats);
  const unit = Math.round(list * (1 - percent / 100));
  return {
    seats,
    percent,
    listUnit: list,
    unit,
    subtotal: list * seats,
    discount: (list - unit) * seats,
    total: unit * seats,
  };
}

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
