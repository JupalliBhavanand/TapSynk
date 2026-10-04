import type { ReceiptData } from "@/components/Receipt";
import { INTERVALS, PLANS } from "@/lib/plans";
import type { Order } from "@/lib/types";

export function orderToReceipt(order: Order, fallbackName: string): ReceiptData {
  const a = order.shipping_address;
  return {
    receiptNumber: order.receipt_number,
    clientName: order.shipping_name || fallbackName,
    cardBrand: order.card_brand,
    cardLast4: order.card_last4,
    date: order.created_at,
    items: [
      { label: `1X ${PLANS[order.tier].name} (${INTERVALS[order.billing_interval].label})`, amount: order.amount_subtotal },
      { label: "1X Premium NFC Card (printed)", amount: null },
      { label: `1X AI-ready card page${order.tier === "ai" ? " + AI agent" : ""}`, amount: null },
    ],
    subtotal: order.amount_subtotal,
    discount: order.amount_discount,
    tax: order.amount_tax,
    total: order.amount_total,
    currency: order.currency,
    shipTo: a ? [a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ") : undefined,
  };
}
