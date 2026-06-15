import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { COUNTRIES } from "@/lib/constants";
import { createInstitutionAction, toggleInstitutionActiveAction } from "./actions";

export default async function AdminInstitutionsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Institutions</h1>
          <p className="text-sm text-slate-500">{institutions.length} institution{institutions.length === 1 ? "" : "s"}</p>
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
      <form action={createInstitutionAction} className="card mb-5 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Create institution</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Institution name" />
          </div>
          <div>
            <label className="label">Country</label>
            <select name="country" required className="input" defaultValue="">
              <option value="" disabled>Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary">Create institution</button>
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {institutions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">No institutions found.</td>
                </tr>
              )}
              {institutions.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.name}</td>
                  <td className="px-4 py-3 text-slate-600">{i.country}</td>
                  <td className="px-4 py-3">
                    {i.isActive ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleInstitutionActiveAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className={i.isActive ? "btn-danger" : "btn-secondary"}>
                        {i.isActive ? "Deactivate" : "Activate"}
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
