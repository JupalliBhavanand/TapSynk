"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { agentSchema, socialsSchema } from "@/lib/schemas";
import { hasAi, type Agent, type Card } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const text = (max: number) => z.string().trim().max(max).default("");
const url = z
  .string()
  .trim()
  .max(300)
  .default("")
  .transform((v) => safeUrl(v));
const httpsImage = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => v === "" || v.startsWith("https://") || v.startsWith("http://localhost"), "Images must be uploaded files.");

const cardSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "Your link can use 3–40 lowercase letters, numbers and dashes."),
  full_name: z.string().trim().min(2, "Add your name.").max(80),
  job_title: text(80),
  company: text(80),
  bio: text(400),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(120)]).default(""),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+\d\s().-]*$/, "Phone numbers can only contain digits, spaces and + ( ) -.")
    .default(""),
  website: url,
  address: text(200),
  avatar_url: httpsImage,
  logo_url: httpsImage,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563EB"),
  socials: socialsSchema,
  published: z.boolean().default(false),
});

export type CardInput = z.input<typeof cardSchema>;

const RESERVED = new Set(["admin", "api", "app", "dashboard", "login", "signup", "pricing", "support", "help", "tapsync", "tapsynk", "www"]);

export async function saveCard(input: CardInput): Promise<Result<{ card: Card; firstPrint: boolean }>> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  if (RESERVED.has(parsed.data.slug)) return { ok: false, error: "That link is reserved. Try another." };

  const { data: existing } = await supabase.from("cards").select("id, first_printed_at").eq("user_id", user.id).is("company_id", null).maybeSingle();
  const firstPrint = parsed.data.published && !existing?.first_printed_at;
  const values = {
    ...parsed.data,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    ...(firstPrint ? { first_printed_at: new Date().toISOString() } : {}),
  };

  const query = existing
    ? supabase.from("cards").update(values).eq("id", existing.id).select().single()
    : supabase.from("cards").insert(values).select().single();
  const { data, error } = await query;
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That link is already taken. Try another." };
    return { ok: false, error: "Could not save your card. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/c/${data.slug}`);
  return { ok: true, data: { card: data as Card, firstPrint } };
}

export type AgentInput = z.input<typeof agentSchema>;

export async function saveAgent(input: AgentInput): Promise<Result<{ agent: Agent }>> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = agentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  if (parsed.data.day_start >= parsed.data.day_end) return { ok: false, error: "Your day must end after it starts." };

  const [{ data: card }, { data: subscription }] = await Promise.all([
    supabase.from("cards").select("id").eq("user_id", user.id).is("company_id", null).maybeSingle(),
    supabase.from("subscriptions").select("tier, status").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!card) return { ok: false, error: "Create your card first." };
  if (!hasAi(subscription)) return { ok: false, error: "The AI agent is part of the AI Card plan. Switch plans to use it." };

  const { data, error } = await supabase
    .from("ai_agents")
    .upsert({ ...parsed.data, card_id: card.id, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "card_id" })
    .select()
    .single();
  if (error) return { ok: false, error: "Could not save your AI agent." };
  revalidatePath("/dashboard/ai");
  return { ok: true, data: { agent: data as Agent } };
}

export async function setAppointmentStatus(id: string, status: "cancelled" | "completed" | "confirmed"): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown appointment." };
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, error: error.code === "23505" ? "That time has been booked again." : "Could not update the appointment." };
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setLeadStatus(id: string, status: "new" | "contacted" | "won" | "lost"): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!z.string().uuid().safeParse(id).success || !["new", "contacted", "won", "lost"].includes(status)) return { ok: false, error: "Unknown lead." };
  const { error } = await supabase.from("leads").update({ status }).eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, error: "Could not update the lead." };
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/company/leads");
  return { ok: true };
}

export async function setLeadNotes(id: string, notes: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const parsed = z.object({ id: z.string().uuid(), notes: z.string().trim().max(2000) }).safeParse({ id, notes });
  if (!parsed.success) return { ok: false, error: "Notes can be up to 2,000 characters." };
  const { error } = await supabase
    .from("leads")
    .update({ notes: parsed.data.notes, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: "Could not save your note." };
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/company/leads");
  return { ok: true };
}
