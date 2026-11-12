"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Mail } from "lucide-react";
import { SITE_URL } from "@/lib/env";
import { buildEmailSignature, defaultSignatureSettings } from "@/lib/email-signature";
import { SignaturePreview } from "@/components/EmailSignature";
import styles from "./EmailSignature.module.css";

export function SignatureFeature() {
  const [motion, setMotion] = useState(true);
  const { html } = buildEmailSignature({ full_name: "Your name", job_title: "Your next introduction starts here", company: "Your brand", email: "hello@yourbusiness.com", phone: "", accent: "#5654d9" }, `${SITE_URL}/signup`, { ...defaultSignatureSettings, motion: motion ? "float" : "none" });
  return <section id="email-signatures" className="scroll-mt-20 border-y border-line bg-white py-24">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand"><Mail size={13} />Included with your card</span><h2 className="mt-5 text-4xl font-bold tracking-tight">Your next opportunity<br /><span className="text-gradient">could start with an email.</span></h2><p className="mt-5 max-w-lg leading-relaxed text-muted">Turn your everyday sign-off into a beautiful, clickable introduction. Your signature takes people straight to your TapSynk profile, where they can save your contact and take the next step.</p>
      <ul className="mt-6 space-y-3 text-sm text-ink-2">{["Four professional templates, made for your brand", "Your photo, logo, colors, and contact details", "Animated accents, with a simple off switch", "Copy into your email settings in seconds"].map(item => <li key={item} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{item}</li>)}</ul><Link href="/dashboard/email-signature" className="btn btn-dark mt-7">Design your signature <ArrowUpRight size={15} /></Link></div>
      <div className="min-w-0 rounded-3xl border border-line bg-bg p-5 sm:p-7"><div className="rounded-2xl border border-line bg-white p-5 shadow-lg"><p className="border-b border-line pb-3 text-xs text-muted">A little detail. A lasting impression.</p><p className="mb-5 mt-5 text-xs text-muted">Best regards,</p><div className={`${styles.signature} ${styles.studio} ${motion ? styles.float : styles.none}`}><SignaturePreview html={html} label="Example email signature" /></div></div><label className="mt-5 flex items-center justify-center gap-2 text-xs text-muted"><input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} className="accent-blue-600" /> Preview animations</label><p className="mt-2 text-center text-[10px] text-muted">Example design. Your signature links to your own profile.</p></div>
    </div>
  </section>;
}
