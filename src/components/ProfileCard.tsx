import type { ReactNode } from "react";
import { Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, LinkedinIcon, XIcon, YoutubeIcon } from "@/components/BrandIcons";
import type { Card } from "@/lib/types";
import { initials, safeUrl } from "@/lib/utils";

type CardView = Pick<
  Card,
  "full_name" | "job_title" | "company" | "bio" | "email" | "phone" | "website" | "address" | "avatar_url" | "logo_url" | "accent" | "socials"
>;

function ContactRow({ href, icon, label, value }: { href?: string; icon: ReactNode; label: string; value: string }) {
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg text-ink-2">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className="block truncate text-sm font-medium">{value}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-bg">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-3 p-2">{content}</div>
  );
}

/** The digital business card people see after tapping. */
export function ProfileCard({ card, actions }: { card: CardView; actions?: ReactNode }) {
  const s = card.socials ?? {};
  const socials = [
    { key: "linkedin", href: s.linkedin, icon: LinkedinIcon, label: "LinkedIn" },
    { key: "instagram", href: s.instagram, icon: InstagramIcon, label: "Instagram" },
    { key: "x", href: s.x, icon: XIcon, label: "X" },
    { key: "facebook", href: s.facebook, icon: FacebookIcon, label: "Facebook" },
    { key: "youtube", href: s.youtube, icon: YoutubeIcon, label: "YouTube" },
    { key: "whatsapp", href: s.whatsapp ? `https://wa.me/${s.whatsapp.replace(/[^\d]/g, "")}` : "", icon: MessageCircle, label: "WhatsApp" },
  ].filter((x) => x.href && (x.key === "whatsapp" || safeUrl(x.href)));
  const website = safeUrl(card.website);

  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_30px_70px_-30px_rgba(13,17,32,0.35)] ring-1 ring-line">
      <div className="relative h-32" style={{ background: `radial-gradient(120% 140% at 100% 0%, ${card.accent} 0%, transparent 60%), linear-gradient(140deg, #1b2240, #0b0f1d)` }}>
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        {card.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.logo_url} alt={`${card.company} logo`} className="absolute right-5 top-5 h-10 w-10 rounded-xl bg-white/90 object-contain p-1" />
        )}
      </div>
      <div className="px-6 pb-6">
        <div className="relative -mt-12 flex items-end gap-4">
          {card.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.avatar_url} alt={card.full_name} className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-lg" />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-3xl border-4 border-white text-3xl font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${card.accent}, #0f1426)` }}>
              {initials(card.full_name)}
            </div>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{card.full_name || "Your Name"}</h1>
        <p className="text-sm font-medium text-ink-2">{[card.job_title, card.company].filter(Boolean).join(" · ")}</p>
        {card.bio && <p className="mt-3 text-sm leading-relaxed text-muted">{card.bio}</p>}

        {actions && <div className="mt-5 grid gap-2.5">{actions}</div>}

        <div className="mt-5 space-y-1">
          {card.phone && <ContactRow href={`tel:${card.phone.replace(/[^\d+]/g, "")}`} icon={<Phone className="h-4 w-4" />} label="Phone" value={card.phone} />}
          {card.email && <ContactRow href={`mailto:${card.email}`} icon={<Mail className="h-4 w-4" />} label="Email" value={card.email} />}
          {website && <ContactRow href={website} icon={<Globe className="h-4 w-4" />} label="Website" value={website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} />}
          {card.address && (
            <ContactRow
              href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`}
              icon={<MapPin className="h-4 w-4" />}
              label="Address"
              value={card.address}
            />
          )}
        </div>

        {socials.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {socials.map(({ key, href, icon: Icon, label }) => (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-11 w-11 place-items-center rounded-2xl bg-bg text-ink-2 transition hover:-translate-y-0.5 hover:bg-navy hover:text-white">
                <Icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
