import type { BillingInterval, Tier } from "@/lib/plans";

export interface Socials {
  linkedin?: string;
  instagram?: string;
  x?: string;
  facebook?: string;
  youtube?: string;
  whatsapp?: string;
}

export interface Card {
  id: string;
  user_id: string;
  slug: string;
  full_name: string;
  job_title: string;
  company: string;
  bio: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  avatar_url: string;
  logo_url: string;
  accent: string;
  socials: Socials;
  published: boolean;
  first_printed_at: string | null;
  views: number;
  saves: number;
  ai_opens: number;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  card_id: string | null;
  company_id: string | null;
  user_id: string;
  business_name: string;
  description: string;
  services: string;
  faq: string;
  tone: "friendly" | "professional" | "enthusiastic" | "concise";
  website_url: string;
  knowledge: string;
  knowledge_updated_at: string | null;
  booking_enabled: boolean;
  timezone: string;
  work_days: number[];
  day_start: string;
  day_end: string;
  slot_minutes: number;
}

export interface Appointment {
  id: string;
  card_id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "cancelled" | "completed";
  created_at: string;
}

export interface Subscription {
  user_id: string;
  tier: Tier;
  billing_interval: BillingInterval;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
}

export interface ShippingAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface Order {
  id: string;
  user_id: string;
  stripe_session_id: string;
  receipt_number: string;
  tier: Tier;
  billing_interval: BillingInterval;
  amount_subtotal: number;
  amount_discount: number;
  amount_tax: number;
  amount_total: number;
  currency: string;
  card_brand: string | null;
  card_last4: string | null;
  shipping_name: string | null;
  shipping_address: ShippingAddress | null;
  fulfillment_status: "processing" | "printing" | "shipped" | "delivered";
  company_id: string | null;
  quantity: number;
  created_at: string;
}

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  website: string;
  address: string;
  logo_url: string;
  accent: string;
  tier: Tier;
  seats: number;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  card_id: string;
  owner_id: string;
  company_id: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: "new" | "contacted" | "won" | "lost";
  created_at: string;
}

export type EventKind = "view" | "save" | "ai" | "lead" | "booking";
export type EventSource = "tap" | "qr" | "link";

export interface CardEvent {
  card_id: string;
  kind: EventKind;
  source: EventSource;
  created_at: string;
}

export const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
export const isActive = (s: Pick<Subscription, "status"> | null | undefined) =>
  Boolean(s && ACTIVE_STATUSES.includes(s.status));
