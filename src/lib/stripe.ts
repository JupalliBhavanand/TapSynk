import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;
export function stripeSecretKey(value: string) {
  const key = value.trim();
  if (!/^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/.test(key)) throw new Error("Invalid STRIPE_SECRET_KEY configuration");
  return key;
}
export function stripe() {
  client ??= new Stripe(stripeSecretKey(env.stripeSecret()), { appInfo: { name: "TapSynk" } });
  return client;
}
