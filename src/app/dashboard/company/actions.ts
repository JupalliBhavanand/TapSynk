"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COMPANY_MAX_SEATS, COMPANY_MIN_SEATS } from "@/lib/plans";
import { agentSchema, socialsSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { hasAi, isActive, type Agent, type Card, type Company } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const image = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => v === "" || v.startsWith("https://") || v.startsWith("http://localhost"), "Images must be uploaded files.");

const companySchema = z.object({
  name: z.string().trim().min(2, "Add your company name.").max(80),
  website: z.string().trim().max(200).default("").transform((v) => safeUrl(v)),
  address: z.string().trim().max(200).default(""),
  logo_url: image,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1d5bff"),
  tier: z.enum(["virtual", "ai"]),
  seats: z.number().int().min(COMPANY_MIN_SEATS).max(COMPANY_MAX_SEATS),
});
export type CompanyInput = z.input<typeof companySchema>;

async function ownCompany() {
  const { supabase, user } = await getUser();
  if (!user) return { supabase, user: null, company: null };
  const { data } = await supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle();
  return { supabase, user, company: data as Company | null };
}

/** Creates or updates the company profile. Plan fields only change here before the first payment. */
export async function saveCompany(input: CompanyInput): Promise<Result<{ company: Company }>> {
  const { user, company } = await ownCompany();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  const { tier, seats, ...profile } = parsed.data;

  // Billing columns are server-only, so writes go through the service role after the ownership check above.
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const query = company
    ? admin
        .from("companies")
        .update({ ...profile, ...(isActive(company) ? {} : { tier, seats }), updated_at: now })
        .eq("id", company.id)
        .select()
        .single()
    : admin.from("companies").insert({ ...profile, tier, seats, owner_id: user.id }).select().single();
  const { data, error } = await query;
  if (error) return { ok: false, error: "Could not save your company. Please try again." };

  // Keep every employee card on-brand.
  if (company) {
    await admin
      .from("cards")
      .update({ company: profile.name, website: profile.website, address: profile.address, logo_url: profile.logo_url, accent: profile.accent, updated_at: now })
      .eq("company_id", company.id);
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, data: { company: data as Company } };
}

const employeeSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "The card link can use 3–40 lowercase letters, numbers and dashes."),
  full_name: z.string().trim().min(2, "Add the employee's name.").max(80),
  job_title: z.string().trim().max(80).default(""),
  bio: z.string().trim().max(400).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(120)]).default(""),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+\d\s().-]*$/, "Phone numbers can only contain digits, spaces and + ( ) -.")
    .default(""),
  avatar_url: image,
  published: z.boolean().default(true),
  socials: socialsSchema,
});
export type EmployeeInput = z.input<typeof employeeSchema>;

const RESERVED = new Set(["admin", "api", "app", "dashboard", "login", "signup", "pricing", "support", "help", "tapsync", "tapsynk", "www"]);

export async function saveEmployeeCard(id: string | null, input: EmployeeInput): Promise<Result<{ card: Card }>> {
  const { supabase, user, company } = await ownCompany();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!company) return { ok: false, error: "Set up your company first." };
  if (id && !z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown card." };
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  if (RESERVED.has(parsed.data.slug)) return { ok: false, error: "That link is reserved. Try another." };

  const values = {
    ...parsed.data,
    company: company.name,
    website: company.website,
    address: company.address,
    logo_url: company.logo_url,
    accent: company.accent,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("cards").update(values).eq("id", id).eq("company_id", company.id).select().single()
    : supabase.from("cards").insert({ ...values, user_id: user.id, company_id: company.id, first_printed_at: new Date().toISOString() }).select().single();
  const { data, error } = await query;
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That card link is already taken. Try another." };
    if (error.message?.includes("seats")) return { ok: false, error: "All your seats are in use. Add seats on the Billing tab first." };
    return { ok: false, error: "Could not save the card. Please try again." };
  }
  revalidatePath("/dashboard/company", "layout");
  revalidatePath(`/c/${data.slug}`);
  return { ok: true, data: { card: data as Card } };
}

export async function deleteEmployeeCard(id: string): Promise<Result> {
  const { supabase, user, company } = await ownCompany();
  if (!user || !company) return { ok: false, error: "Please sign in again." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown card." };
  const { error } = await supabase.from("cards").delete().eq("id", id).eq("company_id", company.id);
  if (error) return { ok: false, error: "Could not remove the card." };
  revalidatePath("/dashboard/company", "layout");
  return { ok: true };
}

/** The company-wide AI agent shared by every employee card. */
export async function saveCompanyAgent(input: z.input<typeof agentSchema>): Promise<Result<{ agent: Agent }>> {
  const { supabase, user, company } = await ownCompany();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!company) return { ok: false, error: "Set up your company first." };
  if (!hasAi(company)) return { ok: false, error: "The AI agent is part of AI Cards. Switch your team to AI Cards to use it." };
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  if (parsed.data.day_start >= parsed.data.day_end) return { ok: false, error: "Your day must end after it starts." };
  const { data, error } = await supabase
    .from("ai_agents")
    .upsert({ ...parsed.data, company_id: company.id, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "company_id" })
    .select()
    .single();
  if (error) return { ok: false, error: "Could not save your AI agent." };
  revalidatePath("/dashboard/company/ai");
  return { ok: true, data: { agent: data as Agent } };
}
