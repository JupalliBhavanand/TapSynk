import { initials } from "@/lib/utils";

export interface PhysicalCardData {
  full_name: string;
  job_title: string;
  company: string;
  accent: string;
  logo_url?: string;
  ai?: boolean;
}

function NfcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 8.5a5 5 0 0 1 0 7" />
      <path d="M9.5 6a9 9 0 0 1 0 12" />
      <path d="M13 3.5a13 13 0 0 1 0 17" />
    </svg>
  );
}

/** Front face of the NFC card (credit-card proportions). */
export function PhysicalCard({ card, className = "" }: { card: PhysicalCardData; className?: string }) {
  return (
    <div
      className={`relative aspect-[1.586] w-full overflow-hidden rounded-[18px] text-white shadow-[0_24px_50px_-20px_rgba(15,20,38,0.7)] ${className}`}
      style={{
        background: `radial-gradient(120% 140% at 100% 0%, ${card.accent}cc 0%, transparent 55%), linear-gradient(145deg, #1b2240 0%, #0b0f1d 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="relative flex h-full flex-col justify-between p-[7%]">
        <div className="flex items-start justify-between">
          {card.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.logo_url} alt="" className="h-9 w-9 rounded-lg bg-white/10 object-contain p-1" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-sm font-bold">{initials(card.company || card.full_name)}</div>
          )}
          <div className="flex items-center gap-1.5 text-white/80">
            {card.ai && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider">AI</span>}
            <NfcIcon className="h-6 w-6" />
          </div>
        </div>
        <div>
          <div className="mb-3 h-7 w-10 rounded-md bg-gradient-to-br from-[#f3d98b] via-[#d8b35c] to-[#a8823a] opacity-90" />
          <p className="truncate text-[clamp(15px,4.6cqw,22px)] font-bold leading-tight tracking-tight">{card.full_name || "Your Name"}</p>
          <p className="truncate text-[12px] text-white/70">
            {[card.job_title, card.company].filter(Boolean).join(" · ") || "Title · Company"}
          </p>
        </div>
      </div>
      <span className="absolute bottom-[7%] right-[7%] font-mono text-[10px] tracking-[0.2em] text-white/50">TAPSYNC</span>
    </div>
  );
}
