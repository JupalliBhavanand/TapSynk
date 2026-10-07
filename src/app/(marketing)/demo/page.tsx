import type { Metadata } from "next";
import { BarChart3, Bot, CalendarCheck, Clock, MousePointer2, ShieldCheck, Users } from "lucide-react";
import { DemoForm } from "@/components/DemoForm";

export const metadata: Metadata = {
  title: "Book a free demo",
  description: "See how a TapSynk smart business card and AI agent can share your details, answer questions and book meetings for you. Book a free 15-minute demo.",
  alternates: { canonical: "/demo" },
};

const AGENDA = [
  { icon: MousePointer2, t: "A live tap", d: "See your contact saved on a phone in one tap, no app needed." },
  { icon: Bot, t: "Your AI agent in action", d: "Watch it answer questions about a business and book a real meeting." },
  { icon: BarChart3, t: "Leads and analytics", d: "Where every contact, chat and booking lands, and how to follow up." },
  { icon: Users, t: "Team setup", d: "Branded cards for your whole team with one bill (if you need it)." },
];

export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  const { plan } = await searchParams;
  const interest = plan === "virtual" || plan === "company" || plan === "ai" ? plan : "ai";

  return (
    <main className="grid-bg relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(29,91,255,0.14),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-14 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
        <div className="fade-up">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Book a demo</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            See TapSynk <span className="text-gradient">sell for you</span> in 15 minutes
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-2">
            Pick a time that suits you and we&apos;ll walk you through the card, the AI agent and the dashboard, set up around your own business.
          </p>
          <ul className="mt-8 space-y-5">
            {AGENDA.map((a) => (
              <li key={a.t} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-line"><a.icon className="h-5 w-5" /></span>
                <span>
                  <span className="block font-semibold">{a.t}</span>
                  <span className="block text-sm text-muted">{a.d}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand" /> 15 minutes</span>
            <span className="flex items-center gap-1.5"><CalendarCheck className="h-4 w-4 text-brand" /> At a time that suits you</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> No obligation</span>
          </div>
        </div>
        <div className="fade-up lg:pt-4">
          <DemoForm defaultInterest={interest} />
        </div>
      </div>
    </main>
  );
}
