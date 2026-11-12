import { CalendarDays, Video, ArrowUpRight } from "lucide-react";
import { googleCalendarUrl, googleMeetHomeUrl } from "@/lib/google-links";

export function GoogleWorkspaceButtons({ email }: { email?: string | null }) {
  return <div className="flex flex-wrap gap-2" aria-label="Your Google workspace">
    <a href={googleCalendarUrl(email)} target="_blank" rel="noopener noreferrer" title={email ? `Open Google Calendar for ${email}` : "Open Google Calendar"} className="btn btn-ghost py-2.5 text-sm"><CalendarDays size={16} className="text-brand" />Google Calendar<ArrowUpRight size={13} className="text-muted" /></a>
    <a href={googleMeetHomeUrl(email)} target="_blank" rel="noopener noreferrer" title={email ? `Open Google Meet for ${email}` : "Open Google Meet"} className="btn btn-dark py-2.5 text-sm"><Video size={16} />Google Meet<ArrowUpRight size={13} className="opacity-60" /></a>
  </div>;
}
