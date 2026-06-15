import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_CREATE_LEAD } from "@/lib/rbac";
import { ImportForm } from "@/components/ImportForm";

export default async function ImportLeadsPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_CREATE_LEAD)) redirect("/leads");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Bulk Import Leads</h1>
      <p className="mb-5 text-sm text-slate-500">
        Paste CSV with a header row. Duplicates (by phone) are skipped automatically (Section 7.6).
      </p>
      <ImportForm />
    </div>
  );
}
