import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { ROLES, VERTICALS, roleLabel, verticalLabel } from "@/lib/constants";
import { createUserAction, toggleUserActiveAction } from "./actions";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { branch: { select: { name: true } } },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">{users.length} user{users.length === 1 ? "" : "s"}</p>
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
      <form action={createUserAction} className="card mb-5 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Create user</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Full name" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required className="input" placeholder="name@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required minLength={6} className="input" placeholder="Min 6 characters" />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" required className="input" defaultValue="">
              <option value="" disabled>Select role</option>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Vertical (optional)</label>
            <select name="vertical" className="input" defaultValue="">
              <option value="">None</option>
              {Object.entries(VERTICALS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Branch (optional)</label>
            <select name="branchId" className="input" defaultValue="">
              <option value="">None</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary">Create user</button>
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No users found.</td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{roleLabel(u.role)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.vertical ? verticalLabel(u.vertical) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.branch?.name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className={u.isActive ? "btn-danger" : "btn-secondary"}>
                        {u.isActive ? "Deactivate" : "Activate"}
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
