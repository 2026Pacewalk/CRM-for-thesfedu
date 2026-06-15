"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { can, CAN_B2B, CAN_ADMIN } from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: string; show?: boolean };

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/leads", label: "Leads", icon: "👥" },
    { href: "/enrollments", label: "Enrollments", icon: "🎓" },
    { href: "/applications", label: "Applications", icon: "🌍" },
    { href: "/partners", label: "B2B Partners", icon: "🤝", show: can(role, CAN_B2B) },
    { href: "/assessments", label: "Assessments", icon: "📝", show: can(role, CAN_B2B) },
    { href: "/tasks", label: "Tasks", icon: "✅" },
    { href: "/reports", label: "Reports", icon: "📈" },
    { href: "/admin", label: "Admin", icon: "⚙️", show: can(role, CAN_ADMIN) },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">SF</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">theSFedu CRM</div>
          <div className="text-[11px] text-slate-400">Immigration & Consultancy</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.filter((i) => i.show !== false).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">Foundation · all modules</div>
    </aside>
  );
}
