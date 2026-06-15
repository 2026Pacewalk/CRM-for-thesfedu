import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/leads";
import { roleLabel, statusLabel } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const scope = leadScopeWhere(user);

  const [total, byStatus, followUpsDue, myTasks, recent] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.lead.count({
      where: { AND: [scope, { followUpDate: { lte: endOfToday() } }, { status: { notIn: ["ENROLLED", "VISA_APPROVED", "NOT_INTERESTED", "DUPLICATE"] } }] },
    }),
    prisma.task.count({ where: { assignedToId: user.id, status: { not: "COMPLETED" } } }),
    prisma.lead.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { branch: { select: { name: true } } },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) statusMap[row.status] = row._count;

  const kpis = [
    { label: "Total Leads", value: total, href: "/leads" },
    { label: "New", value: statusMap["NEW"] ?? 0, href: "/leads?status=NEW" },
    { label: "Interested", value: statusMap["INTERESTED"] ?? 0, href: "/leads?status=INTERESTED" },
    { label: "Enrolled", value: statusMap["ENROLLED"] ?? 0, href: "/leads?status=ENROLLED" },
    { label: "Follow-ups Due", value: followUpsDue, href: "/leads" },
    { label: "My Open Tasks", value: myTasks, href: "/tasks" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">{roleLabel(user.role)} dashboard</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-4 transition hover:shadow-md">
            <div className="text-2xl font-semibold text-slate-900">{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Pipeline by Status</h2>
          <ul className="space-y-2">
            {Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <StatusBadge status={status} />
                <span className="font-medium text-slate-700">{count}</span>
              </li>
            ))}
            {Object.keys(statusMap).length === 0 && (
              <li className="text-sm text-slate-400">No leads yet. <Link href="/leads/new" className="text-brand-600 underline">Add one</Link>.</li>
            )}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Leads</h2>
          <ul className="divide-y divide-slate-100">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">{l.fullName}</Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{l.branch.name}</span>
                  <StatusBadge status={l.status} />
                </div>
              </li>
            ))}
            {recent.length === 0 && <li className="py-2 text-sm text-slate-400">No leads yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
