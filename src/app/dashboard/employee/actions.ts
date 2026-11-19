"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(80),
  job_title: z.string().trim().max(80),
  phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, "Enter a valid phone number."),
  bio: z.string().trim().max(400),
});

export type EmployeeProfileInput = z.infer<typeof profileSchema>;

export async function updateEmployeeProfile(id: string, input: EmployeeProfileInput) {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown employee profile." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  const { data: ids, error } = await supabase.rpc("employee_card_ids");
  if (error || !ids?.includes(id)) return { ok: false, error: "You do not have access to this employee profile." };
  // Recheck email in the write itself so owner reassignment immediately revokes access.
  const { data: card } = await supabase.from("cards").select("email").eq("id", id).single();
  if (!card || !user.email_confirmed_at || card.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) return { ok: false, error: "Employee profile not found." };
  const { data, error: writeError } = await createAdminClient().from("cards")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id).eq("email", card.email).not("company_id", "is", null)
    .select("slug").maybeSingle();
  if (writeError || !data) return { ok: false, error: "Could not save your profile. Please refresh and try again." };
  revalidatePath("/dashboard/employee");
  revalidatePath("/dashboard/company");
  revalidatePath(`/c/${data.slug}`);
  return { ok: true };
}
