import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";

export default async function AdminHomePage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const [userCount, branchCount, packageCount, institutionCount, auditCount, templateCount, scheduleCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.branch.count(),
      prisma.servicePackage.count(),
      prisma.institution.count(),
      prisma.auditLog.count(),
      prisma.messageTemplate.count(),
      prisma.reportSchedule.count(),
    ]);

  const cards = [
    {
      href: "/admin/users",
      title: "Users",
      description: "Manage staff accounts, roles and access.",
      count: userCount,
    },
    {
      href: "/admin/branches",
      title: "Branches",
      description: "Office locations and head-office settings.",
      count: branchCount,
    },
    {
      href: "/admin/packages",
      title: "Service Packages",
      description: "Pricing, tax and installment options.",
      count: packageCount,
    },
    {
      href: "/admin/institutions",
      title: "Institutions",
      description: "Universities and colleges by country.",
      count: institutionCount,
    },
    {
      href: "/admin/integrations",
      title: "Integrations & Templates",
      description: "WhatsApp, email, SMS config and message templates.",
      count: templateCount,
    },
    {
      href: "/admin/report-schedules",
      title: "Report Schedules",
      description: "Automated daily/weekly email digests.",
      count: scheduleCount,
    },
    {
      href: "/admin/audit",
      title: "Audit Log",
      description: "System activity and change history.",
      count: auditCount,
    },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Administration</h1>
        <p className="text-sm text-slate-500">System configuration and master data</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 transition hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-900">{c.title}</h2>
              <span className="badge bg-slate-100 text-slate-600">{c.count}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
