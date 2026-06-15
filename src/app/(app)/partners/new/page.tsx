import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";
import { NewPartnerForm } from "./NewPartnerForm";

export default async function NewPartnerPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_B2B)) redirect("/dashboard");

  const bdms = await prisma.user.findMany({
    where: { isActive: true, role: "BDM" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/partners" className="text-sm text-slate-500 hover:text-slate-700">← Partners</Link>
        <h1 className="text-xl font-semibold text-slate-900">New Partner</h1>
      </div>

      <NewPartnerForm bdms={bdms} />
    </div>
  );
}
