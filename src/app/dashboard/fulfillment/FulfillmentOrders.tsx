"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, CalendarDays, Truck } from "lucide-react";
import { PhysicalCard } from "@/components/PhysicalCard";
import { Chips, ListSkeleton, matches, NoMatches, SearchBox, useHydrated } from "@/components/ListToolbar";
import { PLANS, INTERVALS } from "@/lib/plans";
import type { Card, Order } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { setOrderFulfillmentStatus } from "./actions";

const STATUSES = {
  processing: "Processing",
  printing: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
} as const;

type Status = keyof typeof STATUSES;

export type CardPrintDetails = Pick<Card, "slug" | "full_name" | "job_title" | "company" | "accent" | "logo_url">;

export type FulfillmentOrder = Pick<Order,
  "id" | "receipt_number" | "tier" | "billing_interval" | "amount_total" | "currency" | "shipping_name" | "shipping_address" | "fulfillment_status" | "company_id" | "quantity" | "created_at"
> & { cardDetails: CardPrintDetails[] };

export function FulfillmentOrders({ orders, cardDetailsError, siteUrl }: { orders: FulfillmentOrder[]; cardDetailsError: boolean; siteUrl: string }) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const counts = useMemo(() => {
    const result = Object.fromEntries(Object.keys(STATUSES).map((key) => [key, 0])) as Record<Status, number>;
    for (const order of orders) result[order.fulfillment_status] += 1;
    return result;
  }, [orders]);
  const cardsToShip = orders.reduce((total, order) => total + (["processing", "printing"].includes(order.fulfillment_status) ? order.quantity : 0), 0);
  const shown = orders.filter((order) => {
    const address = order.shipping_address;
    return (status === "all" || order.fulfillment_status === status) && matches(
      query,
      order.receipt_number,
      order.shipping_name,
      order.tier,
      order.billing_interval,
      address?.line1,
      address?.line2,
      address?.city,
      address?.state,
      address?.postal_code,
      address?.country,
    );
  });

  return (
    <div className="mt-8 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Orders" value={String(orders.length)} />
        <Summary label="Cards to ship" value={String(cardsToShip)} />
        <Summary label="Shipped or delivered" value={String(counts.shipped + counts.delivered)} />
      </div>

      {cardDetailsError && <p className="rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">Order records loaded, but saved card details couldn&apos;t be fetched.</p>}

      {orders.length === 0 ? (
        <div className="card-surface p-10 text-center text-sm text-muted">No card orders yet. New paid checkouts will appear here.</div>
      ) : (
        <>
          <SearchBox value={query} onChange={setQuery} placeholder="Search receipt, recipient or shipping address" />
          <Chips
            label="Fulfillment status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All orders", count: orders.length },
              ...(Object.keys(STATUSES) as Status[]).map((key) => ({ value: key, label: STATUSES[key], count: counts[key] })),
            ]}
          />
          {!hydrated ? (
            <ListSkeleton />
          ) : shown.length === 0 ? (
            <NoMatches onClear={() => { setQuery(""); setStatus("all"); }} />
          ) : (
            <ul className="card-surface divide-y divide-line overflow-hidden">
              {shown.map((order) => <OrderRow key={order.id} order={order} siteUrl={siteUrl} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function OrderRow({ order, siteUrl }: { order: FulfillmentOrder; siteUrl: string }) {
  const address = order.shipping_address;
  const lines = [
    address?.line1,
    address?.line2,
    [address?.city, address?.state, address?.postal_code].filter(Boolean).join(", "),
    address?.country,
  ].filter(Boolean);

  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{order.receipt_number}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" /> Ordered {formatDate(order.created_at)}</p>
        </div>
        <StatusSelect id={order.id} status={order.fulfillment_status} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <div>
          <p className="font-semibold">{order.shipping_name || "Recipient not provided"}</p>
          <div className="mt-1 flex items-start gap-2 text-sm text-ink-2">
            <span className="mt-0.5 text-muted"><Truck className="h-4 w-4" /></span>
            <address className="not-italic">{lines.length ? lines.map((line, index) => <span className="block" key={`${line}-${index}`}>{line}</span>) : <span className="text-muted">No shipping address on this order</span>}</address>
          </div>
        </div>
        <div>
          <p className="font-semibold">{PLANS[order.tier].name}</p>
          <p className="mt-1 text-sm text-ink-2">{order.quantity} {order.quantity === 1 ? "card" : "cards"} · {INTERVALS[order.billing_interval].label}</p>
          {order.company_id && <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted"><Building2 className="h-3.5 w-3.5" /> Company order</p>}
        </div>
        <p className="font-semibold tabular-nums sm:text-right">{formatMoney(order.amount_total, order.currency)}</p>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-bg/70 p-4">
        <h3 className="text-sm font-bold">Card to print · current saved details</h3>
        {order.cardDetails.length ? (
          <CardPreviews order={order} siteUrl={siteUrl} />
        ) : (
          <p className="mt-2 text-sm text-muted">No saved card profile yet. The customer may need to finish setting up their card before printing.</p>
        )}
      </section>
    </li>
  );
}

function CardPreviews({ order, siteUrl }: { order: FulfillmentOrder; siteUrl: string }) {
  const [showAll, setShowAll] = useState(false);
  const previewCards = showAll ? order.cardDetails : order.cardDetails.slice(0, 3);

  return (
    <>
      <ul className="mt-3 divide-y divide-line">
        {previewCards.map((card, index) => (
          <li key={`${order.id}-card-${index}`} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(220px,360px)_1fr] sm:items-center">
            <div className="[container-type:inline-size]">
              <FlippableCard card={card} siteUrl={siteUrl} ai={order.tier === "ai"} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{card.full_name || "Name not entered"}</p>
              <p className="text-sm text-ink-2">{[card.job_title, card.company].filter(Boolean).join(" · ") || "Title or company not entered"}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-muted">
                <span aria-hidden="true" className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: card.accent }} />
                Card accent <span className="font-mono text-ink-2">{card.accent}</span>
              </p>
              <a href={`${siteUrl}/c/${card.slug}`} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-semibold text-brand hover:underline">
                {siteUrl}/c/{card.slug}
              </a>
            </div>
          </li>
        ))}
      </ul>
      {order.cardDetails.length > 3 && (
        <button type="button" onClick={() => setShowAll((shown) => !shown)} className="mt-3 text-sm font-semibold text-brand hover:underline">
          {showAll ? "Show fewer card previews" : `Show all ${order.cardDetails.length} card previews`}
        </button>
      )}
    </>
  );
}

function FlippableCard({ card, siteUrl, ai }: { card: CardPrintDetails; siteUrl: string; ai: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const cardUrl = `${siteUrl}/c/${card.slug}`;

  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      aria-label={`Card preview: ${flipped ? "back" : "front"} side. Click to flip.`}
      aria-pressed={flipped}
      className="relative block aspect-[1.586] w-full cursor-pointer rounded-[18px] text-left [perspective:1000px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      title="Click to flip the card"
    >
      <span className="sr-only">Click to flip between the front and back of the card.</span>
      <div
        className="absolute inset-0 transition-transform duration-700 motion-reduce:transition-none"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", transformStyle: "preserve-3d" }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <PhysicalCard card={{ ...card, ai }} className="h-full" />
        </div>
        <div
          className="absolute inset-0 flex h-full flex-col justify-between overflow-hidden rounded-[18px] p-[7%] text-white shadow-[0_24px_50px_-20px_rgba(15,20,38,0.7)]"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `radial-gradient(120% 140% at 100% 0%, ${card.accent}cc 0%, transparent 55%), linear-gradient(145deg, #1b2240 0%, #0b0f1d 100%)`,
          }}
        >
          <span aria-hidden="true" className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
          <span className="relative flex items-center gap-2 text-sm font-bold tracking-wide">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-xs">Tk</span>
            TapSynk
          </span>
          <span className="relative text-center">
            <span className="block text-[clamp(14px,4cqw,20px)] font-bold">Tap to connect</span>
            <span className="mt-1 block text-[clamp(9px,2.5cqw,12px)] text-white/70">Your digital business card</span>
          </span>
          <span className="relative block break-all rounded-lg bg-white/10 px-3 py-2 text-center font-mono text-[clamp(8px,2.2cqw,11px)] text-white/90">
            {cardUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
      </div>
    </button>
  );
}

function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  return (
    <select
      aria-label={`Fulfillment status for ${id}`}
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as Status;
        const previous = value;
        setValue(next);
        start(async () => {
          if (!(await setOrderFulfillmentStatus(id, next)).ok) setValue(previous);
        });
      }}
      className="input w-auto py-1.5 text-xs font-bold"
    >
      {(Object.keys(STATUSES) as Status[]).map((key) => <option key={key} value={key}>{STATUSES[key]}</option>)}
    </select>
  );
}
