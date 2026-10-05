import type { EventSource } from "@/lib/types";

/** Card links carry ?s=t (tapped physical card) or ?s=q (QR code); anything else counts as a shared link. */
export function parseSource(raw: unknown): EventSource {
  return raw === "t" || raw === "tap" ? "tap" : raw === "q" || raw === "qr" ? "qr" : "link";
}
