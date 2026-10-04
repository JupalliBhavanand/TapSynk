"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Printer as PrinterIcon } from "lucide-react";
import { Printer } from "@/components/Printer";
import { PhysicalCard, type PhysicalCardData } from "@/components/PhysicalCard";

/**
 * Prints the user's card out of the printer, like the reference "receipt print" animation.
 * Shown the first time a card is published (and replayable).
 */
export function CardPrinter({
  card,
  link,
  autoStart = true,
  title = "Your card is printed",
  subtitle = "Tap it, share it, and let people save you in one tap.",
}: {
  card: PhysicalCardData;
  link?: string;
  autoStart?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [run, setRun] = useState(autoStart ? 1 : 0);
  const [printing, setPrinting] = useState(autoStart);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!run) return;
    const t = setTimeout(() => setPrinting(false), 2600);
    return () => clearTimeout(t);
  }, [run]);

  function print() {
    setRun((r) => r + 1);
    setPrinting(true);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="w-full">
      <Printer active={printing}>
        {run > 0 && (
          <div key={run} className="feed shine relative" style={{ ["--feed-duration" as string]: "2.4s", ["--feed-steps" as string]: 30, ["--shine-delay" as string]: "2.5s" }}>
            <div className="pt-6 [container-type:inline-size]">
              <PhysicalCard card={card} />
            </div>
          </div>
        )}
        {run === 0 && <div className="h-6" />}
      </Printer>

      <div className="mt-2 text-center">
        <h3 className="text-2xl font-bold tracking-tight">{run === 0 ? "Ready to print your card" : printing ? "Printing your card…" : title}</h3>
        <p className="mt-1 text-sm text-muted">{run === 0 ? "Press print to see it come to life." : subtitle}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-cream" onClick={print} disabled={printing}>
            <PrinterIcon className="h-4 w-4" /> {run === 0 ? "Print card" : "Re-print card"}
          </button>
          {link && (
            <>
              <button type="button" className="btn btn-ghost" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
              </button>
              <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Open card
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
