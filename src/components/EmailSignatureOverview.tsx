"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Mail } from "lucide-react";
import { buildEmailSignature, defaultSignatureSettings, photoDesigns, signatureTemplates, type SignatureCard, type SignatureSettings } from "@/lib/email-signature";
import { SignaturePreview } from "@/components/EmailSignature";
import styles from "./EmailSignature.module.css";

export function EmailSignatureOverview({ card, link }: { card: SignatureCard; link: string }) {
  const [settings, setSettings] = useState(defaultSignatureSettings);
  const [ready, setReady] = useState(false);
  const storageKey = `tapsync:signature:${link}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (saved && signatureTemplates.some(t => t.id === saved.template)) setSettings({
          template: saved.template,
          photoDesign: photoDesigns.some(d => d.id === saved.photoDesign) ? saved.photoDesign : "diagonal",
          color: /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : "",
          font: saved.font === "serif" ? "serif" : "sans",
          compact: saved.compact === true, portrait: saved.portrait !== false, socials: saved.socials !== false,
          motion: ["none", "float", "reveal"].includes(saved.motion) ? saved.motion : "reveal",
          cta: typeof saved.cta === "string" ? saved.cta.slice(0, 36) : "Save my contact",
        });
      } catch { /* The preview also works without browser storage. */ }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);
  function toggleMotion(enabled: boolean) {
    const next: SignatureSettings = { ...settings, motion: enabled ? "float" : "none" };
    setSettings(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session-only preferences are fine. */ }
  }
  const { html } = buildEmailSignature(card, link, settings);
  return <section className="card-surface overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5"><h2 className="flex items-center gap-2 font-bold"><Mail size={16} className="text-brand" />Email signature overview</h2><Link href="/dashboard/email-signature" className="flex items-center gap-1 text-xs font-semibold text-brand">Customize <ArrowUpRight size={13} /></Link></div>
    <div className="p-5"><div className={`${styles.signature} ${settings.template === "studio" ? styles.studio : ""} ${styles[settings.motion]}`}><SignaturePreview html={html} label="Your clickable email signature" /></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4"><div><p className="text-xs text-muted">Click your name or photo to open your profile. Contact and social links open individually.</p><Link href="/dashboard/email-signature#signature-export" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">Use this clickable signature in email <ArrowUpRight size={12} /></Link></div><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={settings.motion !== "none"} disabled={!ready} onChange={e => toggleMotion(e.target.checked)} className="accent-blue-600" />Animations</label></div>
  </section>;
}
