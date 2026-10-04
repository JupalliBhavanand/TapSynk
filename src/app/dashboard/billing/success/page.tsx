import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot, IdCard } from "lucide-react";
import { ReceiptPrinter } from "@/components/ReceiptPrinter";
import { fulfillCheckout } from "@/lib/billing";
import { getDashboardData } from "@/lib/data";
import { orderToReceipt } from "@/lib/receipt";
import { stripe } from "@/lib/stripe";
import type { Order } from "@/lib/types";

export default async function SuccessPage({ searchParams }: PageProps<"/dashboard/billing/success">) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]+$/.test(sp.session_id) ? sp.session_id : null;
  if (!sessionId) redirect("/dashboard/billing");
  const { supabase, user, name, card } = (await getDashboardData())!;

  // Make sure this session belongs to the signed-in user before doing anything with it.
  const session = await stripe().checkout.sessions.retrieve(sessionId).catch(() => null);
  if (!session || (session.metadata?.user_id ?? session.client_reference_id) !== user.id) redirect("/dashboard/billing");
  await fulfillCheckout(sessionId);

  const { data } = await supabase.from("orders").select("*").eq("stripe_session_id", sessionId).maybeSingle();
  const order = data as Order | null;

  return (
    <div className="mx-auto max-w-2xl py-4">
      {order ? (
        <ReceiptPrinter data={orderToReceipt(order, name)} />
      ) : (
        <div className="card-surface p-10 text-center">
          <h1 className="text-2xl font-bold">Payment received</h1>
          <p className="mt-2 text-muted">We're finalising your order. Refresh in a moment to see your receipt.</p>
        </div>
      )}
      <div className="fade-up mt-12 grid gap-4 sm:grid-cols-2" style={{ animationDelay: "3.4s" }}>
        <Link href={card ? "/dashboard/card" : "/dashboard/card"} className="card-surface group flex items-center gap-4 p-5 transition hover:border-brand/40">
          <IdCard className="h-6 w-6 text-brand" />
          <span className="flex-1"><span className="block font-semibold">{card?.published ? "Your card is live" : "Publish your card"}</span><span className="text-sm text-muted">{card?.published ? "Polish your details" : "Print it on screen now"}</span></span>
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1" />
        </Link>
        <Link href="/dashboard/ai" className="card-surface group flex items-center gap-4 p-5 transition hover:border-brand/40">
          <Bot className="h-6 w-6 text-brand" />
          <span className="flex-1"><span className="block font-semibold">Train your AI agent</span><span className="text-sm text-muted">Learn from your website</span></span>
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
