import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { DashboardNav } from "@/components/DashboardNav";
import { Logo } from "@/components/Logo";
import { getDashboardData } from "@/lib/data";
import { PLANS } from "@/lib/plans";
import { isActive } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const data = await getDashboardData();
  if (!data) redirect("/login?next=/dashboard");
  const active = isActive(data.subscription);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-bg/90 px-4 py-4 backdrop-blur lg:h-dvh lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Logo href="/dashboard" />
          <form action="/auth/signout" method="post" className="lg:hidden">
            <button className="btn btn-ghost px-3 py-2 text-sm" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
        <div className="mt-4 lg:mt-10">
          <DashboardNav />
        </div>
        <div className="absolute inset-x-5 bottom-6 hidden lg:block">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="truncate text-sm font-semibold">{data.name}</p>
            <p className="truncate text-xs text-muted">{data.user.email}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-xs font-semibold">
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-success" : "bg-muted"}`} />
              {active && data.subscription ? PLANS[data.subscription.tier].name : "No plan yet"}
            </p>
            <form action="/auth/signout" method="post" className="mt-3">
              <button className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"><LogOut className="h-4 w-4" /> Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="px-4 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
