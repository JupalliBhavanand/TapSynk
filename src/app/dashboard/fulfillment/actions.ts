"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isFulfillmentAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

const FULFILLMENT_STATUSES = ["processing", "printing", "shipped", "delivered"] as const;

export async function setOrderFulfillmentStatus(id: string, status: string): Promise<{ ok: boolean }> {
  const { user } = await getUser();
  if (!isFulfillmentAdminEmail(user?.email)) return { ok: false };

  const parsed = z.object({ id: z.string().uuid(), status: z.enum(FULFILLMENT_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false };

  const { error } = await createAdminClient()
    .from("orders")
    .update({ fulfillment_status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (!error) revalidatePath("/dashboard/fulfillment");
  return { ok: !error };
}
