import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireDashboardData } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import type { Card } from "@/lib/types";
import { EmployeeCardForm } from "../../EmployeeCardForm";

export default async function EditEmployeeCardPage({ params }: PageProps<"/dashboard/company/cards/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { company, user, supabase } = await requireDashboardData();
  if (!company) redirect("/dashboard/company");
  const { data } = await supabase.from("cards").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!data) notFound();
  const card = data as Card;
  return (
    <>
      <Link href="/dashboard/company" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to team</Link>
      <h2 className="mb-6 text-2xl font-bold">Edit {card.full_name}'s card</h2>
      <EmployeeCardForm initial={card} company={company} userId={user.id} siteUrl={SITE_URL} />
    </>
  );
}
