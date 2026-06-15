import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { leadScopeWhere, applicationScopeWhere } from "./leads";
import {
  parseServices,
  serviceLabel,
  sourceLabel,
  statusLabel,
  stageLabel,
  eligibilityLabel,
  APPLICATION_STAGES,
  type RoleKey,
} from "./constants";
import { computeEnrollmentTotals, sumPayments } from "./money";

export type ReportRange = { from?: Date; to?: Date };

// Parse ?from=&to= (YYYY-MM-DD) into a range; `to` is widened to end-of-day.
export function parseRange(params: URLSearchParams): ReportRange {
  const from = params.get("from");
  const to = params.get("to");
  const range: ReportRange = {};
  if (from) range.from = new Date(from + "T00:00:00");
  if (to) range.to = new Date(to + "T23:59:59.999");
  return range;
}

// Generic date-range `where` fragment. Defaults to LeadWhereInput but can target
// any model's where type (Enrollment, Payment, Application, Assessment).
function rangeClause<T = Prisma.LeadWhereInput>(field: string, range: ReportRange): T {
  if (!range.from && !range.to) return {} as T;
  const cond: Record<string, Date> = {};
  if (range.from) cond.gte = range.from;
  if (range.to) cond.lte = range.to;
  return { [field]: cond } as T;
}

function pct(n: number, d: number): string {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export type ReportRow = (string | number)[];
export type ReportDef = {
  key: string;
  title: string;
  section: string;
  columns: string[];
  visible: (role: RoleKey) => boolean;
  compute: (user: SessionUser, range: ReportRange) => Promise<ReportRow[]>;
};

// Visibility helper groups.
const MANAGER_ROLES: RoleKey[] = ["BRANCH_MANAGER", "VP", "ADMIN"];
const LEADER_ROLES: RoleKey[] = ["B2C_TL_DIRECT", "B2C_TL_CAREER", ...MANAGER_ROLES];
const BACKEND_ROLES: RoleKey[] = ["BACKEND_COUNSELOR", "ADMISSIONS", "FILLING", "DESTINATION_MANAGER", "VP", "ADMIN"];
const B2B_ROLES: RoleKey[] = ["B2B_COUNSELOR", "BDM", "VP", "ADMIN"];
const VP_ROLES: RoleKey[] = ["VP", "ADMIN"];
const has = (list: RoleKey[]) => (role: RoleKey) => list.includes(role);

// Counselors visible to this user for performance comparison (Section 6.3/6.4).
async function teamCounselors(user: SessionUser): Promise<{ id: string; name: string }[]> {
  const role = user.role as RoleKey;
  const counselorRoles: RoleKey[] =
    role === "B2C_TL_CAREER"
      ? ["B2C_COUNSELOR_CAREER"]
      : role === "B2C_TL_DIRECT"
      ? ["B2C_COUNSELOR_DIRECT"]
      : ["B2C_COUNSELOR_DIRECT", "B2C_COUNSELOR_CAREER", "B2C_TL_DIRECT", "B2C_TL_CAREER"];
  const branchFilter =
    role === "VP" || role === "ADMIN" ? {} : user.branchId ? { branchId: user.branchId } : {};
  return prisma.user.findMany({
    where: { isActive: true, role: { in: counselorRoles }, ...branchFilter },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Report registry (Section 6). Each report is scoped to the viewer and filtered
// by the shared date range, and is exportable to CSV via the same compute fn.
// ---------------------------------------------------------------------------
export const REPORTS: ReportDef[] = [
  // --- Leads & Sources (6.1) ---
  {
    key: "daily-leads",
    title: "Daily Leads Entered",
    section: "Leads & Sources",
    columns: ["Date", "Leads"],
    visible: has(["RECEPTION", ...LEADER_ROLES]),
    compute: async (user, range) => {
      const leads = await prisma.lead.findMany({
        where: { AND: [leadScopeWhere(user), rangeClause("leadDate", range)] },
        select: { leadDate: true },
      });
      const byDay: Record<string, number> = {};
      for (const l of leads) {
        const d = new Date(l.leadDate).toISOString().slice(0, 10);
        byDay[d] = (byDay[d] ?? 0) + 1;
      }
      return Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, c]) => [d, c]);
    },
  },
  {
    key: "lead-source",
    title: "Lead Source Performance",
    section: "Leads & Sources",
    columns: ["Source", "Leads", "Interested+", "Enrolled+"],
    visible: () => true,
    compute: async (user, range) => {
      const leads = await prisma.lead.findMany({
        where: { AND: [leadScopeWhere(user), rangeClause("leadDate", range)] },
        select: { source: true, status: true },
      });
      const agg: Record<string, { total: number; interested: number; enrolled: number }> = {};
      const interestedish = new Set(["INTERESTED", "ENROLLED", "VISA_APPROVED", "VISA_REFUSED"]);
      const enrolledish = new Set(["ENROLLED", "VISA_APPROVED", "VISA_REFUSED"]);
      for (const l of leads) {
        const a = (agg[l.source] ??= { total: 0, interested: 0, enrolled: 0 });
        a.total++;
        if (interestedish.has(l.status)) a.interested++;
        if (enrolledish.has(l.status)) a.enrolled++;
      }
      return Object.entries(agg)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([s, a]) => [sourceLabel(s), a.total, a.interested, a.enrolled]);
    },
  },
  {
    key: "leads-by-service",
    title: "Leads by Service Type",
    section: "Leads & Sources",
    columns: ["Service", "Leads"],
    visible: () => true,
    compute: async (user, range) => {
      const leads = await prisma.lead.findMany({
        where: { AND: [leadScopeWhere(user), rangeClause("leadDate", range)] },
        select: { services: true },
      });
      const counts: Record<string, number> = {};
      for (const l of leads) for (const s of parseServices(l.services)) counts[s] = (counts[s] ?? 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s, c]) => [serviceLabel(s), c]);
    },
  },
  {
    key: "status-breakdown",
    title: "Status-wise Lead Report",
    section: "Leads & Sources",
    columns: ["Status", "Leads"],
    visible: () => true,
    compute: async (user, range) => {
      const rows = await prisma.lead.groupBy({
        by: ["status"],
        where: { AND: [leadScopeWhere(user), rangeClause("leadDate", range)] },
        _count: true,
      });
      return rows.sort((a, b) => b._count - a._count).map((r) => [statusLabel(r.status), r._count]);
    },
  },

  // --- Conversion & Performance (6.2/6.3) ---
  {
    key: "conversion-funnel",
    title: "Conversion Funnel",
    section: "Conversion & Performance",
    columns: ["Stage", "Count", "% of Leads"],
    visible: () => true,
    compute: async (user, range) => {
      const rows = await prisma.lead.groupBy({
        by: ["status"],
        where: { AND: [leadScopeWhere(user), rangeClause("leadDate", range)] },
        _count: true,
      });
      const m: Record<string, number> = {};
      for (const r of rows) m[r.status] = r._count;
      const total = Object.values(m).reduce((s, n) => s + n, 0);
      const enrolled = (m["ENROLLED"] ?? 0) + (m["VISA_APPROVED"] ?? 0) + (m["VISA_REFUSED"] ?? 0);
      const interested = (m["INTERESTED"] ?? 0) + enrolled;
      const contacted = (m["CONTACTED"] ?? 0) + (m["FOLLOW_UP"] ?? 0) + interested;
      const approved = m["VISA_APPROVED"] ?? 0;
      return [
        ["Leads", total, pct(total, total)],
        ["Contacted", contacted, pct(contacted, total)],
        ["Interested", interested, pct(interested, total)],
        ["Enrolled", enrolled, pct(enrolled, total)],
        ["Visa Approved", approved, pct(approved, total)],
      ];
    },
  },
  {
    key: "counselor-performance",
    title: "Counselor Performance Comparison",
    section: "Conversion & Performance",
    columns: ["Counselor", "Leads", "Enrolled", "Visa Approved", "Conversion"],
    visible: has(LEADER_ROLES),
    compute: async (user, range) => {
      const counselors = await teamCounselors(user);
      const rows: ReportRow[] = [];
      for (const c of counselors) {
        const base = { counselors: { some: { userId: c.id } } };
        const dateClause = rangeClause("leadDate", range);
        const [leads, enrolled, approved] = await Promise.all([
          prisma.lead.count({ where: { AND: [base, dateClause] } }),
          prisma.lead.count({ where: { AND: [base, dateClause, { status: "ENROLLED" }] } }),
          prisma.lead.count({ where: { AND: [base, dateClause, { status: "VISA_APPROVED" }] } }),
        ]);
        rows.push([c.name, leads, enrolled, approved, pct(enrolled + approved, leads)]);
      }
      return rows.sort((a, b) => Number(b[1]) - Number(a[1]));
    },
  },
  {
    key: "unattended-leads",
    title: "Unattended Leads (>2 days, still New)",
    section: "Conversion & Performance",
    columns: ["Student", "Status", "Lead Date", "Days Old"],
    visible: has(LEADER_ROLES),
    compute: async (user, range) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 2);
      const leads = await prisma.lead.findMany({
        where: { AND: [leadScopeWhere(user), rangeClause("leadDate", range), { status: "NEW" }, { leadDate: { lt: cutoff } }] },
        select: { fullName: true, status: true, leadDate: true },
        orderBy: { leadDate: "asc" },
      });
      const now = Date.now();
      return leads.map((l) => [
        l.fullName,
        statusLabel(l.status),
        new Date(l.leadDate).toISOString().slice(0, 10),
        Math.floor((now - new Date(l.leadDate).getTime()) / 86400000),
      ]);
    },
  },

  // --- Enrollment & Revenue (6.2/6.4) ---
  {
    key: "enrolled-students",
    title: "Enrolled Students",
    section: "Enrollment & Revenue",
    columns: ["Student", "Branch", "Net Payable", "Collected", "Status", "Enrolled"],
    visible: () => true,
    compute: async (user, range) => {
      const enr = await prisma.enrollment.findMany({
        where: { AND: [{ lead: leadScopeWhere(user) }, rangeClause<Prisma.EnrollmentWhereInput>("enrolledAt", range)] },
        orderBy: { enrolledAt: "desc" },
        include: { lead: { select: { fullName: true, branch: { select: { name: true } } } }, items: true, payments: true },
      });
      return enr.map((e) => {
        const { net } = computeEnrollmentTotals(e.items, e.discountAmount);
        return [
          e.lead.fullName,
          e.lead.branch.name,
          net,
          sumPayments(e.payments),
          e.paymentStatus,
          new Date(e.enrolledAt).toISOString().slice(0, 10),
        ];
      });
    },
  },
  {
    key: "revenue-by-month",
    title: "Revenue Collected (by month)",
    section: "Enrollment & Revenue",
    columns: ["Month", "Revenue (₹)"],
    visible: () => true,
    compute: async (user, range) => {
      const payments = await prisma.payment.findMany({
        where: { AND: [{ enrollment: { lead: leadScopeWhere(user) } }, rangeClause<Prisma.PaymentWhereInput>("paidAt", range)] },
        select: { amount: true, paidAt: true },
      });
      const byMonth: Record<string, number> = {};
      for (const p of payments) {
        const m = new Date(p.paidAt).toISOString().slice(0, 7);
        byMonth[m] = (byMonth[m] ?? 0) + p.amount;
      }
      return Object.entries(byMonth).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([m, v]) => [m, v]);
    },
  },

  // --- Visa & Pipeline (6.5) ---
  {
    key: "visa-outcome",
    title: "Visa Outcome Report",
    section: "Visa & Pipeline",
    columns: ["Student", "Country", "Institution", "Outcome", "Updated"],
    visible: () => true,
    compute: async (user, range) => {
      const apps = await prisma.application.findMany({
        where: { AND: [applicationScopeWhere(user), { outcome: { not: null } }, rangeClause<Prisma.ApplicationWhereInput>("updatedAt", range)] },
        orderBy: { updatedAt: "desc" },
        include: { lead: { select: { fullName: true } }, institution: { select: { name: true } } },
      });
      return apps.map((a) => [a.lead.fullName, a.country, a.institution?.name ?? "—", a.outcome ?? "", new Date(a.updatedAt).toISOString().slice(0, 10)]);
    },
  },
  {
    key: "application-pipeline",
    title: "Application Pipeline Report",
    section: "Visa & Pipeline",
    columns: ["Stage", "Applications"],
    visible: has(BACKEND_ROLES),
    compute: async (user, range) => {
      const rows = await prisma.application.groupBy({
        by: ["currentStage"],
        where: { AND: [applicationScopeWhere(user), rangeClause<Prisma.ApplicationWhereInput>("updatedAt", range)] },
        _count: true,
      });
      const m: Record<string, number> = {};
      for (const r of rows) m[r.currentStage] = r._count;
      return Object.keys(APPLICATION_STAGES).map((k) => [stageLabel(k), m[k] ?? 0]);
    },
  },
  {
    key: "institution-wise",
    title: "Institution-wise Application Report",
    section: "Visa & Pipeline",
    columns: ["Institution", "Applications", "Approved", "Refused"],
    visible: has(BACKEND_ROLES),
    compute: async (user, range) => {
      const apps = await prisma.application.findMany({
        where: { AND: [applicationScopeWhere(user), rangeClause<Prisma.ApplicationWhereInput>("updatedAt", range)] },
        include: { institution: { select: { name: true } } },
      });
      const agg: Record<string, { total: number; approved: number; refused: number }> = {};
      for (const a of apps) {
        const name = a.institution?.name ?? "Unassigned";
        const r = (agg[name] ??= { total: 0, approved: 0, refused: 0 });
        r.total++;
        if (a.currentStage === "ST_6") r.approved++;
        if (a.currentStage === "ST_7") r.refused++;
      }
      return Object.entries(agg).sort((a, b) => b[1].total - a[1].total).map(([n, r]) => [n, r.total, r.approved, r.refused]);
    },
  },
  {
    key: "turnaround-time",
    title: "Turnaround Time Report (avg days per stage)",
    section: "Visa & Pipeline",
    columns: ["Stage", "Avg Days", "Samples"],
    visible: has(BACKEND_ROLES),
    compute: async (user, range) => {
      const apps = await prisma.application.findMany({
        where: { AND: [applicationScopeWhere(user), rangeClause<Prisma.ApplicationWhereInput>("updatedAt", range)] },
        select: { stageHistory: { orderBy: { at: "asc" }, select: { stageCode: true, at: true } } },
      });
      // Attribute the gap between consecutive stage entries to the earlier stage.
      const totals: Record<string, { days: number; n: number }> = {};
      for (const a of apps) {
        const h = a.stageHistory;
        for (let i = 0; i < h.length - 1; i++) {
          const days = (new Date(h[i + 1].at).getTime() - new Date(h[i].at).getTime()) / 86400000;
          const t = (totals[h[i].stageCode] ??= { days: 0, n: 0 });
          t.days += days;
          t.n++;
        }
      }
      return Object.keys(APPLICATION_STAGES)
        .filter((k) => totals[k])
        .map((k) => [stageLabel(k), Math.round((totals[k].days / totals[k].n) * 10) / 10, totals[k].n]);
    },
  },

  // --- B2B (6.6) ---
  {
    key: "assessments",
    title: "Assessments Done",
    section: "B2B",
    columns: ["Partner", "Assessments", "Eligible", "Not Eligible", "Conditional"],
    visible: has(B2B_ROLES),
    compute: async (user, range) => {
      const role = user.role as RoleKey;
      const where: Prisma.AssessmentWhereInput = {
        AND: [
          role === "BDM" ? { bdmId: user.id } : role === "B2B_COUNSELOR" ? { enteredById: user.id } : {},
          rangeClause<Prisma.AssessmentWhereInput>("createdAt", range),
        ],
      };
      const rows = await prisma.assessment.findMany({ where, include: { partner: { select: { companyName: true } } } });
      const agg: Record<string, { total: number; e: number; ne: number; c: number }> = {};
      for (const a of rows) {
        const name = a.partner?.companyName ?? "—";
        const r = (agg[name] ??= { total: 0, e: 0, ne: 0, c: 0 });
        r.total++;
        if (a.eligibilityOutcome === "ELIGIBLE") r.e++;
        else if (a.eligibilityOutcome === "NOT_ELIGIBLE") r.ne++;
        else r.c++;
      }
      return Object.entries(agg).sort((a, b) => b[1].total - a[1].total).map(([n, r]) => [n, r.total, r.e, r.ne, r.c]);
    },
  },
  {
    key: "partner-performance",
    title: "Partner Performance Report",
    section: "B2B",
    columns: ["Partner", "Assessments", "Applications", "Approved", "Commission Owed (₹)"],
    visible: has(["BDM", "VP", "ADMIN"]),
    compute: async (user, range) => {
      const role = user.role as RoleKey;
      const partners = await prisma.b2BPartner.findMany({
        where: role === "BDM" ? { assignedBdmId: user.id } : {},
        select: { id: true, companyName: true },
      });
      const rows: ReportRow[] = [];
      for (const p of partners) {
        const [assessments, applications, approved, owed] = await Promise.all([
          prisma.assessment.count({ where: { AND: [{ partnerId: p.id }, rangeClause<Prisma.AssessmentWhereInput>("createdAt", range)] } }),
          prisma.application.count({ where: { lead: { partnerId: p.id } } }),
          prisma.application.count({ where: { lead: { partnerId: p.id }, currentStage: "ST_6" } }),
          prisma.commission.aggregate({ where: { partnerId: p.id, status: "OWED" }, _sum: { amount: true } }),
        ]);
        rows.push([p.companyName, assessments, applications, approved, owed._sum.amount ?? 0]);
      }
      return rows.sort((a, b) => Number(b[2]) - Number(a[2]));
    },
  },
  {
    key: "bdm-performance",
    title: "BDM Performance Report",
    section: "B2B",
    columns: ["BDM", "Partners", "Assessments"],
    visible: has(VP_ROLES),
    compute: async (_user, range) => {
      const bdms = await prisma.user.findMany({ where: { role: "BDM", isActive: true }, select: { id: true, name: true } });
      const rows: ReportRow[] = [];
      for (const b of bdms) {
        const [partners, assessments] = await Promise.all([
          prisma.b2BPartner.count({ where: { assignedBdmId: b.id } }),
          prisma.assessment.count({ where: { AND: [{ bdmId: b.id }, rangeClause<Prisma.AssessmentWhereInput>("createdAt", range)] } }),
        ]);
        rows.push([b.name, partners, assessments]);
      }
      return rows.sort((a, b) => Number(b[2]) - Number(a[2]));
    },
  },

  // --- Management / VP (6.7) ---
  {
    key: "refusal-analysis",
    title: "Refusal Analysis (by country)",
    section: "Management",
    columns: ["Country", "Refusals"],
    visible: has(VP_ROLES),
    compute: async (_user, range) => {
      const rows = await prisma.application.groupBy({
        by: ["country"],
        where: { AND: [{ currentStage: "ST_7" }, rangeClause<Prisma.ApplicationWhereInput>("updatedAt", range)] },
        _count: true,
      });
      return rows.sort((a, b) => b._count - a._count).map((r) => [r.country, r._count]);
    },
  },
  {
    key: "country-funnel",
    title: "Country Conversion Funnel",
    section: "Management",
    columns: ["Country", "Total Cases", "Lodged+", "Approved", "Refused"],
    visible: has(["DESTINATION_MANAGER", "VP", "ADMIN"]),
    compute: async (user, range) => {
      const apps = await prisma.application.findMany({
        where: { AND: [applicationScopeWhere(user), rangeClause<Prisma.ApplicationWhereInput>("updatedAt", range)] },
        select: { country: true, currentStage: true },
      });
      const order = ["ST_1", "ST_2", "ST_3", "ST_4", "ST_5", "ST_6", "ST_7"];
      const agg: Record<string, { total: number; lodged: number; approved: number; refused: number }> = {};
      for (const a of apps) {
        const r = (agg[a.country] ??= { total: 0, lodged: 0, approved: 0, refused: 0 });
        r.total++;
        if (order.indexOf(a.currentStage) >= order.indexOf("ST_5")) r.lodged++;
        if (a.currentStage === "ST_6") r.approved++;
        if (a.currentStage === "ST_7") r.refused++;
      }
      return Object.entries(agg).sort((a, b) => b[1].total - a[1].total).map(([c, r]) => [c, r.total, r.lodged, r.approved, r.refused]);
    },
  },
];

export function reportsForRole(role: RoleKey): ReportDef[] {
  return REPORTS.filter((r) => r.visible(role));
}

export function getReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}
