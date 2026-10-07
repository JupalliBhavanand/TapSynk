import type { ReceiptData } from "@/components/Receipt";
import { INTERVALS, PLANS, TRIAL_DAYS } from "@/lib/plans";
import type { Order } from "@/lib/types";

export function orderToReceipt(order: Order, fallbackName: string): ReceiptData {
  const a = order.shipping_address;
  return {
    receiptNumber: order.receipt_number,
    clientName: order.shipping_name || fallbackName,
    cardBrand: order.card_brand,
    cardLast4: order.card_last4,
    date: order.created_at,
    items: order.company_id
      ? [
          { label: `${order.quantity}X Company ${PLANS[order.tier].name} (Monthly)`, amount: order.amount_subtotal },
          { label: `${order.quantity}X Premium Smart Card (printed)`, amount: null },
          { label: "1X Team analytics dashboard", amount: null },
        ]
      : [
          {
            label: `1X ${PLANS[order.tier].name} (${INTERVALS[order.billing_interval].label})${order.amount_subtotal === 0 ? ` · FIRST ${TRIAL_DAYS} DAYS FREE` : ""}`,
            amount: order.amount_subtotal,
          },
          { label: "1X Premium Smart Card (printed)", amount: null },
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
