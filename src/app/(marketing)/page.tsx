import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  Gift,
  Globe,
  Handshake,
  Lock,
  Nfc,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
import { CardPrinter } from "@/components/CardPrinter";
import { HeroDemo } from "@/components/HeroDemo";
import { CompanyPricing } from "@/components/CompanyPricing";
import { PricingTable } from "@/components/PricingTable";
import { Reveal } from "@/components/Reveal";
import { SITE_URL } from "@/lib/env";
import { PLANS } from "@/lib/plans";

const faqs = [
  {
    q: "Is the first month really free?",
    a: "Yes. Individual Virtual and AI Card plans cost $0 for the first 30 days, and your NFC card still ships free. After that your plan's price starts automatically. Cancel any time in the first month and you won't be charged. One free month per account.",
  },
  {
    q: "Can I get cards for my whole team?",
    a: "Yes. The Company plan gives every employee a branded card, a team analytics dashboard and one monthly bill. It's priced per card with a team discount of 10% to 20% depending on team size. Company plans are billed monthly and don't include a free month.",
  },
  {
    q: "Does the NFC card work with every phone?",
    a: "Yes. Every modern iPhone (XR and newer) and almost every Android phone reads NFC without an app. For older phones there's a QR code on the back that opens the same card.",
  },
  {
    q: "How does the AI agent learn about my business?",
    a: "Paste your website link and TapSync reads your pages and builds a knowledge base. You can also type in your services, prices and FAQs. The AI only answers from what you give it.",
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
      name: "TapSync",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "TapSync AI NFC Business Card",
      description: "NFC business card with a digital profile, one-tap contact saving and an AI marketing agent that books appointments.",
      brand: { "@type": "Brand", name: "TapSync" },
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
              Tap your TapSync card on any phone to share your business card, save your contact in one tap, and let an AI marketing agent explain your
              business, answer every question and book appointments, 24/7.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary px-6 py-3.5 text-base">
                Create your card free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="btn btn-cream px-6 py-3.5 text-base">
                See pricing
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
            { icon: Nfc, t: "Tap & grow", d: "Tap any phone. People save you, chat with your AI and book." },
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
              The moment you publish, your card prints right on screen, and the same design is printed on a premium NFC card and shipped to your door.
            </p>
            <ul className="mt-6 space-y-3 text-ink-2">
              <li className="flex gap-3"><QrCode className="h-5 w-5 text-brand" /> NFC chip plus QR backup on every card</li>
              <li className="flex gap-3"><Globe className="h-5 w-5 text-brand" /> Your own link: tapsync.app/c/your-name</li>
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
              Every card gets a “Talk to AI” button. Your agent explains what you do, handles objections, answers pricing questions and books meetings, even
              while you sleep.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
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
          <p className="mt-4 text-lg text-ink-2">TapSync doesn't just share your details. It brings people back to you and shows you what's working.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Handshake, t: "Lead capture", d: "Visitors tap “Share my contact” and their details land in your dashboard, ready to follow up or export to CSV." },
            { icon: BarChart3, t: "Real analytics", d: "Daily views, saves, leads, AI chats and bookings, plus whether people tapped your card, scanned the QR or opened a link." },
            { icon: Building2, t: "Company cards", d: "Branded cards for your whole team, a leaderboard of top performers and one monthly bill with a team discount." },
            { icon: Gift, t: "First month free", d: "Try everything for 30 days for $0, with your physical card shipped free. Cancel any time." },
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

      {/* ───── pricing ───── */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24">
        <Reveal className="mb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Pricing</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">First month free. Card included.</h2>
          <p className="mt-3 text-ink-2">Pay $0 for 30 days. Every plan ships a premium NFC card to your door for free.</p>
        </Reveal>
        <PricingTable />
        <div className="mt-16">
          <CompanyPricing />
        </div>
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
          <p className="relative mx-auto mt-3 max-w-xl text-white/75">Design your card free, then go live with your first month on us.</p>
          <Link href="/signup" className="btn btn-cream relative mt-8 px-7 py-3.5 text-base">
            Create your card <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
