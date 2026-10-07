import { redirect } from "next/navigation";
import { AgentEditor } from "@/app/dashboard/ai/AgentEditor";
import { AiLocked } from "@/components/AiLocked";
import { requireDashboardData } from "@/lib/data";
import { hasAi, isActive, type Agent } from "@/lib/types";

export default async function CompanyAiPage() {
  const { supabase, company } = await requireDashboardData();
  if (!company || !isActive(company)) redirect("/dashboard/company");
  if (!hasAi(company)) {
    return <AiLocked title="Give your whole team an AI agent" href="/dashboard/company/billing" cta="Switch your team to AI Cards" />;
  }
  const [{ data: agent }, { data: card }] = await Promise.all([
    supabase.from("ai_agents").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("cards").select("slug, full_name").eq("company_id", company.id).order("created_at").limit(1).maybeSingle(),
  ]);

  return (
    <div>
      <p className="mb-6 text-muted">One AI agent for the whole team. It answers questions about {company.name} and books meetings with whichever employee's card the visitor tapped.</p>
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
