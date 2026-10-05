import { z } from "zod";
import { isValidTimeZone } from "@/lib/slots";
import { safeUrl } from "@/lib/utils";

const text = (max: number) => z.string().trim().max(max).default("");
const url = z
  .string()
  .trim()
  .max(300)
  .default("")
  .transform((v) => safeUrl(v));

export const agentSchema = z.object({
  business_name: text(120),
  description: text(4000),
  services: text(4000),
  faq: text(6000),
  tone: z.enum(["friendly", "professional", "enthusiastic", "concise"]).default("friendly"),
  website_url: url,
  knowledge: text(30000),
  booking_enabled: z.boolean().default(true),
  timezone: z.string().refine(isValidTimeZone, "Pick a valid timezone."),
  work_days: z.array(z.number().int().min(0).max(6)).max(7).default([1, 2, 3, 4, 5]),
  day_start: z.string().regex(/^\d{2}:\d{2}$/),
  day_end: z.string().regex(/^\d{2}:\d{2}$/),
  slot_minutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
});
