import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicCard } from "@/lib/data";
import { hasAi } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/utils";
import { bookingDate, bookingZone, publicBookingSlots, validBookingDate } from "@/lib/public-booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { canBookAppointment } from "@/lib/booking-quota";
import { businessIdentity } from "@/lib/business-identity";
import { deliverBookedMeeting } from "@/lib/booking-delivery";
import { mailConfigurationError } from "@/lib/appointment-mail";
import { parseSource } from "@/lib/source";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function target(slug: string) {
  const found = await getPublicCard(slug);
  return found?.card.published && found.agent?.booking_enabled && hasAi(found.subscription) ? found : null;
}

export async function GET(request: Request, context: RouteContext<"/api/appointments/[slug]">) {
  const { slug } = await context.params;
  if (!await rateLimit(`booking-slots:${clientIp(request.headers)}`, 120, 600)) return reply({ error: "Please wait a moment before checking again." }, 429);
  const found = await target(slug);
  if (!found?.agent) return reply({ error: "Appointments are not available for this card." }, 404);
  const timezone = bookingZone(found.agent);
  const date = new URL(request.url).searchParams.get("date") || bookingDate(new Date(), timezone);
  if (!validBookingDate(date, timezone)) return reply({ error: "Choose a valid date within the next 90 days." }, 400);
  try {
    return reply({ date, timezone, slots: await publicBookingSlots(found.card, found.agent, date), duration: found.agent.slot_minutes });
  } catch { return reply({ error: "Availability is temporarily unavailable. Please try again." }, 503); }
}

const input = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(120).transform((v) => v.toLowerCase()), slot: z.string().datetime(), source: z.string().max(8).optional(), website: z.string().max(0).optional() });
export async function POST(request: Request, context: RouteContext<"/api/appointments/[slug]">) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  if (Number(request.headers.get("content-length")) > 4096) return reply({ error: "Request is too large." }, 413);
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return reply({ error: "Enter your name, a valid email and an available appointment time." }, 400);
  const { slug } = await context.params;
  if (!await rateLimit(`direct-booking:${clientIp(request.headers)}`, 10, 600)) return reply({ error: "Please wait a few minutes before trying again." }, 429);
  const found = await target(slug);
  if (!found?.agent) return reply({ error: "Appointments are not available for this card." }, 404);
  const { card, agent } = found;
  const timezone = bookingZone(agent);
  const slot = new Date(body.data.slot).toISOString();
  const date = bookingDate(new Date(slot), timezone);
  if (!validBookingDate(date, timezone)) return reply({ error: "Choose an appointment within the next 90 days." }, 400);
  try {
    if (!(await publicBookingSlots(card, agent, date)).includes(slot)) return reply({ error: "That time is no longer available. Please choose another time." }, 409);
    if (!await canBookAppointment(card.id, body.data.email)) return reply({ error: "This email already has three bookings in the last 24 hours. Please contact the business." }, 429);
    const endsAt = new Date(Date.parse(slot) + agent.slot_minutes * 60000).toISOString();
    const { data, error } = await createAdminClient().from("appointments").insert({ card_id: card.id, owner_id: card.user_id, name: body.data.name, email: body.data.email, phone: "", notes: "", starts_at: slot, ends_at: endsAt, confirmation_email_status: "pending", booking_language: "en" }).select("id").single();
    if (error || !data) return reply({ error: error?.code === "23505" ? "That time was just booked. Please choose another time." : "Could not book the appointment. Please try again." }, error?.code === "23505" ? 409 : 503);
    after(async () => {
      await Promise.allSettled([
        deliverBookedMeeting({ id: data.id, name: body.data.name, email: body.data.email, notes: "", starts_at: slot, ends_at: endsAt, host: card.full_name, business: businessIdentity(agent.business_name, card.company, card.full_name, agent.knowledge), timezone, replyTo: card.email || undefined }, card.user_id),
        createAdminClient().rpc("bump_card_stat", { p_slug: card.slug, p_kind: "booking", p_source: parseSource(body.data.source) }),
      ]);
    });
    return reply({ booked: true, starts_at: slot, timezone, email_status: mailConfigurationError() ? "unavailable" : "pending" }, 201);
  } catch { return reply({ error: "Booking is temporarily unavailable. Please try again." }, 503); }
}
