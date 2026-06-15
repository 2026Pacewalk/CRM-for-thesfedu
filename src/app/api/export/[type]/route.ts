import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { leadScopeWhere, applicationScopeWhere } from "@/lib/leads";
import { toCsv } from "@/lib/csv";
import {
  parseServices, serviceLabel, sourceLabel, statusLabel, verticalLabel, stageLabel,
} from "@/lib/constants";
import { computeEnrollmentTotals, sumPayments } from "@/lib/money";

function fmt(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
function csvResponse(name: string, csv: string) {
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

// Scope-aware CSV exports (Section 6.7). type = leads | enrollments | applications.
export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  if (params.type === "leads") {
    const leads = await prisma.lead.findMany({
      where: leadScopeWhere(user),
      orderBy: { createdAt: "desc" },
      include: { branch: { select: { name: true } }, counselors: { include: { user: { select: { name: true } } } } },
    });
    const csv = toCsv(
      ["Name", "Phone", "Email", "Vertical", "Source", "Services", "Status", "Branch", "Counselors", "Created"],
      leads.map((l) => [
        l.fullName, l.phone, l.email ?? "", verticalLabel(l.vertical), sourceLabel(l.source),
        parseServices(l.services).map(serviceLabel).join("; "), statusLabel(l.status),
        l.branch.name, l.counselors.map((c) => c.user.name).join("; "), fmt(l.createdAt),
      ])
    );
    return csvResponse("leads", csv);
  }

  if (params.type === "enrollments") {
    const enr = await prisma.enrollment.findMany({
      where: { lead: leadScopeWhere(user) },
      orderBy: { enrolledAt: "desc" },
      include: { lead: { select: { fullName: true, branch: { select: { name: true } } } }, items: true, payments: true },
    });
    const csv = toCsv(
      ["Student", "Branch", "Net Payable", "Collected", "Payment Status", "Enrolled"],
      enr.map((e) => {
        const { net } = computeEnrollmentTotals(e.items, e.discountAmount);
        return [e.lead.fullName, e.lead.branch.name, net, sumPayments(e.payments), e.paymentStatus, fmt(e.enrolledAt)];
      })
    );
    return csvResponse("enrollments", csv);
  }

  if (params.type === "applications") {
    const apps = await prisma.application.findMany({
      where: applicationScopeWhere(user),
      orderBy: { updatedAt: "desc" },
      include: { lead: { select: { fullName: true, branch: { select: { name: true } } } }, institution: { select: { name: true } } },
    });
    const csv = toCsv(
      ["Student", "Country", "Institution", "Program", "Intake", "Stage", "Outcome", "Branch", "Updated"],
      apps.map((a) => [
        a.lead.fullName, a.country, a.institution?.name ?? "", a.program ?? "", a.intake ?? "",
        stageLabel(a.currentStage), a.outcome ?? "", a.lead.branch.name, fmt(a.updatedAt),
      ])
    );
    return csvResponse("applications", csv);
  }

  return new NextResponse("Unknown export type", { status: 404 });
}
