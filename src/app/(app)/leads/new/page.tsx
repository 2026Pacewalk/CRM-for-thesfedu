import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_CREATE_LEAD } from "@/lib/rbac";
import { NewLeadForm } from "@/components/NewLeadForm";

export default async function NewLeadPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_CREATE_LEAD)) redirect("/leads");

  const [branches, directCounselors, careerCounselors, partners] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["B2C_COUNSELOR_DIRECT", "B2C_TL_DIRECT"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["B2C_COUNSELOR_CAREER", "B2C_TL_CAREER"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.b2BPartner.findMany({
      where: { isActive: true },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/leads" className="text-sm text-slate-500 hover:text-slate-700">← Leads</Link>
        <h1 className="text-xl font-semibold text-slate-900">New Lead</h1>
      </div>

      <NewLeadForm
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        directCounselors={directCounselors}
        careerCounselors={careerCounselors}
        partners={partners}
        defaultBranchId={user.branchId ?? branches[0]?.id ?? ""}
      />
    </div>
  );
}
