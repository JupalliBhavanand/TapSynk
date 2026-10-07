import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReceiptPrinter } from "@/components/ReceiptPrinter";
import { requireDashboardData } from "@/lib/data";
import { orderToReceipt } from "@/lib/receipt";
import type { Order } from "@/lib/types";

export default async function ReceiptPage({ params }: PageProps<"/dashboard/billing/receipt/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, name } = await requireDashboardData();
  const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle(); // RLS: own orders only
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/billing" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to billing</Link>
      <ReceiptPrinter data={orderToReceipt(data as Order, name)} />
    </div>
  );
}
