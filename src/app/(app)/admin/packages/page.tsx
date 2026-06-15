import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { SERVICE_TYPES, serviceLabel } from "@/lib/constants";
import { createPackageAction, togglePackageActiveAction } from "./actions";

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const packages = await prisma.servicePackage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Service Packages</h1>
          <p className="text-sm text-slate-500">{packages.length} package{packages.length === 1 ? "" : "s"}</p>
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
      <form action={createPackageAction} className="card mb-5 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Create package</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Package name" />
          </div>
          <div>
            <label className="label">Service category</label>
            <select name="serviceCategory" required className="input" defaultValue="">
              <option value="" disabled>Select category</option>
              {Object.entries(SERVICE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Base price</label>
            <input name="basePrice" type="number" min={0} step="0.01" required className="input" placeholder="0.00" />
          </div>
          <div>
            <label className="label">Tax rate (%)</label>
            <input name="taxRate" type="number" min={0} step="0.01" required className="input" placeholder="0" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="allowInstallments" className="h-4 w-4 rounded border-slate-300" />
              Allow installments
            </label>
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary">Create package</button>
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Base Price</th>
                <th className="px-4 py-3 font-medium">Tax Rate</th>
                <th className="px-4 py-3 font-medium">Installments</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packages.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No packages found.</td>
                </tr>
              )}
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{serviceLabel(p.serviceCategory)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.basePrice.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-slate-600">{p.taxRate}%</td>
                  <td className="px-4 py-3">
                    {p.allowInstallments ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Yes</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={togglePackageActiveAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className={p.isActive ? "btn-danger" : "btn-secondary"}>
                        {p.isActive ? "Deactivate" : "Activate"}
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
