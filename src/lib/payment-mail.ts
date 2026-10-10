import "server-only";
import type Stripe from "stripe";
import nodemailer from "nodemailer";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMailSettings, mailConfigurationError, mailFailure } from "@/lib/appointment-mail";

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

/** Links are retrieved from Stripe, never accepted from a browser or webhook metadata. */
function invoiceUrl(value: string | null | undefined) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || !(url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))) throw new Error("Invalid invoice URL");
  return url.toString();
}

export function paymentMessage(invoice: Stripe.Invoice) {
  const zeroDecimal = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
  const format = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency.toUpperCase() }).format(amount / (zeroDecimal.has(invoice.currency.toLowerCase()) ? 1 : 100));
  const number = invoice.number || invoice.id;
  const date = new Date((invoice.status_transitions.paid_at || invoice.created) * 1000).toISOString().slice(0, 10);
  const bill = invoiceUrl(invoice.hosted_invoice_url);
  const pdf = invoiceUrl(invoice.invoice_pdf);
  const lines = [`Hello ${invoice.customer_name || "there"},`, "Your payment to TapSynk is confirmed. Your bill is attached.", `Bill number: ${number}`, `Payment date (UTC): ${date}`, ...invoice.lines.data.map(line => `${line.description || "Subscription"}: ${format(line.amount)}`), `Total paid: ${format(invoice.amount_paid)}`, ...(bill ? [`View your bill: ${bill}`] : []), ...(pdf ? [`Download PDF: ${pdf}`] : []), "Thank you for choosing TapSynk."];
  return { subject: `Payment confirmation · ${number}`, text: lines.join("\n\n"), html: `<h1>Payment confirmation</h1>${lines.map(line => `<p>${escape(line)}</p>`).join("")}`, pdf };
}

async function invoicePdf(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
  if (!response.ok || !response.body || Number(response.headers.get("content-length") || 0) > 5_000_000) throw new Error("Could not download invoice PDF");
  const reader = response.body.getReader();
  const chunks: Buffer[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 5_000_000) { await reader.cancel(); throw new Error("Invoice PDF too large"); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const data = Buffer.concat(chunks);
  if (data.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid invoice PDF");
  return data;
}

/** Verified paid invoices cover initial subscriptions, renewals and charged upgrades. */
export async function sendPaymentConfirmation(invoiceId: string) {
  const invoice = await stripe().invoices.retrieve(invoiceId);
  // A free trial / zero-value invoice must never be presented as money received.
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) return;
  // This Stripe account may also contain invoices from other applications.
  if (!invoice.parent?.subscription_details?.metadata?.user_id) return;
  if (!invoice.customer_email) throw new Error("Paid invoice has no customer email");
  const configurationError = mailConfigurationError();
  if (configurationError) throw new Error(configurationError);
  const db = createAdminClient();
  const table = () => db.from("payment_confirmation_emails");
  const { error: insertError } = await table().upsert({ stripe_invoice_id: invoice.id }, { onConflict: "stripe_invoice_id", ignoreDuplicates: true });
  if (insertError) throw new Error("Apply payment confirmation migration 0006");
  const { data: claim, error: claimError } = await table().update({ status: "sending" }).eq("stripe_invoice_id", invoice.id).eq("status", "pending").select("stripe_invoice_id").maybeSingle();
  if (claimError) throw new Error("Could not claim payment email");
  if (!claim) {
    const { data, error } = await table().select("status").eq("stripe_invoice_id", invoice.id).maybeSingle();
    if (!error && data?.status === "sent") return;
    throw new Error("Payment email is already being processed");
  }
  let accepted = false;
  const settings = companyMailSettings();
  const transport = nodemailer.createTransport(settings.transport);
  try {
    const message = paymentMessage(invoice);
    const filename = `TapSynk-bill-${invoice.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const attachment = message.pdf
      ? { filename: `${filename}.pdf`, content: await invoicePdf(message.pdf), contentType: "application/pdf" }
      : { filename: `${filename}.html`, content: Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Paid bill</title><body>${message.html}</body></html>`), contentType: "text/html" };
    const result = await transport.sendMail({ from: settings.from, to: invoice.customer_email, subject: message.subject, text: message.text, html: message.html, attachments: [attachment], messageId: `<payment-${invoice.id}@${settings.from.address.split("@")[1]}>`, disableFileAccess: true, disableUrlAccess: true });
    if (!result.accepted?.length) throw new Error("Email server did not accept recipient");
    accepted = true;
    const { error } = await table().update({ status: "sent", sent_at: new Date().toISOString() }).eq("stripe_invoice_id", invoice.id).eq("status", "sending");
    if (error) console.error("Payment email accepted; delivery ledger needs reconciliation");
  } catch (error) {
    const failure = mailFailure(error);
    console.error("Payment confirmation failed", { code: failure.code, responseCode: failure.responseCode });
    if (!accepted) {
      await table().update({ status: "pending" }).eq("stripe_invoice_id", invoice.id).eq("status", "sending");
      throw new Error("Payment email failed; webhook will retry");
    }
  } finally { transport.close(); }
}
