import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { COUNTRIES } from "@/lib/constants";
import { createCountryAction, toggleCountryActiveAction } from "./actions";

// Destination Countries admin (Section 7.8). Built-in countries are always
// available; admins can add extra ones or deactivate any from the pipeline.
export default async function AdminCountriesPage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const custom = await prisma.country.findMany({ orderBy: { name: "asc" } });
  const deactivated = new Set(custom.filter((c) => !c.isActive).map((c) => c.name));

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Destination Countries</h1>
          <p className="text-sm text-slate-500">Countries available in the backend pipeline</p>
        </div>
      </div>

      {searchParams.error && <div className="card mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{searchParams.error}</div>}
      {searchParams.ok && <div className="card mb-4 border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{searchParams.ok}</div>}

      <form action={createCountryAction} className="card mb-5 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Add country</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Country name</label>
            <input name="name" required className="input" placeholder="e.g. Ireland" />
          </div>
          <button className="btn-primary">Add country</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COUNTRIES.map((c) => (
              <tr key={`builtin-${c}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c}</td>
                <td className="px-4 py-3 text-slate-500">Built-in</td>
                <td className="px-4 py-3">
                  {deactivated.has(c)
                    ? <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    : <span className="badge bg-emerald-100 text-emerald-700">Active</span>}
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">—</td>
              </tr>
            ))}
            {custom.filter((c) => !COUNTRIES.includes(c.name as (typeof COUNTRIES)[number])).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-500">Custom</td>
                <td className="px-4 py-3">
                  {c.isActive
                    ? <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                    : <span className="badge bg-slate-100 text-slate-500">Inactive</span>}
                </td>
                <td className="px-4 py-3">
                  <form action={toggleCountryActiveAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className={c.isActive ? "btn-danger" : "btn-secondary"}>{c.isActive ? "Deactivate" : "Activate"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Built-in countries are always available. Add custom countries here; deactivating a custom country removes it from new-application dropdowns (existing applications keep their country).
      </p>
    </div>
  );
}
