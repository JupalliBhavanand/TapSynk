"use client";

import { useEffect, useState } from "react";
import { Bot, Share2, UserPlus } from "lucide-react";
import { ChatPanel } from "@/components/ChatWidget";

export function CardActions({ slug, ai, businessName, ownerName }: { slug: string; ai: boolean; businessName: string; ownerName: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: ownerName, url }).catch(() => {});
    else await navigator.clipboard.writeText(url);
  }

  return (
    <>
      <a href={`/api/vcard/${slug}`} className="btn btn-dark w-full py-3.5 text-base">
        <UserPlus className="h-5 w-5" /> Save contact
      </a>
      {ai && (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary relative w-full overflow-hidden py-3.5 text-base">
          <span className="absolute inset-0 -translate-x-full animate-[shine_2.8s_ease_1s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <Bot className="h-5 w-5" /> Talk to AI
        </button>
      )}
      <button type="button" onClick={share} className="btn btn-ghost w-full">
        <Share2 className="h-4 w-4" /> Share card
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div className="sheet-up h-[88dvh] w-full max-w-md sm:h-[640px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Chat with ${businessName} AI`}>
            <ChatPanel slug={slug} businessName={businessName} ownerName={ownerName} onClose={() => setOpen(false)} className="h-full rounded-t-[28px] shadow-2xl sm:rounded-[28px]" />
          </div>
        </div>
      )}
    </>
  );
}
