"use client";

import { useEffect, useState } from "react";
import { Check, Copy, FileText, Printer as PrinterIcon } from "lucide-react";
import { Printer } from "@/components/Printer";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { formatMoney } from "@/lib/utils";

type Phase = "idle" | "printing" | "printed" | "torn";

/** The reference "Advance Receipt Print" animation, driven by a real Stripe payment. */
export function ReceiptPrinter({ data, autoStart = true }: { data: ReceiptData; autoStart?: boolean }) {
  const [run, setRun] = useState(autoStart ? 1 : 0);
  const [phase, setPhase] = useState<Phase>(autoStart ? "printing" : "idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!run) return;
    const t = setTimeout(() => setPhase("printed"), 3300);
    return () => clearTimeout(t);
  }, [run]);

  function print() {
    setRun((r) => r + 1);
    setPhase("printing");
  }

  async function copy() {
    const lines = [
      `TapSync receipt ${data.receiptNumber}`,
      ...data.items.map((i) => `${i.label}: ${i.amount === null ? "Included" : formatMoney(i.amount, data.currency)}`),
      `Total paid: ${formatMoney(data.total, data.currency)}`,
      `Date: ${new Date(data.date).toLocaleDateString()}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const heading =
    phase === "idle" ? "Your receipt is ready" : phase === "printing" ? "Printing your receipt…" : phase === "torn" ? "Receipt cut & torn" : "Payment successful";
  const sub =
    phase === "idle"
      ? "Print a fresh copy any time."
      : phase === "torn"
        ? "Ready to print a fresh copy anytime."
        : "You're all set. Your NFC card is on its way.";

  return (
    <div className="w-full">
      <Printer active={phase === "printing"} width="max-w-[26rem]">
        {run > 0 && (
          <div key={run} className={phase === "torn" ? "tear" : ""}>
            <div className="feed" style={{ ["--feed-duration" as string]: "3.2s", ["--feed-steps" as string]: 44 }}>
              <div className="pt-5">
                <Receipt data={data} stamped={phase === "printed" || phase === "torn"} />
              </div>
            </div>
          </div>
        )}
        {run === 0 && <div className="h-6" />}
      </Printer>

      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        <p className="mt-1 text-muted">{sub}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-cream" onClick={print} disabled={phase === "printing"}>
            <PrinterIcon className="h-4 w-4" /> {run === 0 ? "Print receipt" : "Re-print receipt"}
          </button>
          {phase === "printed" && (
            <button type="button" className="btn btn-dashed" onClick={() => setPhase("torn")}>
              <FileText className="h-4 w-4" /> Tear receipt
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
