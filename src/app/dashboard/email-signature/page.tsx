import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowUpRight } from "lucide-react";
import { EmailSignature } from "@/components/EmailSignature";
import { requireDashboardData } from "@/lib/data";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = { title: "Email Signature" };

export default async function EmailSignaturePage() {
  const { card } = await requireDashboardData();
  return (
    <div className="fade-up mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-brand">Your brand, beyond the inbox</p>
          <h1 className="text-3xl font-bold tracking-tight">Email Signature</h1>
          <p className="mt-2 text-sm text-muted">A thoughtful final touch. Choose a layout, make it yours, and sign off in style.</p>
        </div>
        {card && <Link href="/dashboard/card" className="btn btn-ghost py-2 text-xs">Edit contact details <ArrowUpRight size={14} /></Link>}
      </div>
      {card ? <EmailSignature card={card} link={`${SITE_URL}/c/${card.slug}`} /> : (
        <div className="card-surface p-12 text-center">
          <Mail className="mx-auto mb-4 h-8 w-8 text-brand" />
          <h2 className="text-lg font-bold">Start with your digital card</h2>
          <p className="mt-2 text-sm text-muted">Your photo, logo, and contact details become your personalized email signature.</p>
          <Link href="/dashboard/card" className="btn btn-primary mt-6">Create my card</Link>
        </div>
      )}
    </div>
  );
}
