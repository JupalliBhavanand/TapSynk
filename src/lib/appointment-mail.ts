import "server-only";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { createAdminClient } from "@/lib/supabase/admin";

export type Confirmation = { id: string; name: string; email: string; starts_at: string; ends_at: string; notes: string; host: string; business: string; timezone: string; replyTo?: string };
const escape = (text: string) => text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function gmailConfigurationError(): string | undefined {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !password) return "Gmail is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD on the server.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return "GMAIL_USER must be the complete Gmail sender email address.";
  if (password.length !== 16) return "GMAIL_APP_PASSWORD must be a 16-character Google app password (spaces are ignored), not your normal Gmail password. Create one at myaccount.google.com/apppasswords, update your environment settings, and restart the server.";
}

const usesCompanySender = () => Boolean(process.env.SMTP_HOST || process.env.COMPANY_EMAIL);

/** One platform sender for every card; no visitor or card-owner email login. */
export function mailConfigurationError(): string | undefined {
  if (!usesCompanySender()) return gmailConfigurationError();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.COMPANY_EMAIL?.trim() || "")) return "Set COMPANY_EMAIL to the company sender address authorized by your email provider.";
  const host = process.env.SMTP_HOST?.trim();
  if (!host || /[\s/@]/.test(host)) return "Set SMTP_HOST to your company's email server hostname.";
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "SMTP_PORT must be a valid port number.";
  const mode = process.env.SMTP_AUTH_MODE || "credentials";
  if (!["credentials", "relay"].includes(mode)) return "SMTP_AUTH_MODE must be credentials or relay.";
  if (mode === "relay") {
    if (process.env.SMTP_USER || process.env.SMTP_PASSWORD) return "Remove SMTP_USER and SMTP_PASSWORD when using your company's authorized SMTP relay.";
    return;
  }
  if (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASSWORD) return "Configure the company's SMTP_USER and SMTP_PASSWORD once on the server. Customers and card owners do not need email credentials.";
  if (host.toLowerCase() === "smtp.gmail.com" && process.env.SMTP_PASSWORD.replace(/\s/g, "").length !== 16) return "Google Workspace SMTP needs a 16-character Google app password in SMTP_PASSWORD, not the account's regular password.";
}

export function companyMailSettings(): { from: { name: string; address: string }; transport: SMTPTransport.Options } {
  const company = usesCompanySender();
  const address = (company ? process.env.COMPANY_EMAIL : process.env.GMAIL_USER)!.trim();
  const host = company ? process.env.SMTP_HOST!.trim() : "smtp.gmail.com";
  const port = company ? Number(process.env.SMTP_PORT || 587) : 465;
  const password = company ? process.env.SMTP_PASSWORD : process.env.GMAIL_APP_PASSWORD;
  return {
    from: { name: process.env.COMPANY_EMAIL_NAME?.trim() || "TapSynk Appointments", address },
    transport: {
      host, port, secure: port === 465, requireTLS: port !== 465,
      ...(company && process.env.SMTP_AUTH_MODE === "relay" ? {} : { auth: { user: company ? process.env.SMTP_USER!.trim() : address, pass: host.toLowerCase() === "smtp.gmail.com" ? password!.replace(/\s/g, "") : password } }),
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    },
  };
}

export function mailFailure(error: unknown) {
  const value = error && typeof error === "object" ? error as { code?: unknown; responseCode?: unknown } : {};
  const code = typeof value.code === "string" && /^[A-Z0-9_]{1,40}$/.test(value.code) ? value.code : "UNKNOWN";
  const responseCode = typeof value.responseCode === "number" ? value.responseCode : undefined;
  const reason = code === "EAUTH"
    ? usesCompanySender() ? "The company email server rejected its credentials. Update the platform's SMTP settings; customers and card owners do not need to log in to email." : "Gmail rejected the sender login. Enable Google 2-Step Verification and generate a new app password for GMAIL_USER at myaccount.google.com/apppasswords. Set GMAIL_APP_PASSWORD to that password, restart the server, then retry."
    : code === "EENVELOPE"
      ? "The email server rejected the sender or recipient address. Check the appointment email and authorized company sender before retrying."
      : ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "EDNS"].includes(code)
        ? "Could not complete the connection to the email server. Check the platform's SMTP host and port, and the company Sent folder before retrying."
        : "Confirmation email could not be completed. Check the company sender settings and Sent folder before retrying.";
  // Never include raw SMTP responses, credential-bearing messages or addresses in logs.
  return { code, responseCode, reason };
}

export function confirmationMessage(booking: Confirmation) {
  const when = new Intl.DateTimeFormat("en-US", { timeZone: booking.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(booking.starts_at));
  const duration = Math.round((Date.parse(booking.ends_at) - Date.parse(booking.starts_at)) / 60000);
  const lines = [`Hello ${booking.name},`, "Your appointment is confirmed.", `Business: ${booking.business}`, `With: ${booking.host}`, `Date and time: ${when}`, `Timezone: ${booking.timezone}`, `Duration: ${duration} minutes`, ...(booking.notes ? [`Purpose: ${booking.notes}`] : []), ...(booking.replyTo ? ["To ask a question or request a change, reply to this email."] : []), "Thank you for booking through TapSynk."];
  return { subject: "Appointment confirmation", text: lines.join("\n\n"), html: `<h1>Appointment confirmation</h1>${lines.map((line) => `<p>${escape(line)}</p>`).join("")}` };
}

/** Provider acceptance is tracked independently of the confirmed appointment. */
export async function sendAppointmentConfirmation(booking: Confirmation) {
  const configurationError = mailConfigurationError();
  if (configurationError) return { sent: false, reason: configurationError };
  const settings = companyMailSettings();
  const db = createAdminClient();
  // Atomically claim the job: concurrent requests must not send the same mail twice.
  const { data: claimed, error: claimError } = await db.from("appointments").update({ confirmation_email_status: "sending" }).eq("id", booking.id).eq("status", "confirmed").eq("confirmation_email_status", "pending").select("id").maybeSingle();
  if (claimError) return { sent: false, reason: "Could not claim the confirmation email. Apply migration 0005." };
  if (!claimed) return { sent: false, reason: "This email was already sent, is being sent, or the appointment is not confirmed." };
  const transport = nodemailer.createTransport(settings.transport);
  let accepted = false;
  try {
    const result = await transport.sendMail({ from: settings.from, to: booking.email, replyTo: booking.replyTo, messageId: `<appointment-${booking.id}@${settings.from.address.split("@")[1]}>`, ...confirmationMessage(booking), disableFileAccess: true, disableUrlAccess: true });
    if (!result.accepted?.length) throw new Error("Email server did not accept the recipient");
    accepted = true;
    const { error } = await db.from("appointments").update({ confirmation_email_status: "sent", confirmation_email_sent_at: new Date().toISOString() }).eq("id", booking.id).eq("confirmation_email_status", "sending");
    if (error) throw new Error("Could not record email acceptance");
    return { sent: true };
  } catch (error) {
    const failure = mailFailure(error);
    console.error(accepted ? "Email accepted but status could not be saved" : "Appointment confirmation failed", { code: failure.code, responseCode: failure.responseCode });
    // A failed status update must never invite a duplicate send after Gmail acceptance.
    if (accepted) return { sent: true };
    await db.from("appointments").update({ confirmation_email_status: "failed" }).eq("id", booking.id).eq("confirmation_email_status", "sending");
    return { sent: false, reason: failure.reason };
  } finally {
    transport.close();
  }
}
