"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/company", label: "Team" },
  { href: "/dashboard/company/analytics", label: "Analytics" },
  { href: "/dashboard/company/leads", label: "Leads" },
  { href: "/dashboard/company/ai", label: "AI agent" },
  { href: "/dashboard/company/billing", label: "Billing" },
];

export function CompanyTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Company" className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1">
      {TABS.map((t) => {
        const active = t.href === "/dashboard/company" ? path === t.href || path.startsWith("/dashboard/company/cards") : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition", active ? "bg-navy text-white shadow" : "text-muted hover:text-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
