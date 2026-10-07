import Link from "next/link";
import { Bot, CalendarCheck, Globe, Lock, MessageSquareText, Sparkles } from "lucide-react";
import { UpgradeToAiButton } from "@/components/UpgradeToAiButton";
import { PLANS, type BillingInterval } from "@/lib/plans";

const PERKS = [
  { icon: MessageSquareText, t: "“Ask my AI anything” on your card", d: "Visitors talk or type with an agent that knows your business, in any language." },
  { icon: Globe, t: "Learns from your website", d: "Paste a link and it builds its own knowledge base." },
  { icon: CalendarCheck, t: "Books appointments 24/7", d: "Offers your real open slots and fills your calendar." },
];

/**
 * Shown instead of AI tools to anyone not on an AI plan.
 * `upgradeInterval` gives existing subscribers a one-click upgrade; otherwise `href` goes to plans.
 */
export function AiLocked({ upgradeInterval, href = "/dashboard/billing?plan=ai", cta = "See AI Card plans", title = "Unlock your AI marketing agent" }: { upgradeInterval?: BillingInterval; href?: string; cta?: string; title?: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-navy px-6 py-10 text-white sm:px-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide">
            <Lock className="h-3.5 w-3.5" /> AI CARD FEATURE
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 text-white/70">The AI agent is part of the {PLANS.ai.name} plan, from ${PLANS.ai.prices.month}/month. Switch any time and switch back whenever you like.</p>
          <ul className="mt-6 space-y-4">
            {PERKS.map((p) => (
              <li key={p.t} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10"><p.icon className="h-4 w-4 text-brand-2" /></span>
                <span>
                  <span className="block font-semibold">{p.t}</span>
                  <span className="block text-sm text-white/60">{p.d}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {upgradeInterval ? (
              <UpgradeToAiButton interval={upgradeInterval} />
            ) : (
              <Link href={href} className="btn btn-primary"><Sparkles className="h-4 w-4" /> {cta}</Link>
            )}
          </div>
        </div>

        {/* A blurred peek at what visitors would see. */}
        <div aria-hidden className="relative mx-auto w-full max-w-sm select-none">
          <div className="space-y-3 rounded-2xl bg-white p-4 text-ink shadow-2xl blur-[1.5px]">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white"><Bot className="h-4 w-4" /></span>
              <span className="text-sm font-semibold">Your AI assistant</span>
            </div>
            <p className="w-4/5 rounded-2xl rounded-tl-sm bg-bg px-3 py-2 text-sm">Hi! I can tell you about our services or book a time with us.</p>
            <p className="ml-auto w-3/5 rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-sm text-white">Can I book a call this week?</p>
            <p className="w-4/5 rounded-2xl rounded-tl-sm bg-bg px-3 py-2 text-sm">Sure! Thursday 10:00 or 14:30 are open. Which works?</p>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-navy/90 shadow-xl ring-4 ring-white/20"><Lock className="h-6 w-6" /></span>
          </div>
        </div>
      </div>
    </section>
  );
}
