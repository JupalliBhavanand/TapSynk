"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, CalendarDays, Check, Handshake, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { emptyNotifications, newNotificationItems, notificationHref, type NotificationSnapshot, type OwnerNotification } from "@/lib/notification-types";

type InboxContext = NotificationSnapshot & { error: string; markRead: (id?: string) => Promise<void>; retryEmail: (item: OwnerNotification) => Promise<void> };
const Inbox = createContext<InboxContext>({ ...emptyNotifications, error: "", markRead: async () => {}, retryEmail: async () => {} });
export const useNotifications = () => useContext(Inbox);
export function NotificationBadge({ count }: { count: number }) {
  return count > 0 ? <span aria-label={`${count} unread notifications`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{count > 99 ? "99+" : count}</span> : null;
}

export function NotificationProvider({ userId, initial, children }: { userId: string; initial: NotificationSnapshot; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<OwnerNotification[]>([]);
  const seen = useRef(new Set(initial.items.map(item => item.id)));
  const inFlight = useRef<AbortController | null>(null);
  const addFresh = useCallback((items: OwnerNotification[]) => {
    const fresh = newNotificationItems(seen.current, items);
    if (fresh.length) setToasts(previous => [...previous, ...fresh].slice(-3));
  }, []);
  const refresh = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const response = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Could not refresh notifications.");
      const next: NotificationSnapshot = await response.json();
      if (controller.signal.aborted) return;
      if (!next.available) { setError("Notifications are temporarily unavailable."); return; }
      addFresh(next.items);
      setSnapshot(next);
      setError("");
    } catch { if (!controller.signal.aborted) setError("Could not refresh notifications. Retrying shortly."); }
  }, [addFresh]);
  const post = useCallback(async (body: object) => {
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Could not update notifications."); }
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update notifications."); }
  }, [refresh]);
  const markRead = useCallback(async (id?: string) => { await post(id ? { action: "read", id } : { action: "read_all" }); }, [post]);
  const retryEmail = useCallback(async (item: OwnerNotification) => {
    if (item.email_status === "uncertain" && !window.confirm("Delivery could not be confirmed. Check your inbox first. Send this notification email again?")) return;
    await post({ action: "retry_email", id: item.id, acknowledgeUncertain: item.email_status === "uncertain" });
  }, [post]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    const db = createClient();
    const channel = db.channel(`owner-notifications-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `owner_id=eq.${userId}` }, payload => {
      if (payload.eventType === "INSERT" && payload.new.owner_id === userId) addFresh([payload.new as OwnerNotification]);
      void refresh();
    }).subscribe();
    return () => { clearTimeout(timer); clearInterval(poll); inFlight.current?.abort(); document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", resume); void db.removeChannel(channel); };
  }, [userId, refresh, addFresh]);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts(previous => previous.slice(1)), 8000);
    return () => clearTimeout(timer);
  }, [toasts]);
  return <Inbox.Provider value={{ ...snapshot, error, markRead, retryEmail }}>{children}
    <div aria-live="polite" aria-label="New activity" className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[calc(100%-40px)] max-w-sm flex-col gap-3">
      {toasts.map(item => <div key={item.id} className="notification-toast pointer-events-auto flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-2xl"><span className="h-fit rounded-xl bg-brand-soft p-2.5 text-brand">{item.kind === "lead" ? <Handshake size={18} /> : <CalendarDays size={18} />}</span><Link href={notificationHref(item.href)} onClick={() => void markRead(item.id)} className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 break-words text-xs leading-relaxed text-muted">{item.body}</p><span className="mt-2 block text-[10px] font-semibold text-brand">View {item.kind === "lead" ? "lead" : "appointment"} →</span></Link><button type="button" aria-label="Dismiss notification popup" className="h-fit p-1 text-muted" onClick={() => setToasts(previous => previous.filter(value => value.id !== item.id))}><X size={14} /></button></div>)}
    </div>
  </Inbox.Provider>;
}

export function NotificationBell() {
  const inbox = useNotifications();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={container} className="relative">
    <button ref={button} type="button" aria-label={`Notifications, ${inbox.counts.total} unread`} aria-expanded={open} aria-controls="notification-inbox" onClick={() => setOpen(value => !value)} className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-ink-2 shadow-sm"><Bell size={17} />{inbox.counts.total > 0 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-stamp px-1.5 py-0.5 text-[9px] font-bold text-white">{inbox.counts.total > 99 ? "99+" : inbox.counts.total}</span>}</button>
    {open && <section id="notification-inbox" aria-label="Notifications" className="fixed right-4 top-20 z-[65] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl lg:absolute lg:left-0 lg:right-auto lg:top-12"><div className="flex items-center justify-between border-b border-line px-4 py-4"><h2 className="text-sm font-bold">Notifications <span className="text-xs font-normal text-muted">({inbox.counts.total} unread)</span></h2>{inbox.counts.total > 0 && <button type="button" onClick={() => void inbox.markRead()} className="flex items-center gap-1 text-[10px] font-semibold text-brand"><Check size={12} />Read all</button>}</div>
      {(!inbox.available || inbox.error) && <p role="status" className="border-b border-line px-4 py-3 text-xs text-muted">{inbox.error || "Notifications are temporarily unavailable."}</p>}
      <div className="max-h-[min(65vh,480px)] overflow-y-auto">{!inbox.items.length ? <div className="px-6 py-10 text-center"><Bell size={22} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold">{inbox.available ? "You’re all caught up" : "Activity inbox unavailable"}</p><p className="mt-1 text-xs text-muted">{inbox.available ? "New leads and appointments will appear here." : "We’ll keep trying to reconnect."}</p></div> : inbox.items.map(item => <article key={item.id} className={`border-b border-line p-4 last:border-0 ${!item.read_at ? "bg-brand-soft/30" : ""}`}><Link href={notificationHref(item.href)} onClick={() => { void inbox.markRead(item.id); setOpen(false); }} className="flex items-start gap-3"><span className="mt-0.5 text-brand">{item.kind === "lead" ? <Handshake size={16} /> : <CalendarDays size={16} />}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold">{item.title}</p><p className="mt-1 break-words text-xs leading-relaxed text-muted">{item.body}</p><time className="mt-2 block text-[10px] text-muted" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>{!item.read_at && <span aria-label="Unread" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}</Link>{["failed", "uncertain"].includes(item.email_status) && <div className="ml-7 mt-2 flex items-center justify-between gap-2 text-[10px] text-muted"><span>{item.email_status === "uncertain" ? "Email delivery unconfirmed" : "Email was not delivered"}</span><button type="button" onClick={() => void inbox.retryEmail(item)} className="font-semibold text-brand">Retry email</button></div>}</article>)}</div>
      <div className="border-t border-line px-4 py-2.5 text-[10px] text-muted">Recent activity · Unread counts sync across devices</div>
    </section>}
  </div>;
}
