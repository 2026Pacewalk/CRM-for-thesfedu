import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";
import { ELIGIBILITY_OUTCOMES, eligibilityLabel } from "@/lib/constants";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const ELIGIBILITY_COLORS: Record<string, string> = {
  ELIGIBLE: "bg-emerald-100 text-emerald-700",
  NOT_ELIGIBLE: "bg-rose-100 text-rose-700",
  CONDITIONAL: "bg-amber-100 text-amber-700",
};

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: { partnerId?: string; eligibility?: string };
}) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_B2B)) redirect("/dashboard");

  const where: { partnerId?: string; eligibilityOutcome?: string } = {};
  if (searchParams.partnerId) where.partnerId = searchParams.partnerId;
  if (searchParams.eligibility && Object.keys(ELIGIBILITY_OUTCOMES).includes(searchParams.eligibility)) {
    where.eligibilityOutcome = searchParams.eligibility;
  }

  const [assessments, partners] = await Promise.all([
    prisma.assessment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        partner: { select: { companyName: true } },
        bdm: { select: { name: true } },
        enteredBy: { select: { name: true } },
      },
    }),
    prisma.b2BPartner.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">B2B Assessments</h1>
          <p className="text-sm text-slate-500">
            {assessments.length} assessment{assessments.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/assessments/new" className="btn-primary">+ New Assessment</Link>
      </div>

      {/* Filters */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Partner</label>
          <select name="partnerId" defaultValue={searchParams.partnerId ?? ""} className="input">
            <option value="">All</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.companyName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Eligibility</label>
          <select name="eligibility" defaultValue={searchParams.eligibility ?? ""} className="input">
            <option value="">All</option>
            {Object.entries(ELIGIBILITY_OUTCOMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Filter</button>
        <Link href="/assessments" className="btn-secondary">Reset</Link>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Partner</th>
                <th className="px-4 py-3 font-medium">BDM</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Eligibility</th>
                <th className="px-4 py-3 font-medium">Entered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No assessments found.
                  </td>
                </tr>
              )}
              {assessments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{fmtDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{a.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{a.partner?.companyName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.bdm?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.country ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.program ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ELIGIBILITY_COLORS[a.eligibilityOutcome] ?? "bg-slate-100 text-slate-600"}`}>
                      {eligibilityLabel(a.eligibilityOutcome)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.enteredBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
