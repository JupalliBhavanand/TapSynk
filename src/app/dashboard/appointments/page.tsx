import { CalendarDays, Mail, Phone } from "lucide-react";
import { getDashboardData } from "@/lib/data";
import { formatInZone } from "@/lib/slots";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "./AppointmentActions";

export default async function AppointmentsPage() {
  const { supabase, card, agent } = (await getDashboardData())!;
  const tz = agent?.timezone || "UTC";
  const { data } = card
    ? await supabase.from("appointments").select("*").eq("card_id", card.id).order("starts_at", { ascending: true }).limit(200)
    : { data: [] };
  const all = (data ?? []) as Appointment[];
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const upcoming = all.filter((a) => a.status === "confirmed" && new Date(a.starts_at).getTime() >= now);
  const past = all.filter((a) => !upcoming.includes(a)).reverse();

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
      <p className="mb-8 mt-1 text-muted">Booked by your AI agent. Times shown in {tz.replace(/_/g, " ")}.</p>
      <List title="Upcoming" items={upcoming} tz={tz} empty="No upcoming appointments. Share your card and your AI will fill your calendar." />
      {past.length > 0 && <div className="mt-10"><List title="Past & cancelled" items={past} tz={tz} empty="" /></div>}
    </div>
  );
}

function List({ title, items, tz, empty }: { title: string; items: Appointment[]; tz: string; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">{title}</h2>
      {items.length === 0 ? (
        <div className="card-surface flex items-center gap-3 p-6 text-sm text-muted"><CalendarDays className="h-5 w-5" /> {empty}</div>
      ) : (
        <ul className="card-surface divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{a.name}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", a.status === "confirmed" ? "bg-success/10 text-success" : a.status === "cancelled" ? "bg-stamp/10 text-stamp" : "bg-bg text-muted")}>{a.status}</span>
                </div>
                <p className="text-sm font-medium text-ink-2">{formatInZone(a.starts_at, tz)}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
                  <a href={`mailto:${a.email}`} className="flex items-center gap-1 hover:text-ink"><Mail className="h-3.5 w-3.5" /> {a.email}</a>
                  {a.phone && <a href={`tel:${a.phone}`} className="flex items-center gap-1 hover:text-ink"><Phone className="h-3.5 w-3.5" /> {a.phone}</a>}
                </div>
                {a.notes && <p className="mt-2 text-sm text-ink-2">“{a.notes}”</p>}
              </div>
              <AppointmentActions id={a.id} status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
