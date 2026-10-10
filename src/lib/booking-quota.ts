import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Count saved bookings per customer, never shared-IP traffic or failed attempts. */
export async function canBookAppointment(cardId: string, email: string, now = Date.now()) {
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  // Escape ILIKE wildcards: an email containing '_' or '%' is a literal address.
  const address = email.trim().toLowerCase().replace(/[\\%_]/g, "\\$&");
  try {
    const { count, error } = await createAdminClient().from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("card_id", cardId).ilike("email", address)
      .in("status", ["confirmed", "completed"]).gte("created_at", since);
    // A database failure is not evidence that the customer has reached a quota.
    // The actual insert still reports a booking failure if the database is down.
    if (error) return true;
    return (count ?? 0) < 3;
  } catch { return true; }
}
