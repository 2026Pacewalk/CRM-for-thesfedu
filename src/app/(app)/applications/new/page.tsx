import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_BACKEND } from "@/lib/rbac";
import { createApplicationAction } from "../actions";
import { COUNTRIES } from "@/lib/constants";

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: { leadId?: string };
}) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_BACKEND)) redirect("/applications");

  const leadId = searchParams.leadId;
  if (!leadId) redirect("/leads");
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, fullName: true } });
  if (!lead) notFound();

  const backendCounselors = await prisma.user.findMany({
    where: { isActive: true, role: "BACKEND_COUNSELOR" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href={`/leads/${lead.id}`} className="text-sm text-slate-500 hover:text-slate-700">← {lead.fullName}</Link>
        <h1 className="text-xl font-semibold text-slate-900">New Country Application</h1>
      </div>

      <form action={createApplicationAction} className="card space-y-4 p-5">
        <input type="hidden" name="leadId" value={lead.id} />
        <div>
          <label className="label">Destination Country *</label>
          <select name="country" className="input" required defaultValue="">
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Backend Counselor</label>
          <select name="backendCounselorId" className="input" defaultValue="">
            <option value="">Assign later</option>
            {backendCounselors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Program (optional)</label>
            <input name="program" className="input" />
          </div>
          <div>
            <label className="label">Intake (optional)</label>
            <input name="intake" className="input" placeholder="e.g. Sept 2026" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Link href={`/leads/${lead.id}`} className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Create Application</button>
        </div>
      </form>
    </div>
  );
}
