import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMailSettings, mailConfigurationError, mailFailure } from "@/lib/appointment-mail";
import { SITE_URL } from "@/lib/env";
import { syncAppointmentToGoogle, validMeetUrl } from "@/lib/google-calendar";
import { notificationHref } from "@/lib/notification-types";

const esc = (text: string) => text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
export function ownerNotificationMessage(notification: { title: string; body: string; href: string }, details: string[]) {
  const link = `${SITE_URL}${notificationHref(notification.href)}`;
  return { subject: `TapSynk · ${notification.title}`, text: [notification.body, ...details, `View in your dashboard: ${link}`].join("\n\n"), html: `<div style="font-family:Arial,sans-serif;color:#172033;max-width:560px"><p style="font-size:11px;letter-spacing:2px;color:#5654d9">TAPSYNK ACTIVITY</p><h1 style="font-size:24px">${esc(notification.title)}</h1><p>${esc(notification.body)}</p>${details.map(line => `<p style="font-size:13px;color:#657185">${line.startsWith("Join Google Meet: ") && validMeetUrl(line.slice(18)) ? `<a href="${esc(line.slice(18))}">Join Google Meet</a>` : esc(line)}</p>`).join("")}<p><a href="${esc(link)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#172033;color:white;text-decoration:none">Open dashboard →</a></p></div>` };
}

/** Email the actual account owner, not a public contact address supplied on a card. */
export async function sendOwnerNotificationEmail(id: string) {
  const configurationError = mailConfigurationError();
  if (configurationError) return { sent: false, reason: configurationError };
  const db = createAdminClient();
  const { data: notice, error } = await db.from("notifications").select("*").eq("id", id).eq("email_status", "pending").maybeSingle();
  if (error || !notice) return { sent: false, reason: "No pending notification." };
  const { data: account, error: accountError } = await db.auth.admin.getUserById(notice.owner_id);
  if (accountError || !account.user?.email) return { sent: false, reason: "Account email is unavailable." };
  const details: string[] = [];
  if (notice.kind === "lead") {
    const { data: lead } = await db.from("leads").select("name,email,phone,company,message").eq("id", notice.entity_id).eq("owner_id", notice.owner_id).maybeSingle();
    if (lead) details.push(...[lead.email && `Email: ${lead.email}`, lead.phone && `Phone: ${lead.phone}`, lead.company && `Company: ${lead.company}`, lead.message && `Message: ${lead.message}`].filter((v): v is string => Boolean(v)));
  } else {
    const { data: booking } = await db.from("appointments").select("name,email,starts_at,ends_at,notes,status,google_meet_url").eq("id", notice.entity_id).eq("owner_id", notice.owner_id).maybeSingle();
    if (booking && booking.status === "confirmed" && !validMeetUrl(booking.google_meet_url)) {
      const result = await syncAppointmentToGoogle(notice.entity_id, notice.owner_id).catch(() => ({ meetUrl: undefined }));
      if (result.meetUrl) booking.google_meet_url = result.meetUrl;
    }
    if (booking && validMeetUrl(booking.google_meet_url)) details.push(`Join Google Meet: ${booking.google_meet_url}`);
    if (booking) details.push(`Guest: ${booking.email}`, `Starts: ${new Date(booking.starts_at).toUTCString()}`, `Ends: ${new Date(booking.ends_at).toUTCString()}`, ...(booking.notes ? [`Notes: ${booking.notes}`] : []));
  }
  const { data: claimed, error: claimError } = await db.from("notifications").update({ email_status: "sending", email_error: null, email_started_at: new Date().toISOString() }).eq("id", id).eq("email_status", "pending").select("id").maybeSingle();
  if (claimError || !claimed) return { sent: false, reason: "Email is already being processed." };
  const settings = companyMailSettings();
  const transport = nodemailer.createTransport(settings.transport);
  let accepted = false;
  try {
    const result = await transport.sendMail({ from: { ...settings.from, name: "TapSynk Notifications" }, to: account.user.email, messageId: `<notification-${id}@${settings.from.address.split("@")[1]}>`, ...ownerNotificationMessage(notice, details), disableFileAccess: true, disableUrlAccess: true });
    if (!result.accepted?.length) throw Object.assign(new Error("Recipient rejected"), { code: "EENVELOPE" });
    accepted = true;
    await db.from("notifications").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", id).eq("email_status", "sending");
    return { sent: true };
  } catch (error) {
    if (accepted) return { sent: true };
    const failure = mailFailure(error);
    const definiteFailure = ["EAUTH", "EENVELOPE"].includes(failure.code);
    await db.from("notifications").update({ email_status: definiteFailure ? "failed" : "uncertain", email_error: definiteFailure ? "Email could not be delivered. Check sender settings before retrying." : "Email delivery could not be confirmed. Check your inbox before retrying." }).eq("id", id).eq("email_status", "sending");
    return { sent: false, reason: "Owner notification email could not be confirmed." };
  } finally { transport.close(); }
}
export async function sendOwnerNotificationForEntity(kind: "lead" | "appointment", entityId: string) {
  const db = createAdminClient();
  const { data } = await db.from("notifications").select("id").eq("kind", kind).eq("entity_id", entityId).eq("email_status", "pending").maybeSingle();
  return data ? sendOwnerNotificationEmail(data.id) : { sent: false };
}
export async function sendPendingOwnerNotifications(ownerId: string) {
  if (mailConfigurationError()) return;
  const db = createAdminClient();
  await db.from("notifications").update({ email_status: "uncertain", email_error: "Email delivery could not be confirmed. Check your inbox before retrying." }).eq("owner_id", ownerId).eq("email_status", "sending").lt("email_started_at", new Date(Date.now() - 15 * 60000).toISOString());
  const { data } = await db.from("notifications").select("id").eq("owner_id", ownerId).eq("email_status", "pending").order("created_at").limit(3);
  await Promise.allSettled((data || []).map(item => sendOwnerNotificationEmail(item.id)));
}
