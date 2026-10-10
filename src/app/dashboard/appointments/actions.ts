"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDashboardData } from "@/lib/data";
import { englishBookingDetails } from "@/lib/booking-language";
import { mailConfigurationError, sendAppointmentConfirmation } from "@/lib/appointment-mail";
import type { Appointment } from "@/lib/types";

export async function convertBookingsToEnglish() {
  const { supabase, user, card } = await requireDashboardData();
  if (!card) return { error: "No card found." };
  const { data, error } = await supabase.from("appointments").select("id,name,notes").eq("owner_id", user.id).eq("card_id", card.id).neq("booking_language", "en").order("created_at").limit(21);
  if (error) return { error: "Could not load bookings. Apply database migration 0005 first." };
  let converted = 0;
  let failed = 0;
  // Bounded batch: repeatedly running this action skips records already converted.
  const records = (data ?? []).slice(0, 20);
  for (const record of records) {
    try {
      const english = await englishBookingDetails(record);
      const { error: updateError } = await supabase.from("appointments").update({ ...english, booking_language: "en" }).eq("id", record.id).eq("owner_id", user.id).eq("name", record.name).eq("notes", record.notes);
      if (updateError) failed++; else converted++;
    } catch { failed++; }
  }
  revalidatePath("/dashboard/appointments");
  return { message: `${converted} booking(s) converted to English.${failed ? ` ${failed} could not be converted; try again.` : ""}${records.length === 20 ? " Run again to convert any remaining records." : ""}` };
}

export async function emailBookingConfirmation(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown appointment." };
  const { supabase, user, card, agent } = await requireDashboardData();
  if (!card || !agent) return { error: "No appointment settings found." };
  const { data, error } = await supabase.from("appointments").select("*").eq("id", id).eq("card_id", card.id).eq("owner_id", user.id).single();
  if (error || !data) return { error: "Appointment not found." };
  const booking = data as Appointment;
  if (booking.status !== "confirmed") return { error: "Only confirmed appointments can receive confirmation emails." };
  if (booking.confirmation_email_status === "sent" || booking.confirmation_email_status === "sending") return { error: "Confirmation already sent or sending." };
  const configurationError = mailConfigurationError();
  if (configurationError) return { error: configurationError };
  try {
    const english = await englishBookingDetails(booking);
    const { error: updateError } = await supabase.from("appointments").update({ ...english, booking_language: "en", confirmation_email_status: "pending" }).eq("id", id).eq("owner_id", user.id).in("confirmation_email_status", ["not_requested", "pending", "failed"]);
    if (updateError) return { error: "Could not queue email. Apply database migration 0005 first." };
    const result = await sendAppointmentConfirmation({ ...booking, ...english, host: card.full_name, business: agent.business_name || card.company || card.full_name, timezone: agent.timezone, replyTo: card.email || undefined });
    revalidatePath("/dashboard/appointments");
    return result.sent ? { message: "Confirmation email accepted by the company email provider." } : { error: result.reason };
  } catch { return { error: "Could not prepare the confirmation email. Please try again." }; }
}
