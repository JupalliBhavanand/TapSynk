import { socialLinks } from "@/lib/socials";
import type { Card } from "@/lib/types";

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// Fold at UTF-8 character boundaries so long notes and embedded photos can be
// read by mobile contact importers. Continuation lines start with one space.
function foldLine(line: string) {
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
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
    `URL;TYPE=TapSynk:${cardUrl}`,
    // iOS and many Android contact apps show these as social profiles.
    ...socialLinks(card.socials).map((s) => `X-SOCIALPROFILE;TYPE=${s.key}:${esc(s.href)}`),
    photo && `PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.base64}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.map((line) => foldLine(String(line))).join("\r\n") + "\r\n";
}
