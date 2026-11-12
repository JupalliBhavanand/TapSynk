import { GoogleWorkspaceButtons } from "@/components/GoogleWorkspaceButtons";
import { calendarConnectionStatus } from "@/lib/google-calendar";
import { matchLeadMeetings, type LeadMeeting } from "@/lib/google-links";
import { loadListRows } from "@/lib/list-data";
import { Download } from "lucide-react";
import { LeadList } from "@/components/LeadList";
import { requireDashboardData } from "@/lib/data";
import type { Lead } from "@/lib/types";

export default async function LeadsPage() {
  const { supabase, user } = await requireDashboardData();
  const leads = await loadListRows<Lead>((from, to) => supabase.from("leads").select("*").eq("owner_id", user.id).is("company_id", null).order("created_at", { ascending: false }).order("id").range(from, to));
  const [connection, bookings] = await Promise.all([
    calendarConnectionStatus(user.id),
    loadListRows<LeadMeeting>((from, to) => supabase.from("appointments").select("*").eq("owner_id", user.id).eq("status", "confirmed").gte("ends_at", new Date().toISOString()).order("starts_at").order("id").range(from, to)),
  ]);
  const leadMeetings = matchLeadMeetings(leads, bookings);
  const googleEmail = connection.connected ? connection.googleEmail : user.email;

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-muted">People who shared their contact back from your card.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><GoogleWorkspaceButtons email={googleEmail} />
        {leads.length > 0 && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
          <a href="/api/leads/export" className="btn btn-ghost text-sm"><Download className="h-4 w-4" /> Export CSV</a>
        )}</div>
      </div>
      <LeadList leadMeetings={leadMeetings} googleEmail={googleEmail} leads={leads} empty="No leads yet. Visitors can tap “Share my contact” on your card to send you their details." />
    </div>
  );
}
