import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { LeadList } from "@/components/LeadList";
import { requireDashboardData } from "@/lib/data";
import { isActive, type Lead } from "@/lib/types";

export default async function CompanyLeadsPage() {
  const { supabase, company } = await requireDashboardData();
  if (!company || !isActive(company)) redirect("/dashboard/company");
  const [{ data }, { data: cards }] = await Promise.all([
    supabase.from("leads").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(1000),
    supabase.from("cards").select("id, full_name").eq("company_id", company.id),
  ]);
  const leads = (data ?? []) as Lead[];
  const names = Object.fromEntries((cards ?? []).map((c) => [c.id as string, c.full_name as string]));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted">Everyone who shared their contact from an employee card.</p>
        {leads.length > 0 && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
          <a href="/api/leads/export?scope=company" className="btn btn-ghost text-sm"><Download className="h-4 w-4" /> Export CSV</a>
        )}
      </div>
      <LeadList leads={leads} cardNames={names} empty="No team leads yet. Visitors can tap “Share my contact” on any employee card." />
    </div>
  );
}
