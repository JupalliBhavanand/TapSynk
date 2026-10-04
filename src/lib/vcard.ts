import type { Card } from "@/lib/types";

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
}

/** vCard 3.0: the most widely supported format on iOS and Android contacts. */
export function buildVCard(card: Card, cardUrl: string, photo?: { base64: string; type: string }) {
  const [first, ...rest] = card.full_name.trim().split(/\s+/);
  const last = rest.join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first ?? "")};;;`,
    `FN:${esc(card.full_name)}`,
    card.company && `ORG:${esc(card.company)}`,
    card.job_title && `TITLE:${esc(card.job_title)}`,
    card.phone && `TEL;TYPE=CELL:${esc(card.phone)}`,
    card.email && `EMAIL;TYPE=INTERNET:${esc(card.email)}`,
    card.website && `URL:${esc(card.website)}`,
    card.address && `ADR;TYPE=WORK:;;${esc(card.address)};;;;`,
    card.bio && `NOTE:${esc(card.bio)}`,
    `URL;TYPE=TapSync:${cardUrl}`,
    photo && `PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.base64}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}
