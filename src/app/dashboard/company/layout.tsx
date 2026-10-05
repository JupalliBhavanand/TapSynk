import { Building2 } from "lucide-react";
import { getDashboardData } from "@/lib/data";
import { PLANS } from "@/lib/plans";
import { isActive } from "@/lib/types";
import { CompanyTabs } from "./CompanyTabs";

export default async function CompanyLayout({ children }: LayoutProps<"/dashboard/company">) {
  const { company } = (await getDashboardData())!;
  const active = isActive(company);
  return (
    <div className="fade-up mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {company?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo_url} alt="" className="h-12 w-12 rounded-2xl border border-line bg-white object-contain p-1" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy text-white"><Building2 className="h-5 w-5" /></span>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{company?.name ?? "Company cards"}</h1>
          <p className="text-sm text-muted">
            {company
              ? `${PLANS[company.tier].name} · ${company.seats} cards · ${active ? "Active" : "Not active yet"}`
              : "Branded cards for your whole team, with team analytics and one monthly bill."}
          </p>
        </div>
      </div>
      {company && active && <CompanyTabs />}
      {children}
    </div>
  );
}
