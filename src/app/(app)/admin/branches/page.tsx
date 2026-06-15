import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { createBranchAction, toggleBranchActiveAction } from "./actions";

export default async function AdminBranchesPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, leads: true } } },
  });

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Branches</h1>
          <p className="text-sm text-slate-500">{branches.length} branch{branches.length === 1 ? "" : "es"}</p>
        </div>
      </div>

      {searchParams.error && (
        <div className="card mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="card mb-4 border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {searchParams.ok}
        </div>
      )}

      {/* Create form */}
      <form action={createBranchAction} className="card mb-5 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Create branch</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Branch name" />
          </div>
          <div>
            <label className="label">Code</label>
            <input name="code" required className="input" placeholder="e.g. DEL" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" placeholder="Phone" />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="label">Address</label>
            <input name="address" className="input" placeholder="Address" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isHeadOffice" className="h-4 w-4 rounded border-slate-300" />
              Head office
            </label>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary">Create branch</button>
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No branches found.</td>
                </tr>
              )}
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{b.name}</td>
                  <td className="px-4 py-3 text-slate-600">{b.code}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {b.address ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {b.isHeadOffice ? (
                      <span className="badge bg-indigo-100 text-indigo-700">Head Office</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-600">Branch</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b._count.users}</td>
                  <td className="px-4 py-3 text-slate-600">{b._count.leads}</td>
                  <td className="px-4 py-3">
                    {b.isActive ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleBranchActiveAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className={b.isActive ? "btn-danger" : "btn-secondary"}>
                        {b.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
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
