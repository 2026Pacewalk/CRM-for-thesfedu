import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ENROLL } from "@/lib/rbac";
import { EnrollForm } from "@/components/EnrollForm";

export default async function EnrollPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ENROLL)) redirect(`/leads/${params.id}`);

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { enrollment: true },
  });
  if (!lead) notFound();
  if (lead.enrollment) redirect(`/leads/${params.id}`); // already enrolled

  const packages = await prisma.servicePackage.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href={`/leads/${lead.id}`} className="text-sm text-slate-500 hover:text-slate-700">← {lead.fullName}</Link>
        <h1 className="text-xl font-semibold text-slate-900">Enroll Student</h1>
      </div>
      <EnrollForm
        leadId={lead.id}
        packages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          serviceCategory: p.serviceCategory,
          basePrice: p.basePrice,
          taxRate: p.taxRate,
        }))}
      />
    </div>
  );
}
