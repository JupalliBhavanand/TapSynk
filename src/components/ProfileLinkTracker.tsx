"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import type { LinkClickSource } from "@/lib/profile-links";

/** Analytics never replaces the destination or waits before the browser opens it. */
export function ProfileLinkTracker({ slug, source, enabled = true, children }: { slug: string; source: LinkClickSource; enabled?: boolean; children: ReactNode }) {
  const recent = useRef(new Map<string, number>());
  function track(event: MouseEvent<HTMLDivElement>) {
    if (!enabled || !event.isTrusted || (event.button !== 0 && event.button !== 1)) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-profile-link]") : null;
    if (!target || !event.currentTarget.contains(target)) return;
    const linkId = target.dataset.profileLink;
    if (!linkId) return;
    const now = Date.now();
    if (now - (recent.current.get(linkId) ?? 0) < 2000) return;
    recent.current.set(linkId, now);
    try {
      let visitor = "";
      try {
        visitor = sessionStorage.getItem("tapsynk-click-visitor") || crypto.randomUUID();
        sessionStorage.setItem("tapsynk-click-visitor", visitor);
      } catch { /* Navigation must also work when storage is disabled. */ }
      const payload = JSON.stringify({ event_id: crypto.randomUUID(), visitor_id: visitor || undefined, link_id: linkId, link_url: target.getAttribute("href"), source, referrer: document.referrer || undefined });
      const url = `/api/clicks/${encodeURIComponent(slug)}`;
      if (navigator.sendBeacon?.(url, new Blob([payload], { type: "application/json" }))) return;
      void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true, credentials: "same-origin" }).catch(() => {});
    } catch { /* Tracking is best effort and must never interrupt a link. */ }
  }
  return <div onClickCapture={track} onAuxClickCapture={track}>{children}</div>;
}
