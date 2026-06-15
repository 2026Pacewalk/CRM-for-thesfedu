import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";
import { NewAssessmentForm } from "./NewAssessmentForm";

export default async function NewAssessmentPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_B2B)) redirect("/dashboard");

  const partners = await prisma.b2BPartner.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/assessments" className="text-sm text-slate-500 hover:text-slate-700">← Assessments</Link>
        <h1 className="text-xl font-semibold text-slate-900">New Assessment</h1>
      </div>

      <NewAssessmentForm partners={partners} />
    </div>
  );
}
