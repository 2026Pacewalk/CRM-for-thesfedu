import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminAuditPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">Latest {logs.length} {logs.length === 1 ? "entry" : "entries"}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Entity ID</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No audit entries.</td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {l.user?.name ?? <span className="text-slate-300">System</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-slate-100 text-slate-600">{l.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.entityType}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {l.entityId ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.details ?? <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
