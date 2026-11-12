import { GoogleWorkspaceButtons } from "@/components/GoogleWorkspaceButtons";
import { calendarConnectionStatus } from "@/lib/google-calendar";
import { matchLeadMeetings, type LeadMeeting } from "@/lib/google-links";
import { loadListRows } from "@/lib/list-data";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { LeadList } from "@/components/LeadList";
import { requireDashboardData } from "@/lib/data";
import { isActive, type Lead } from "@/lib/types";

export default async function CompanyLeadsPage() {
  const { supabase, company, user } = await requireDashboardData();
  if (!company || !isActive(company)) redirect("/dashboard/company");
  const [leads, { data: cards }] = await Promise.all([
    loadListRows<Lead>((from, to) => supabase.from("leads").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("cards").select("id, full_name").eq("company_id", company.id),
  ]);
  const [connection, bookings] = await Promise.all([
    calendarConnectionStatus(user.id),
    loadListRows<LeadMeeting>((from, to) => supabase.from("appointments").select("*").eq("owner_id", user.id).eq("status", "confirmed").gte("ends_at", new Date().toISOString()).order("starts_at").order("id").range(from, to)),
  ]);
  const leadMeetings = matchLeadMeetings(leads, bookings);
  const googleEmail = connection.connected ? connection.googleEmail : user.email;
  const names = Object.fromEntries((cards ?? []).map((c) => [c.id as string, c.full_name as string]));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted">Everyone who shared their contact from an employee card.</p>
        <div className="flex flex-wrap items-center gap-2"><GoogleWorkspaceButtons email={googleEmail} />
        {leads.length > 0 && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
          <a href="/api/leads/export?scope=company" className="btn btn-ghost text-sm"><Download className="h-4 w-4" /> Export CSV</a>
        )}</div>
      </div>
      <LeadList leadMeetings={leadMeetings} googleEmail={googleEmail} leads={leads} cardNames={names} empty="No team leads yet. Visitors can tap “Share my contact” on any employee card." />
    </div>
  );
}
