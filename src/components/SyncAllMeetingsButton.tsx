"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { RefreshCw, CalendarDays, Square } from "lucide-react";
import { syncAllMeetingsBatch } from "@/app/dashboard/appointments/calendar-actions";
import { googleCalendarUrl } from "@/lib/google-links";

export function SyncAllMeetingsButton({ accountEmail, autoStart = false }: { accountEmail?: string | null; autoStart?: boolean }) {
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState({ processed: 0, total: 0, synced: 0, failed: 0 });
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const stopped = useRef(false);
  const started = useRef(false);
  useEffect(() => () => { stopped.current = true; }, []);
  function run() {
    if (pending) return;
    stopped.current = false;
    setComplete(false);
    setMessage("");
    setProgress({ processed: 0, total: 0, synced: 0, failed: 0 });
    start(async () => {
      let cursor: string | undefined;
      let processed = 0, total = 0, synced = 0, failed = 0;
      try {
        do {
          const batch = await syncAllMeetingsBatch(cursor);
          if (stopped.current) { setMessage("Sync stopped. Meetings already synced remain in Google Calendar."); return; }
          if (batch.fatal) { setMessage(batch.message || "Could not sync your calendar."); return; }
          if (!processed) total = batch.total;
          processed += batch.processed; synced += batch.synced; failed += batch.failed;
          setProgress({ processed, total: Math.max(total, processed), synced, failed });
          cursor = batch.nextCursor || undefined;
        } while (cursor);
        setComplete(true);
        setMessage(failed ? `${synced} appointments synced; ${failed} could not sync. Check the appointment errors and retry.` : `${synced} appointments synced, including past and upcoming meetings.`);
      } catch { setMessage("Calendar sync was interrupted. Retry safely; existing events won’t be duplicated."); }
    });
  }
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => { if (!started.current) { started.current = true; run(); } }, 0);
    return () => clearTimeout(timer);
    // Run once after the Google consent callback; manual retries use the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);
  return <div className="flex flex-col items-start gap-2">
    <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={pending} onClick={run} className="btn btn-ghost py-2 text-xs"><RefreshCw size={13} className={pending ? "animate-spin" : ""} />{pending ? `Syncing ${progress.processed}${progress.total ? ` / ${progress.total}` : ""}…` : "Sync all meetings"}</button>{pending && <button type="button" aria-label="Stop calendar sync after this batch" onClick={() => { stopped.current = true; }} className="p-1 text-muted"><Square size={11} /></button>}{complete && <a href={googleCalendarUrl(accountEmail)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><CalendarDays size={13} />Open Google Calendar ↗</a>}</div>
    {pending && progress.total > 0 && <progress aria-label="Calendar sync progress" value={progress.processed} max={progress.total} className="h-1.5 w-full max-w-xs accent-blue-600" />}
    {message && <p role="status" className="max-w-sm text-xs leading-relaxed text-muted">{message}</p>}
  </div>;
}
