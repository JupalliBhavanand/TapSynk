import { z } from "zod";
import { isValidTimeZone } from "@/lib/slots";
import { SOCIAL_PLATFORMS, socialHref } from "@/lib/socials";
import type { Socials } from "@/lib/types";
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

/** Social links: full links or @handles are stored as profile links; WhatsApp keeps the number. */
export const socialsSchema = z
  .record(z.string(), z.string().trim().max(300).optional())
  .default({})
  .transform((raw, ctx) => {
    const out: Socials = {};
    for (const { key, label } of SOCIAL_PLATFORMS) {
      const value = raw[key]?.trim();
      if (!value) continue;
      if (key === "whatsapp") {
        if (!/^[+\d\s()-]{6,30}$/.test(value)) ctx.addIssue({ code: "custom", message: "Enter your WhatsApp number with country code, like +1 555 123 4567." });
        else out.whatsapp = value;
        continue;
      }
      const href = socialHref(key, value);
      if (!href) ctx.addIssue({ code: "custom", message: `Check your ${label} link. Paste the full link or your @handle.` });
      else out[key] = href;
    }
    return out;
  });
