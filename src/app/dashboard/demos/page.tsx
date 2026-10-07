import { notFound } from "next/navigation";
import { requireDashboardData } from "@/lib/data";
import { isAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DemoRequest } from "@/lib/types";
import { DemoRequests } from "./DemoRequests";

export const metadata = { title: "Demo requests" };

/** Website "Book a demo" requests. Only emails listed in ADMIN_EMAILS can open this page. */
export default async function DemosPage() {
  const { user } = await requireDashboardData();
  if (!isAdminEmail(user.email)) notFound();
  const { data, error } = await createAdminClient().from("demo_requests").select("*").order("created_at", { ascending: false }).limit(1000);

  return (
    <div className="fade-up mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Demo requests</h1>
      <p className="mt-1 text-muted">People who booked a demo from the website.</p>
      {error ? (
        <p className="mt-8 rounded-xl border border-cream-line bg-cream px-4 py-3 text-sm">Couldn&apos;t load demo requests. Run supabase/migrations/0003_plan_switch_demos_lead_notes.sql in the Supabase SQL editor.</p>
      ) : (
        <DemoRequests items={(data ?? []) as DemoRequest[]} />
      )}
    </div>
  );
}
