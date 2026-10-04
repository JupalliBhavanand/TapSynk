import { LogoMark } from "@/components/Logo";
import { formatMoney } from "@/lib/utils";

export interface ReceiptData {
  receiptNumber: string;
  clientName: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  date: string; // ISO
  items: { label: string; amount: number | null }[]; // cents; null renders "INCLUDED"
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  shipTo?: string;
}

function Barcode({ value }: { value: string }) {
  // Deterministic bar pattern derived from the receipt number.
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  let seed = [...value].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  while (x < 260) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const w = 1 + (seed % 3);
    const gap = 1 + ((seed >> 4) % 2);
    bars.push({ x, w });
    x += w + gap;
  }
  return (
    <svg viewBox="0 0 260 44" className="mx-auto h-11 w-[85%]" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="44" fill="#0d1120" />
      ))}
    </svg>
  );
}

const Row = ({ label, value, className = "" }: { label: string; value: string; className?: string }) => (
  <div className={`flex justify-between gap-4 ${className}`}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

export function Receipt({ data, stamped }: { data: ReceiptData; stamped: boolean }) {
  const money = (c: number) => formatMoney(c, data.currency);
  const date = new Date(data.date);
  const longDate = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const stampDate = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  return (
    <div className="zigzag relative bg-white px-6 pb-10 pt-6 font-mono text-[11.5px] leading-relaxed text-ink shadow-[0_20px_40px_-24px_rgba(13,17,32,0.45)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-bold tracking-[0.12em] text-brand">TAPSYNC</p>
          <p className="tracking-[0.08em] text-muted">NFC CARD &amp; PLAN RECEIPT</p>
        </div>
        <LogoMark className="h-9 w-9" />
      </div>

      <div className="mt-4 flex items-center justify-between bg-bg px-2 py-1 font-semibold">
        <span className="truncate">CLIENT: {data.clientName.toUpperCase()}</span>
        {data.cardLast4 && (
          <span className="shrink-0 pl-2 capitalize">
            {data.cardBrand ?? "Card"} ···· {data.cardLast4}
          </span>
        )}
      </div>

      <div className="relative mt-3">
        <p className="text-[26px] font-bold tracking-tight">{money(data.total)}</p>
        <p className="text-[10px] tracking-[0.08em] text-muted">
          {longDate} | INVOICE PAID
        </p>
        {stamped && (
          <div className="stamp absolute -top-3 right-0 rounded-md border-[2.5px] border-dashed border-stamp px-3 py-1 text-center text-stamp [transform:rotate(-12deg)]">
            <p className="text-[22px] font-extrabold leading-none tracking-[0.1em]">PAID</p>
            <p className="text-[9px] font-bold tracking-[0.08em]">{stampDate}</p>
          </div>
        )}
      </div>

      <div className="my-3 border-t border-dashed border-line" />
      <div className="space-y-1.5">
        {data.items.map((it) => (
          <Row key={it.label} label={it.label} value={it.amount === null ? "INCLUDED" : money(it.amount)} />
        ))}
      </div>
      <div className="my-3 border-t border-dashed border-line" />
      <div className="space-y-1 text-ink-2">
        <Row label="Subtotal" value={money(data.subtotal)} />
        {data.discount > 0 && <Row label="Discount (Promo)" value={`-${money(data.discount)}`} className="text-stamp" />}
        <Row label="Shipping" value="FREE" />
        <Row label="Tax" value={money(data.tax)} />
      </div>
      <div className="my-3 border-t-2 border-ink/80" />
      <Row label="GRAND TOTAL" value={money(data.total)} className="text-[13px] font-bold" />

      {data.shipTo && (
        <p className="mt-3 text-[10px] uppercase tracking-[0.06em] text-muted">
          <span className="font-semibold text-ink-2">Ship to:</span> {data.shipTo}
        </p>
      )}

      <p className="mx-auto mt-5 max-w-[16rem] text-center text-[10.5px] font-semibold tracking-[0.1em]">
        THANK YOU FOR TAPPING INTO THE FUTURE WITH TAPSYNC!
      </p>
      <div className="mt-3">
        <Barcode value={data.receiptNumber} />
        <p className="mt-1 text-center text-[10px] tracking-[0.12em] text-muted">{data.receiptNumber}</p>
      </div>
    </div>
  );
}
