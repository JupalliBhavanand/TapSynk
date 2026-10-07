"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEMO_STATUSES } from "@/lib/demo";
import { isAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export async function setDemoStatus(id: string, status: string): Promise<{ ok: boolean }> {
  const { user } = await getUser();
  if (!isAdminEmail(user?.email)) return { ok: false };
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(Object.keys(DEMO_STATUSES) as [keyof typeof DEMO_STATUSES]) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false };
  const { error } = await createAdminClient().from("demo_requests").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  revalidatePath("/dashboard/demos");
  return { ok: !error };
}
