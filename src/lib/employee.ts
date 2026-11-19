import "server-only";
import { cache } from "react";
import { getUser } from "@/lib/supabase/server";
import type { Card } from "@/lib/types";

/** The database derives access from the authenticated, verified work email. */
export const getEmployeeWorkspace = cache(async () => {
  const { supabase, user } = await getUser();
  if (!user) return { supabase, user, cards: [] as Card[] };
  const { data: ids, error } = await supabase.rpc("employee_card_ids");
  if (error) throw new Error("Employee access is unavailable. Apply database migration 0009_employee_access.sql.");
  if (!ids?.length) return { supabase, user, cards: [] as Card[] };
  const { data, error: cardsError } = await supabase.from("cards").select("*").in("id", ids).not("company_id", "is", null).order("full_name");
  if (cardsError) throw new Error("Could not load your employee profiles. Please try again.");
  return { supabase, user, cards: (data ?? []) as Card[] };
});
