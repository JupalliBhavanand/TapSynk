import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Circle, Eye, Sparkles, UserPlus } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { PhysicalCard } from "@/components/PhysicalCard";
import { getDashboardData } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { PLANS, INTERVALS } from "@/lib/plans";
import { formatInZone } from "@/lib/slots";
import { isActive, type Appointment } from "@/lib/types";

export default async function DashboardHome() {
  const data = (await getDashboardData())!;
  const { card, subscription, agent, supabase, trialAvailable } = data;
  const active = isActive(subscription);
  const link = card ? `${SITE_URL}/c/${card.slug}` : "";
  const qr = card ? await QRCode.toDataURL(`${link}?s=q`, { margin: 1, width: 360, color: { dark: "#0f1426", light: "#ffffff" } }) : null;

  const { data: upcoming } = card
    ? await supabase
        .from("appointments")
        .select("*")
        .eq("card_id", card.id)
        .eq("status", "confirmed")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(4)
    : { data: [] };

  const steps = [
    { done: Boolean(card), label: "Create your digital card", href: "/dashboard/card" },
    { done: Boolean(card?.published), label: "Publish & print your card", href: "/dashboard/card" },
    { done: Boolean(agent && (agent.knowledge || agent.description)), label: "Train your AI agent", href: "/dashboard/ai" },
    { done: active, label: trialAvailable ? "Start your free month & get your NFC card" : "Choose a plan & ship your NFC card", href: "/dashboard/billing" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="fade-up mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">Hi {data.name.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-muted">Here's how your card is doing.</p>

      {doneCount < steps.length && (
        <section className="card-surface mt-8 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Get set up</h2>
            <span className="text-sm font-semibold text-muted">{doneCount}/{steps.length} done</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm font-medium transition hover:border-brand/40 hover:bg-brand-soft/40">
                  {s.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-line" />}
                  <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                  {!s.done && <ArrowRight className="ml-auto h-4 w-4 text-muted" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Card views", value: card?.views ?? 0, icon: Eye },
          { label: "Contacts saved", value: card?.saves ?? 0, icon: UserPlus },
          { label: "AI conversations", value: card?.ai_opens ?? 0, icon: Bot },
          { label: "Upcoming bookings", value: upcoming?.length ?? 0, icon: CalendarDays },
        ].map((s) => (
          <div key={s.label} className="card-surface p-5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-sm font-medium">{s.label}</span>
              <s.icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card-surface p-6">
          <h2 className="font-bold">Your card</h2>
          {card ? (
            <div className="mt-5 grid items-center gap-6 sm:grid-cols-[1fr_auto]">
              <div className="[container-type:inline-size]">
                <PhysicalCard card={{ ...card, ai: subscription?.tier === "ai" }} />
              </div>
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr && <img src={qr} alt="QR code for your card" className="mx-auto h-36 w-36 rounded-xl border border-line" />}
                <p className="mt-2 text-xs text-muted">Scan to open</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <code className="truncate rounded-lg bg-bg px-3 py-2 font-mono text-xs">{link}</code>
                <CopyButton value={link} label="Copy link" />
                <Link href={`/c/${card.slug}`} target="_blank" className="btn btn-ghost py-2 text-sm">Open</Link>
                <Link href="/dashboard/card" className="btn btn-dark py-2 text-sm">Edit card</Link>
              </div>
              {!card.published && <p className="text-sm text-stamp sm:col-span-2">Your card is a draft. Publish it to make it live.</p>}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center">
              <p className="text-muted">You haven't created your card yet.</p>
              <Link href="/dashboard/card" className="btn btn-primary mt-4">Create my card</Link>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card-surface p-6">
            <h2 className="font-bold">Plan</h2>
            {active && subscription ? (
              <div className="mt-3">
                <p className="text-lg font-semibold">
                  {PLANS[subscription.tier].name} <span className="text-sm font-medium text-muted">· {INTERVALS[subscription.billing_interval].label}</span>
                </p>
                {subscription.current_period_end && (
                  <p className="text-sm text-muted">
                    {subscription.status === "trialing" ? "Free month · first charge on" : "Renews"} {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                )}
                {subscription.tier === "virtual" && (
                  <Link href="/dashboard/billing" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                    <Sparkles className="h-4 w-4" /> Upgrade to the AI Card
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-muted">
                  {trialAvailable
                    ? "Your first month is free. Pay $0 today, make your card live and get your NFC card shipped."
                    : "Choose a plan to make your card live and get your NFC card shipped."}
                </p>
                <Link href="/dashboard/billing" className="btn btn-primary mt-4">{trialAvailable ? "Start free month" : "See plans"}</Link>
              </div>
            )}
          </section>
          <section className="card-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Next appointments</h2>
              <Link href="/dashboard/appointments" className="text-sm font-semibold text-brand">View all</Link>
            </div>
            {upcoming && upcoming.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {(upcoming as Appointment[]).map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-xl bg-bg px-4 py-3 text-sm">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-muted">{formatInZone(a.starts_at, agent?.timezone || "UTC")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No upcoming bookings yet. Your AI agent books them for you.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
