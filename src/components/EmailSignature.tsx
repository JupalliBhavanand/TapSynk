"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A ready-made email signature that links to the card, copied as rich text for Gmail, Outlook and Apple Mail. */
export function EmailSignature({ card, link }: { card: { full_name: string; job_title: string; company: string; email: string; phone: string; accent: string }; link: string }) {
  const [copied, setCopied] = useState<"rich" | "html" | null>(null);
  const accent = /^#[0-9a-f]{6}$/i.test(card.accent) ? card.accent : "#1d5bff";
  const title = [card.job_title, card.company].filter(Boolean).join(" · ");
  const html = `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#273047;line-height:1.5"><tr><td style="border-left:3px solid ${accent};padding-left:12px">
<div style="font-size:15px;font-weight:bold;color:#0d1120">${esc(card.full_name)}</div>
${title ? `<div style="color:#5d6679">${esc(title)}</div>` : ""}
<div>${[card.phone && esc(card.phone), card.email && `<a href="mailto:${esc(card.email)}" style="color:#273047;text-decoration:none">${esc(card.email)}</a>`].filter(Boolean).join(" &nbsp;|&nbsp; ")}</div>
<a href="${esc(link)}" style="display:inline-block;margin-top:8px;padding:6px 12px;border-radius:8px;background:${accent};color:#ffffff;font-weight:bold;text-decoration:none">Save my contact</a>
</td></tr></table>`;

  async function copy(kind: "rich" | "html") {
    try {
      if (kind === "rich" && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([`${card.full_name}\n${title}\n${link}`], { type: "text/plain" }) })]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="card-surface p-6">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-brand" />
        <h2 className="font-bold">Email signature</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Every email you send becomes a way to save your contact. Copy it, then paste it into your email settings.</p>
      {/* Preview of exactly what gets copied. */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white p-4" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("rich")} className="btn btn-dark py-2 text-sm">
          {copied === "rich" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied === "rich" ? "Copied" : "Copy signature"}
        </button>
        <button type="button" onClick={() => copy("html")} className="btn btn-ghost py-2 text-sm">
          {copied === "html" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied === "html" ? "Copied" : "Copy HTML"}
        </button>
      </div>
    </section>
  );
}
