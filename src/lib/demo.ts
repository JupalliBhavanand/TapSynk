import { z } from "zod";

export const TEAM_SIZES = ["1", "2-9", "10-24", "25-99", "100+"] as const;
export const DEMO_INTERESTS = {
  ai: { label: "AI Card", hint: "Card + AI agent that books meetings" },
  virtual: { label: "Virtual Card", hint: "Smart card + digital profile" },
  company: { label: "Company cards", hint: "Cards and analytics for a team" },
  not_sure: { label: "Not sure yet", hint: "Help me pick" },
} as const;
export const DEMO_TIMES = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;
export const DEMO_STATUSES = { new: "New", contacted: "Contacted", scheduled: "Scheduled", done: "Done", not_a_fit: "Not a fit" } as const;

export const demoSchema = z.object({
  name: z.string().trim().min(2, "Add your name.").max(100),
  email: z.string().trim().email("Enter a valid email.").max(120),
  phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, "Enter a valid phone number.").default(""),
  company: z.string().trim().max(100).default(""),
  role: z.string().trim().max(80).default(""),
  team_size: z.enum(TEAM_SIZES).default("1"),
  interest: z.enum(["virtual", "ai", "company", "not_sure"]).default("not_sure"),
  preferred_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .default("")
    .transform((v) => v || null),
  preferred_time: z.enum(["", "morning", "afternoon", "evening"]).default(""),
  timezone: z.string().trim().max(60).default(""),
  message: z.string().trim().max(2000).default(""),
  website: z.string().max(0).optional(), // honeypot: real people never fill this in
});
export type DemoInput = z.input<typeof demoSchema>;
