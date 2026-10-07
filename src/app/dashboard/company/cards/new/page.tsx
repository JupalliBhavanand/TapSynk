import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireDashboardData } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { isActive } from "@/lib/types";
import { EmployeeCardForm } from "../../EmployeeCardForm";

export default async function NewEmployeeCardPage() {
  const { company, user } = await requireDashboardData();
  if (!company || !isActive(company)) redirect("/dashboard/company");
  return (
    <>
      <Link href="/dashboard/company" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to team</Link>
      <h2 className="mb-6 text-2xl font-bold">New employee card</h2>
      <EmployeeCardForm initial={null} company={company} userId={user.id} siteUrl={SITE_URL} />
    </>
  );
}
