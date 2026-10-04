import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;
export function stripe() {
  client ??= new Stripe(env.stripeSecret(), { appInfo: { name: "TapSync" } });
  return client;
}
