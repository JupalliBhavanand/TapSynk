import { initials } from "@/lib/utils";

export interface PhysicalCardData {
  full_name: string;
  job_title: string;
  company: string;
  accent: string;
  logo_url?: string;
  ai?: boolean;
}

/** Front face of the smart card (credit-card proportions). */
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
          </div>
        </div>
        <div>
          <p className="truncate text-[clamp(15px,4.6cqw,22px)] font-bold leading-tight tracking-tight">{card.full_name || "Your Name"}</p>
          <p className="truncate text-[12px] text-white/70">
            {[card.job_title, card.company].filter(Boolean).join(" · ") || "Title · Company"}
          </p>
        </div>
      </div>
      <span className="absolute bottom-[7%] right-[7%] font-mono text-[10px] tracking-[0.2em] text-white/50">TAPSYNK</span>
    </div>
  );
}
