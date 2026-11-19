import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { NotificationProvider, NotificationBell } from "@/components/Notifications";
import { notificationSnapshot } from "@/lib/notifications";
import { DashboardNav } from "@/components/DashboardNav";
import { Logo } from "@/components/Logo";
import { getDashboardData } from "@/lib/data";
import { getEmployeeWorkspace } from "@/lib/employee";
import { isAdminEmail, isFulfillmentAdminEmail } from "@/lib/env";
import { PLANS } from "@/lib/plans";
import { hasAi, isActive } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const data = await getDashboardData();
  if (!data) redirect("/login?next=/dashboard");
  const employee = await getEmployeeWorkspace();
  const employeeOnly = employee.cards.length > 0 && !data.card && !data.company && !data.subscription;
  const notifications = await notificationSnapshot(data.user.id);
  const active = isActive(data.subscription);

  return (
    <NotificationProvider key={data.user.id} userId={data.user.id} initial={notifications}>
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-bg/90 px-4 py-4 backdrop-blur lg:h-dvh lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center justify-between gap-3">
          <Logo href="/dashboard" />
          <NotificationBell />
          <form action="/auth/signout" method="post" className="lg:hidden">
            <button className="btn btn-ghost px-3 py-2 text-sm" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
        <div className="mt-4 lg:mt-10">
          <DashboardNav employee={employee.cards.length > 0} employeeOnly={employeeOnly} aiLocked={!hasAi(data.subscription)} admin={isAdminEmail(data.user.email)} fulfillmentAdmin={isFulfillmentAdminEmail(data.user.email)} />
        </div>
        <div className="absolute inset-x-5 bottom-6 hidden lg:block">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="truncate text-sm font-semibold">{data.name}</p>
            <p className="truncate text-xs text-muted">{data.user.email}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-xs font-semibold">
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-success" : "bg-muted"}`} />
              {active && data.subscription ? PLANS[data.subscription.tier].name : employeeOnly ? "Company-managed profile" : "No plan yet"}
            </p>
            <form action="/auth/signout" method="post" className="mt-3">
              <button className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><LogOut className="h-4 w-4" /> Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="px-4 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
    </NotificationProvider>
  );
}
