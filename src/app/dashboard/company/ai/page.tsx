import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AgentEditor } from "@/app/dashboard/ai/AgentEditor";
import { getDashboardData } from "@/lib/data";
import { isActive, type Agent } from "@/lib/types";

export default async function CompanyAiPage() {
  const { supabase, company } = (await getDashboardData())!;
  if (!company || !isActive(company)) redirect("/dashboard/company");
  const [{ data: agent }, { data: card }] = await Promise.all([
    supabase.from("ai_agents").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("cards").select("slug, full_name").eq("company_id", company.id).order("created_at").limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <p className="mb-6 text-muted">One AI agent for the whole team. It answers questions about {company.name} and books meetings with whichever employee's card the visitor tapped.</p>
      {company.tier !== "ai" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand-soft/60 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
            <Sparkles className="h-4 w-4 text-brand" /> Set up your company AI now. “Talk to AI” appears on employee cards when your team is on AI Cards.
          </p>
          <Link href="/dashboard/company/billing" className="btn btn-primary py-2 text-sm">Switch to AI Cards</Link>
        </div>
      )}
      <AgentEditor
        initial={agent as Agent | null}
        slug={(card?.slug as string) ?? ""}
        businessName={company.name}
        ownerName={(card?.full_name as string) ?? company.name}
        company
      />
    </div>
  );
}
