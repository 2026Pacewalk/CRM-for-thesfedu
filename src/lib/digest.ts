import { prisma } from "./db";
import { formatINR } from "./money";
import { COMPANY_NAME, statusLabel } from "./constants";

// Build an organization-wide KPI digest for a period (Section 6.7). Used by the
// scheduled-digest cron and the "Run now" action. Returns email subject + body.
export async function buildOrgDigest(frequency: "DAILY" | "WEEKLY"): Promise<{ subject: string; text: string }> {
  const days = frequency === "WEEKLY" ? 7 : 1;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const label = frequency === "WEEKLY" ? "Weekly" : "Daily";

  const [newLeads, enrolled, totalLeads, byStatus, outcomes, payments] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: since } } }),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.leadStatusHistory.groupBy({
      by: ["toStatus"],
      where: { changedAt: { gte: since }, toStatus: { in: ["VISA_APPROVED", "VISA_REFUSED"] } },
      _count: true,
    }),
    prisma.payment.findMany({ where: { paidAt: { gte: since } }, select: { amount: true } }),
  ]);

  const approved = outcomes.find((o) => o.toStatus === "VISA_APPROVED")?._count ?? 0;
  const refused = outcomes.find((o) => o.toStatus === "VISA_REFUSED")?._count ?? 0;
  const revenue = payments.reduce((s, p) => s + p.amount, 0);

  const lines = [
    `${COMPANY_NAME} — ${label} Summary`,
    `Period: last ${days} day${days === 1 ? "" : "s"}`,
    ``,
    `New leads:        ${newLeads}`,
    `New enrollments:  ${enrolled}`,
    `Fees collected:   ${formatINR(revenue)}`,
    `Visa approved:    ${approved}`,
    `Visa refused:     ${refused}`,
    ``,
    `Pipeline (all-time, ${totalLeads} leads):`,
    ...byStatus.sort((a, b) => b._count - a._count).map((s) => `  ${statusLabel(s.status).padEnd(22)} ${s._count}`),
    ``,
    `— Automated digest from ${COMPANY_NAME} CRM`,
  ];

  return { subject: `${COMPANY_NAME} ${label} Report — ${new Date().toLocaleDateString("en-GB")}`, text: lines.join("\n") };
}
