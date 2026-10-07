import Link from "next/link";
import { ArrowRight, ArrowRightLeft, BarChart3, Bot, Building2, CalendarCheck, CalendarDays, Check, Gift, Globe, Handshake, Lock, Mic, Minus, MousePointer2, QrCode, ShieldCheck, Smartphone, Sparkles, UserPlus, Zap } from "lucide-react";
import { CardPrinter } from "@/components/CardPrinter";
import { HeroDemo } from "@/components/HeroDemo";
import { CompanyPricing } from "@/components/CompanyPricing";
import { PricingTable } from "@/components/PricingTable";
import { Reveal } from "@/components/Reveal";
import { UseCases } from "@/components/UseCases";
import { SITE_URL } from "@/lib/env";
import { PLANS } from "@/lib/plans";

const faqs = [
  {
    q: "Is there a free trial?",
    a: "Yes, on the Virtual Card. It costs $0 for the first 30 days and your smart card still ships free. After that the plan's price starts automatically, and you can cancel any time in the first month without being charged. The AI Card is billed from day one, and you can switch between the two whenever you like.",
  },
  {
    q: "Can I get cards for my whole team?",
    a: "Yes. The Company plan gives every employee a branded card, a team analytics dashboard and one monthly bill. It's priced per card with a team discount of 10% to 20% depending on team size. Company plans are billed monthly and don't include a free month.",
  },
  {
    q: "Can I switch between the Virtual Card and the AI Card?",
    a: "Any time, from your dashboard. Upgrading to the AI Card unlocks your AI agent right away and you only pay the prorated difference. Moving back to the Virtual Card keeps your AI working until the end of the period you've already paid for.",
  },
  {
    q: "Can I see a demo before I buy?",
    a: "Yes. Book a free 15-minute demo and we'll show you the card, the AI agent and the dashboard set up around your own business.",
  },
  {
    q: "Does the smart card work with every phone?",
    a: "TapSynk works with compatible iPhones and Android phones without an app. You can also scan the QR code or open the card's link to see the same profile.",
  },
  {
    q: "How does the AI agent learn about my business?",
    a: "Paste your website link and TapSynk reads your pages and builds a knowledge base. You can also type in your services, prices and FAQs. The AI only answers from what you give it.",
  },
  {
    q: "Can visitors really book appointments through the AI?",
    a: "Yes. Set your working days and hours, and the AI offers only open slots, books them, and shows every booking in your dashboard. Double booking is blocked automatically.",
  },
  {
    q: "When does my physical card ship?",
    a: "As soon as your plan is active. You enter your shipping address at checkout and your card is printed and shipped free. You can track the status in your dashboard.",
  },
  {
    q: "Can I change my details after the card is printed?",
    a: "Any time. The card links to your live page, so edits show up instantly without reprinting anything.",
  },
  {
    q: "Is my payment and data secure?",
    a: "Payments are processed by Stripe; we never see or store your card number. Your data lives in an encrypted database with row-level security, so only you can access your account.",
  },
];

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "TapSynk",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "TapSynk AI Smart Business Card",
      description: "smart business card with a digital profile, one-tap contact saving and an AI marketing agent that books appointments.",
      brand: { "@type": "Brand", name: "TapSynk" },
      offers: Object.values(PLANS).map((p) => ({
        "@type": "Offer",
        name: `${p.name} (monthly)`,
        price: p.prices.month,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* ───── hero ───── */}
      <section className="grid-bg relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(29,91,255,0.16),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-2 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> The business card that talks back
            </span>
            <h1 className="mt-6 text-[2.75rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              One tap.
              <br />
              <span className="text-gradient">Your AI sells for you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              Tap your TapSynk card on any phone to share your business card, save your contact in one tap, and let an AI marketing agent explain your
              business, answer every question and book appointments, 24/7.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary px-6 py-3.5 text-base">
                Create your card free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="btn btn-cream px-6 py-3.5 text-base">
                <CalendarDays className="h-4 w-4" /> Book a free demo
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> Secure Stripe checkout</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-brand" /> Live in 3 minutes</span>
              <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-brand" /> No app needed</span>
            </div>
          </div>
          <HeroDemo />
        </div>
      </section>

      {/* ───── how it works ───── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <Reveal className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">How it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">From sign-up to first tap in minutes</h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {[
            { icon: UserPlus, t: "Create your account", d: "Sign up and add your name, title, contact details and links." },
            { icon: Bot, t: "Train your AI", d: "Paste your website or type your services. Your agent learns it all." },
            { icon: Lock, t: "Choose a plan", d: "Pay securely with Stripe and enter where we ship your card." },
            { icon: MousePointer2, t: "Tap & grow", d: "Tap any phone. People save you, chat with your AI and book." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 90}>
              <div className="card-surface h-full p-6">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><s.icon className="h-5 w-5" /></div>
                  <span className="font-mono text-sm text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-bold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───── print demo ───── */}
      <section className="bg-white py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Your card, printed</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">Watch your card come to life</h2>
            <p className="mt-4 text-lg text-ink-2">
              The moment you publish, your card prints right on screen, and the same design is printed on a premium smart card and shipped to your door.
            </p>
            <ul className="mt-6 space-y-3 text-ink-2">
              <li className="flex gap-3"><QrCode className="h-5 w-5 text-brand" /> Tap to connect, with QR backup on every card</li>
              <li className="flex gap-3"><Globe className="h-5 w-5 text-brand" /> Your own shareable TapSynk profile link</li>
              <li className="flex gap-3"><Zap className="h-5 w-5 text-brand" /> Update details any time, no reprint needed</li>
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <CardPrinter
              autoStart={false}
              card={{ full_name: "Priya Sharma", job_title: "Principal Architect", company: "Studio Lumen", accent: "#7c5cff", ai: true }}
              title="Card printed"
              subtitle="Ready to tap. Ready to impress."
            />
          </Reveal>
        </div>
      </section>

      {/* ───── AI section ───── */}
      <section id="ai" className="relative scroll-mt-16 overflow-hidden bg-navy py-24 text-white">
        <div className="absolute -left-40 top-0 h-[30rem] w-[30rem] rounded-full bg-brand/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-2">AI marketing agent</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">A salesperson in every pocket you tap</h2>
            <p className="mt-4 text-lg text-white/70">
              Every AI Card gets an “Ask my AI anything” button. Your agent says hello out loud, explains what you do, answers questions by voice or chat in any
              language, and books meetings, even while you sleep.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Mic, t: "Talks and listens", d: "Visitors can speak to your AI and hear it answer, like a phone call. Typing works too." },
              { icon: Globe, t: "Learns from your website", d: "Paste a link. We read your pages and turn them into a knowledge base in seconds." },
              { icon: Bot, t: "Answers every question", d: "Services, pricing, hours, location: accurate answers grounded in your info only." },
              { icon: CalendarCheck, t: "Books appointments", d: "Offers real open slots in your timezone and confirms bookings instantly." },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 100}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
                  <f.icon className="h-6 w-6 text-brand-2" />
                  <h3 className="mt-4 font-bold">{f.t}</h3>
                  <p className="mt-1.5 text-sm text-white/65">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───── growth features ───── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Grow from every tap</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">Turn introductions into customers</h2>
          <p className="mt-4 text-lg text-ink-2">TapSynk doesn't just share your details. It brings people back to you and shows you what's working.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Handshake, t: "Lead capture", d: "Visitors tap “Share my contact” and their details land in your dashboard, ready to follow up or export to CSV." },
            { icon: BarChart3, t: "Real analytics", d: "Daily views, saves, leads, AI chats and bookings, plus whether people tapped your card, scanned the QR or opened a link." },
            { icon: Building2, t: "Company cards", d: "Branded cards for your whole team, a leaderboard of top performers and one monthly bill with a team discount." },
            { icon: Gift, t: "Virtual Card free for a month", d: "Try the Virtual Card for 30 days for $0, with your physical card shipped free. Cancel any time." },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 80}>
              <div className="card-surface h-full p-6">
                <f.icon className="h-6 w-6 text-brand" />
                <h3 className="mt-4 font-bold">{f.t}</h3>
                <p className="mt-1.5 text-sm text-ink-2">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───── use cases ───── */}
      <section id="use-cases" className="scroll-mt-16 bg-white py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Built for your business</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">One card, a hundred ways to win customers</h2>
          </Reveal>
          <UseCases />
        </div>
      </section>

      {/* ───── paper vs TapSynk ───── */}
      <section className="mx-auto max-w-4xl px-5 py-24">
        <Reveal className="mb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Why switch</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">Paper cards end the conversation. TapSynk keeps it going.</h2>
        </Reveal>
        <Reveal>
          <div className="card-surface overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-line bg-bg/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted sm:gap-x-10 sm:px-8">
              <span />
              <span className="w-16 text-center sm:w-24">Paper</span>
              <span className="w-16 text-center text-brand sm:w-24">TapSynk</span>
            </div>
            {[
              "Saved to the phone in one tap",
              "Update your details without reprinting",
              "Know who viewed and saved your card",
              "Collect the other person's contact back",
              "Answers questions while you're busy",
              "Books meetings for you, 24/7",
            ].map((row) => (
              <div key={row} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-line px-5 py-3.5 text-sm last:border-0 sm:gap-x-10 sm:px-8">
                <span className="font-medium text-ink-2">{row}</span>
                <span className="grid w-16 place-items-center text-muted sm:w-24"><Minus className="h-4 w-4" aria-label="No" /></span>
                <span className="grid w-16 place-items-center sm:w-24"><span className="grid h-6 w-6 place-items-center rounded-full bg-success/10 text-success"><Check className="h-3.5 w-3.5" aria-label="Yes" /></span></span>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
          {[
            { icon: Gift, t: "First month free", d: "$0 for 30 days on the Virtual Card." },
            { icon: ArrowRightLeft, t: "Switch any time", d: "Move between Virtual and AI whenever you like." },
            { icon: ShieldCheck, t: "Cancel any time", d: "No contracts. Your card ships free." },
          ].map((p) => (
            <div key={p.t} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
              <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <span>
                <span className="block font-semibold">{p.t}</span>
                <span className="block text-muted">{p.d}</span>
              </span>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ───── pricing ───── */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24">
        <Reveal className="mb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Pricing</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">Simple monthly plans. Card included.</h2>
          <p className="mt-3 text-ink-2">Start the Virtual Card free for 30 days. Every plan ships a premium smart card to your door for free.</p>
        </Reveal>
        <PricingTable />
        <div className="mt-16">
          <CompanyPricing />
        </div>
      </section>

      {/* ───── book a demo ───── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Reveal>
          <div className="relative grid items-center gap-8 overflow-hidden rounded-[2rem] bg-navy px-8 py-12 text-white md:grid-cols-[1.4fr_1fr] md:px-12">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-2">Free 15-minute demo</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">See it working for your business before you buy</h2>
              <p className="mt-3 max-w-lg text-white/70">We&apos;ll show you a live tap, your AI agent answering real questions and booking a meeting, and the dashboard where every lead lands.</p>
            </div>
            <div className="relative flex flex-col gap-3 md:items-end">
              <Link href="/demo" className="btn btn-primary px-7 py-3.5 text-base"><CalendarDays className="h-4 w-4" /> Book a demo</Link>
              <Link href="/demo?plan=company" className="text-sm font-semibold text-white/70 hover:text-white">Buying for a team? Book a company demo →</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="scroll-mt-16 bg-white py-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-4xl font-bold tracking-tight">Questions, answered</h2>
          <div className="mt-10 divide-y divide-line rounded-2xl border border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1d5bff] to-[#0f1426] px-8 py-16 text-center text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:22px_22px]" />
          <h2 className="relative text-4xl font-bold tracking-tight">Make every introduction count</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/75">Design your card free, then go live. The Virtual Card's first month is on us.</p>
          <Link href="/signup" className="btn btn-cream relative mt-8 px-7 py-3.5 text-base">
            Create your card <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
