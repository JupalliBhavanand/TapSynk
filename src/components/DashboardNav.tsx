"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Building2, CalendarDays, CreditCard, Handshake, IdCard, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/card", label: "My card", icon: IdCard },
  { href: "/dashboard/ai", label: "AI agent", icon: Bot },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/leads", label: "Leads", icon: Handshake },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/dashboard/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/dashboard/company", label: "Company", icon: Building2 },
];

export function DashboardNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active ? "bg-navy text-white shadow" : "text-ink-2 hover:bg-white hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
