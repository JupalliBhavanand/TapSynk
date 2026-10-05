import type { Metadata } from "next";
import { CompanyPricing } from "@/components/CompanyPricing";
import { PricingTable } from "@/components/PricingTable";

export const metadata: Metadata = {
  title: "Pricing",
  description: "TapSync plans: first month free, then Virtual Card from $20/month and AI Card from $49/month. Company plans with team discounts. Every plan includes a premium NFC card shipped free.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main className="grid-bg">
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="fade-up mb-12 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">
            Pick your plan, <span className="text-gradient">get your card</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-2">Your first month is free. Every plan ships a premium NFC card to your door. Cancel any time.</p>
        </div>
        <PricingTable />
      </section>
      <section id="company" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-24">
        <CompanyPricing />
      </section>
    </main>
  );
}
