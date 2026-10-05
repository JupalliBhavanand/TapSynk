import { Download } from "lucide-react";
import { LeadList } from "@/components/LeadList";
import { getDashboardData } from "@/lib/data";
import type { Lead } from "@/lib/types";

export default async function LeadsPage() {
  const { supabase, user } = (await getDashboardData())!;
  const { data } = await supabase.from("leads").select("*").eq("owner_id", user.id).is("company_id", null).order("created_at", { ascending: false }).limit(500);
  const leads = (data ?? []) as Lead[];

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-muted">People who shared their contact back from your card.</p>
        </div>
        {leads.length > 0 && (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
          <a href="/api/leads/export" className="btn btn-ghost text-sm"><Download className="h-4 w-4" /> Export CSV</a>
        )}
      </div>
      <LeadList leads={leads} empty="No leads yet. Visitors can tap “Share my contact” on your card to send you their details." />
    </div>
  );
}
