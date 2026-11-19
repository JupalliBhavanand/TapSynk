import Link from "next/link";
import { redirect } from "next/navigation";
import { getEmployeeWorkspace } from "@/lib/employee";
import { loadListRows } from "@/lib/list-data";
import { formatDate } from "@/lib/utils";
import type { Appointment, Lead } from "@/lib/types";
import { EmployeeProfileForm } from "./EmployeeProfileForm";

export const metadata = { title: "My employee profiles" };

export default async function EmployeePage() {
  const { user, supabase, cards } = await getEmployeeWorkspace();
  if (!user) redirect("/login?next=/dashboard/employee");
  const ids = cards.map((card) => card.id);
  // Filter by card IDs, never the company's owner_id. RLS enforces the same boundary.
  const [leads, appointments] = ids.length ? await Promise.all([
    loadListRows<Lead>((from, to) => supabase.from("leads").select("*").in("card_id", ids).order("created_at", { ascending: false }).order("id").range(from, to)),
    loadListRows<Appointment>((from, to) => supabase.from("appointments").select("*").in("card_id", ids).order("starts_at", { ascending: false }).order("id").range(from, to)),
  ]) : [[], []];
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header><h1 className="text-3xl font-bold tracking-tight">My employee profiles</h1><p className="mt-2 text-muted">Manage your profile and see the leads and AI appointments from your cards.</p></header>
      {!cards.length && <section className="card-surface p-6"><h2 className="font-bold">No employee profile linked yet</h2><p className="mt-2 text-muted">Sign in using the work email your company entered on your card, and confirm that email. Ask your company administrator to check the card’s work email if your profile is missing.</p></section>}
      {cards.map((card) => {
        const ownLeads = leads.filter((lead) => lead.card_id === card.id);
        const ownAppointments = appointments.filter((appointment) => appointment.card_id === card.id);
        return <section key={card.id} className="space-y-6">
          <div className="card-surface p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-muted">{card.company}</p><h2 className="text-xl font-bold">{card.full_name}</h2>{!card.published && <p className="mt-1 text-sm text-muted">Your company has not published this card yet.</p>}</div><Link href={`/c/${card.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Open my card</Link></div><EmployeeProfileForm card={card} /></div>
          <div className="card-surface p-6"><h3 className="text-lg font-bold">My leads <span className="text-muted">({ownLeads.length})</span></h3><p className="mt-1 text-sm text-muted">People who shared their details through this card.</p>
            {!ownLeads.length ? <p className="mt-5 text-muted">No leads from this card yet.</p> : <div className="mt-4 divide-y divide-line">{ownLeads.map((lead) => <article key={lead.id} className="py-4"><h4 className="font-semibold">{lead.name}</h4><div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm"><span className="break-all">{lead.email}</span><span>{lead.phone}</span><span className="text-muted">{formatDate(lead.created_at)}</span></div>{lead.message && <p className="mt-2 whitespace-pre-wrap text-sm">{lead.message}</p>}</article>)}</div>}
          </div>
          <div className="card-surface p-6"><h3 className="text-lg font-bold">My AI appointments <span className="text-muted">({ownAppointments.length})</span></h3><p className="mt-1 text-sm text-muted">Bookings made through this card. Times shown in UTC.</p>
            {!ownAppointments.length ? <p className="mt-5 text-muted">No AI appointments from this card yet.</p> : <div className="mt-4 divide-y divide-line">{ownAppointments.map((appointment) => <article key={appointment.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{appointment.name}</h4><span className="text-sm capitalize text-muted">{appointment.status}</span></div><p className="mt-1 text-sm">{new Date(appointment.starts_at).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} – {new Date(appointment.ends_at).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" })} UTC</p><p className="mt-1 break-all text-sm text-muted">{appointment.email}{appointment.phone && ` · ${appointment.phone}`}</p>{appointment.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{appointment.notes}</p>}</article>)}</div>}
          </div>
        </section>;
      })}
    </div>
  );
}
