import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { exportLeadData } from "@/lib/privacy";

// GDPR data export on request (Section 7.11). Returns the lead's full record as a
// downloadable JSON file. Restricted to admins/management.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(user.role, CAN_ADMIN)) return new NextResponse("Forbidden", { status: 403 });

  const data = await exportLeadData(params.id);
  if (!data) return new NextResponse("Lead not found", { status: 404 });

  const json = JSON.stringify(data, null, 2);
  const safeName = data.fullName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "lead";
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}_data_export.json"`,
    },
  });
}
