"use client";

import { SOCIAL_ICONS } from "@/components/BrandIcons";
import { SOCIAL_PLATFORMS, type SocialKey } from "@/lib/socials";
import type { Socials } from "@/lib/types";

/** One input per platform, each with its logo, for a card's social links. */
export function SocialFields({ value, onChange, idPrefix = "social" }: { value: Socials; onChange: (key: SocialKey, v: string) => void; idPrefix?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SOCIAL_PLATFORMS.map(({ key, label, bg, placeholder }) => {
        const Icon = SOCIAL_ICONS[key];
        const id = `${idPrefix}-${key}`;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: bg, color: key === "snapchat" ? "#111" : "#fff" }} aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor={id}>{key === "whatsapp" ? "WhatsApp number" : label}</label>
              <input
                id={id}
                value={value[key] ?? ""}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={key === "whatsapp" ? `WhatsApp ${placeholder}` : `${label} ${placeholder}`}
                type={key === "whatsapp" ? "tel" : "text"}
                maxLength={300}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="input"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
