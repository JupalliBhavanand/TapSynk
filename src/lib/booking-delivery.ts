import "server-only";
import { syncAppointmentToGoogle } from "@/lib/google-calendar";
import { sendAppointmentConfirmation, type Confirmation } from "@/lib/appointment-mail";
import { sendOwnerNotificationForEntity } from "@/lib/notification-mail";

/** Both messages must read the meeting after its conference request has completed. */
export async function deliverBookedMeeting(booking: Confirmation, ownerId: string) {
  const calendar = await syncAppointmentToGoogle(booking.id, ownerId).catch(() => ({ ok: false, meetUrl: undefined }));
  const deliveries = await Promise.allSettled([
    sendAppointmentConfirmation({ ...booking, meetUrl: calendar.meetUrl }),
    sendOwnerNotificationForEntity("appointment", booking.id),
  ]);
  return { calendar, deliveries };
}
