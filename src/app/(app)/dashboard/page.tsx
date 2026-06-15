import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { leadScopeWhere, applicationScopeWhere } from "@/lib/leads";
import { roleLabel, statusLabel, stageLabel, APPLICATION_STAGES, sourceLabel } from "@/lib/constants";
import type { RoleKey } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { StageBadge } from "@/components/StageBadge";
import { formatINR } from "@/lib/money";
import { startOfToday, endOfToday, startOfWeek, startOfMonth, daysAgo } from "@/lib/dates";
import { getSlaDays } from "@/lib/settings";

// Role-appropriate home dashboards (Section 7.9). Each role sees a different set of
// widgets driven by their access scope (Section 1.2). The page dispatches on role.
export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const role = user.role as RoleKey;

  let body: React.ReactNode;
  switch (role) {
    case "RECEPTION":
      body = <ReceptionDashboard user={user} />;
      break;
    case "B2C_TL_DIRECT":
    case "B2C_TL_CAREER":
      body = <TeamLeaderDashboard user={user} />;
      break;
    case "BRANCH_MANAGER":
      body = <BranchManagerDashboard user={user} />;
      break;
    case "BACKEND_COUNSELOR":
    case "ADMISSIONS":
    case "FILLING":
      body = <BackendDashboard user={user} />;
      break;
    case "DESTINATION_MANAGER":
      body = <DestinationDashboard user={user} />;
      break;
    case "BDM":
      body = <BdmDashboard user={user} />;
      break;
    case "VP":
    case "ADMIN":
      body = <VpDashboard user={user} />;
      break;
    default:
      body = <CounselorDashboard user={user} />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">{roleLabel(user.role)} dashboard</p>
      </div>
      {body}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Counselor (B2C Direct / Career) — Section 7.9
// Widgets: My leads today, Follow-ups due, My pipeline funnel, Recent activity, Tasks pending
// ---------------------------------------------------------------------------
async function CounselorDashboard({ user }: { user: SessionUser }) {
  const scope = leadScopeWhere(user);

  const [total, leadsToday, byStatus, followUpsDue, openTasks, recentInteractions] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { AND: [scope, { leadDate: { gte: startOfToday() } }] } }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.lead.count({
      where: { AND: [scope, { followUpDate: { lte: endOfToday() } }, { status: { notIn: ["ENROLLED", "VISA_APPROVED", "NOT_INTERESTED", "DUPLICATE"] } }] },
    }),
    prisma.task.count({ where: { assignedToId: user.id, status: { not: "COMPLETED" } } }),
    prisma.interaction.findMany({
      where: { lead: scope },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { lead: { select: { id: true, fullName: true } } },
    }),
  ]);

  const statusMap = toStatusMap(byStatus);

  return (
    <>
      <KpiRow
        kpis={[
          { label: "My Leads", value: total, href: "/leads" },
          { label: "New Today", value: leadsToday, href: "/leads" },
          { label: "Interested", value: statusMap["INTERESTED"] ?? 0, href: "/leads?status=INTERESTED" },
          { label: "Enrolled", value: statusMap["ENROLLED"] ?? 0, href: "/leads?status=ENROLLED" },
          { label: "Follow-ups Due", value: followUpsDue, href: "/leads" },
          { label: "My Open Tasks", value: openTasks, href: "/tasks" },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="My Pipeline Funnel">
          <Funnel rows={funnelFromStatusMap(statusMap)} />
        </Panel>
        <Panel title="Recent Activity">
          {recentInteractions.length === 0 ? (
            <Empty>No interactions logged yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recentInteractions.map((it) => (
                <li key={it.id} className="py-2">
                  <Link href={`/leads/${it.lead.id}`} className="font-medium text-brand-700 hover:underline">{it.lead.fullName}</Link>
                  <span className="text-slate-500"> — {it.type}: {it.summary.slice(0, 60)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Reception — branch lead-entry view (Sections 2.2, 6.1, 7.9)
// ---------------------------------------------------------------------------
async function ReceptionDashboard({ user }: { user: SessionUser }) {
  const branchWhere = user.branchId ? { branchId: user.branchId } : {};

  const [enteredToday, totalBranch, bySource, unassigned, recent] = await Promise.all([
    prisma.lead.count({ where: { AND: [branchWhere, { leadDate: { gte: startOfToday() } }] } }),
    prisma.lead.count({ where: branchWhere }),
    prisma.lead.groupBy({ by: ["source"], where: { AND: [branchWhere, { leadDate: { gte: startOfToday() } }] }, _count: true }),
    prisma.lead.count({ where: { AND: [branchWhere, { counselors: { none: {} } }, { status: { notIn: ["DUPLICATE", "NOT_INTERESTED"] } }] } }),
    prisma.lead.findMany({ where: branchWhere, orderBy: { createdAt: "desc" }, take: 6, include: { branch: { select: { name: true } } } }),
  ]);

  return (
    <>
      <KpiRow
        kpis={[
          { label: "Entered Today", value: enteredToday, href: "/leads" },
          { label: "Branch Leads", value: totalBranch, href: "/leads" },
          { label: "Unassigned", value: unassigned, href: "/leads" },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Today's Leads by Source">
          <BarList rows={bySource.map((r) => [sourceLabel(r.source), r._count] as [string, number])} />
        </Panel>
        <Panel title="Recent Leads">
          <RecentLeadList leads={recent} />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Backend operative (Backend Counselor / Admissions / Filling) — Section 4, 7.9
// ---------------------------------------------------------------------------
async function BackendDashboard({ user }: { user: SessionUser }) {
  const appScope = applicationScopeWhere(user);

  // Stages this role is responsible for actioning (Section 4.2).
  const actionStages: Record<string, string[]> = {
    BACKEND_COUNSELOR: ["ST_1"],
    ADMISSIONS: ["ST_2", "ST_3"],
    FILLING: ["ST_4", "ST_5"],
  };
  const mine = actionStages[user.role] ?? [];

  const [byStage, pending, recent] = await Promise.all([
    prisma.application.groupBy({ by: ["currentStage"], where: appScope, _count: true }),
    prisma.application.count({ where: { AND: [appScope, mine.length ? { currentStage: { in: mine } } : {}] } }),
    prisma.application.findMany({
      where: appScope,
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { lead: { select: { id: true, fullName: true } }, institution: { select: { name: true } } },
    }),
  ]);

  const stageMap = toStageMap(byStage);
  const totalCases = byStage.reduce((s, r) => s + r._count, 0);

  return (
    <>
      <KpiRow
        kpis={[
          { label: "My Cases", value: totalCases, href: "/applications" },
          { label: "Awaiting My Action", value: pending, href: "/applications" },
          { label: "Approved", value: stageMap["ST_6"] ?? 0, href: "/applications" },
          { label: "Refused", value: stageMap["ST_7"] ?? 0, href: "/applications" },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Cases per Stage">
          <BarList rows={Object.keys(APPLICATION_STAGES).map((k) => [stageLabel(k), stageMap[k] ?? 0] as [string, number])} />
        </Panel>
        <Panel title="Recently Updated Cases">
          {recent.length === 0 ? <Empty>No applications yet.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <Link href={`/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">
                    {a.lead.fullName} · {a.country}
                  </Link>
                  <StageBadge stage={a.currentStage} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Team Leader (Direct / Career) — Section 3.4, 6.3, 7.9
// Widgets: Team lead count, Counselor performance table, Team funnel, Unattended leads
// ---------------------------------------------------------------------------
async function TeamLeaderDashboard({ user }: { user: SessionUser }) {
  const scope = leadScopeWhere(user);
  const counselorRole: RoleKey = user.role === "B2C_TL_CAREER" ? "B2C_COUNSELOR_CAREER" : "B2C_COUNSELOR_DIRECT";
  const slaDays = await getSlaDays();

  const [total, byStatus, unattended, teamMembers] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    // Unattended: still NEW and older than the configurable SLA threshold (Sections 6.3, 7.8).
    prisma.lead.count({ where: { AND: [scope, { status: "NEW" }, { leadDate: { lt: daysAgo(slaDays) } }] } }),
    prisma.user.findMany({
      where: { role: counselorRole, isActive: true, ...(user.branchId ? { branchId: user.branchId } : {}) },
      select: { id: true, name: true },
    }),
  ]);

  const statusMap = toStatusMap(byStatus);

  // Per-counselor performance: leads assigned, enrolled, visa approved (Section 6.3).
  const perf = await Promise.all(
    teamMembers.map(async (m) => {
      const assignedWhere = { counselors: { some: { userId: m.id } } };
      const [leads, enrolled, approved] = await Promise.all([
        prisma.lead.count({ where: assignedWhere }),
        prisma.lead.count({ where: { AND: [assignedWhere, { status: "ENROLLED" }] } }),
        prisma.lead.count({ where: { AND: [assignedWhere, { status: "VISA_APPROVED" }] } }),
      ]);
      return { name: m.name, leads, enrolled, approved };
    })
  );

  return (
    <>
      <KpiRow
        kpis={[
          { label: "Team Leads", value: total, href: "/leads" },
          { label: "Interested", value: statusMap["INTERESTED"] ?? 0, href: "/leads?status=INTERESTED" },
          { label: "Enrolled", value: statusMap["ENROLLED"] ?? 0, href: "/leads?status=ENROLLED" },
          { label: `Unattended (>${slaDays}d)`, value: unattended, href: "/leads?status=NEW", alert: unattended > 0 },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Counselor Performance">
          {perf.length === 0 ? <Empty>No team members found.</Empty> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Counselor</th>
                  <th className="pb-2 text-right">Leads</th>
                  <th className="pb-2 text-right">Enrolled</th>
                  <th className="pb-2 text-right">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {perf.map((p) => (
                  <tr key={p.name}>
                    <td className="py-2 text-slate-700">{p.name}</td>
                    <td className="py-2 text-right font-medium">{p.leads}</td>
                    <td className="py-2 text-right">{p.enrolled}</td>
                    <td className="py-2 text-right">{p.approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Team Funnel">
          <Funnel rows={funnelFromStatusMap(statusMap)} />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Branch Manager — Section 6.4, 7.9
// ---------------------------------------------------------------------------
async function BranchManagerDashboard({ user }: { user: SessionUser }) {
  const scope = leadScopeWhere(user);
  const branchPaymentWhere = { enrollment: { lead: scope } };

  const [total, byStatus, enrolledMonth, payToday, payMonth, counselors] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.enrollment.count({ where: { lead: scope, enrolledAt: { gte: startOfMonth() } } }),
    prisma.payment.findMany({ where: { AND: [branchPaymentWhere, { paidAt: { gte: startOfToday() } }] }, select: { amount: true } }),
    prisma.payment.findMany({ where: { AND: [branchPaymentWhere, { paidAt: { gte: startOfMonth() } }] }, select: { amount: true } }),
    prisma.user.findMany({
      where: {
        isActive: true,
        ...(user.branchId ? { branchId: user.branchId } : {}),
        role: { in: ["B2C_COUNSELOR_DIRECT", "B2C_COUNSELOR_CAREER", "B2C_TL_DIRECT", "B2C_TL_CAREER"] },
      },
      select: { id: true, name: true },
    }),
  ]);

  const statusMap = toStatusMap(byStatus);
  const revToday = sum(payToday.map((p) => p.amount));
  const revMonth = sum(payMonth.map((p) => p.amount));

  const summary = await Promise.all(
    counselors.map(async (c) => {
      const where = { counselors: { some: { userId: c.id } } };
      const [leads, enrolled] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { AND: [where, { status: "ENROLLED" }] } }),
      ]);
      return { name: c.name, leads, enrolled };
    })
  );

  return (
    <>
      <KpiRow
        kpis={[
          { label: "Branch Leads", value: total, href: "/leads" },
          { label: "Enrolled This Month", value: enrolledMonth, href: "/enrollments" },
          { label: "Visa Approved", value: statusMap["VISA_APPROVED"] ?? 0, href: "/leads?status=VISA_APPROVED" },
          { label: "Revenue Today", value: formatINR(revToday) },
          { label: "Revenue This Month", value: formatINR(revMonth) },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Counselor Summary">
          {summary.length === 0 ? <Empty>No counselors in this branch.</Empty> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Counselor</th>
                  <th className="pb-2 text-right">Leads</th>
                  <th className="pb-2 text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.map((s) => (
                  <tr key={s.name}>
                    <td className="py-2 text-slate-700">{s.name}</td>
                    <td className="py-2 text-right font-medium">{s.leads}</td>
                    <td className="py-2 text-right">{s.enrolled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Branch Pipeline">
          <Funnel rows={funnelFromStatusMap(statusMap)} />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Destination Manager — Section 4.3, 6.5, 7.9
// ---------------------------------------------------------------------------
async function DestinationDashboard({ user }: { user: SessionUser }) {
  const appScope = applicationScopeWhere(user);

  const [byCountry, byStage, pendingByMember] = await Promise.all([
    prisma.application.groupBy({ by: ["country"], where: appScope, _count: true }),
    prisma.application.groupBy({ by: ["currentStage"], where: appScope, _count: true }),
    // Pending actions per backend team member across active (non-terminal) stages.
    prisma.application.findMany({
      where: { AND: [appScope, { currentStage: { notIn: ["ST_6", "ST_7"] } }] },
      select: {
        currentStage: true,
        backendCounselor: { select: { name: true } },
        admissionsOfficer: { select: { name: true } },
        fillingMember: { select: { name: true } },
      },
    }),
  ]);

  const stageMap = toStageMap(byStage);
  const totalCases = byStage.reduce((s, r) => s + r._count, 0);

  // Attribute each active case to whoever owns its current stage.
  const memberLoad: Record<string, number> = {};
  for (const a of pendingByMember) {
    let owner: string | undefined;
    if (a.currentStage === "ST_1") owner = a.backendCounselor?.name;
    else if (a.currentStage === "ST_2" || a.currentStage === "ST_3") owner = a.admissionsOfficer?.name;
    else owner = a.fillingMember?.name;
    const key = owner ?? "Unassigned";
    memberLoad[key] = (memberLoad[key] ?? 0) + 1;
  }

  return (
    <>
      <KpiRow
        kpis={[
          { label: "Total Cases", value: totalCases, href: "/applications" },
          { label: "Approved", value: stageMap["ST_6"] ?? 0, href: "/applications" },
          { label: "Refused", value: stageMap["ST_7"] ?? 0, href: "/applications" },
          { label: "In Pipeline", value: totalCases - (stageMap["ST_6"] ?? 0) - (stageMap["ST_7"] ?? 0), href: "/applications" },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Pipeline by Country">
          <BarList rows={byCountry.map((r) => [r.country, r._count] as [string, number])} />
        </Panel>
        <Panel title="Cases per Stage">
          <BarList rows={Object.keys(APPLICATION_STAGES).map((k) => [stageLabel(k), stageMap[k] ?? 0] as [string, number])} />
        </Panel>
        <Panel title="Pending Actions by Member">
          <BarList rows={Object.entries(memberLoad).map(([n, c]) => [n, c] as [string, number])} />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// BDM — Section 5.4, 6.6, 7.9
// ---------------------------------------------------------------------------
async function BdmDashboard({ user }: { user: SessionUser }) {
  const partners = await prisma.b2BPartner.findMany({
    where: { assignedBdmId: user.id },
    select: { id: true, companyName: true },
  });
  const partnerIds = partners.map((p) => p.id);

  const [assessWeek, assessMonth, perPartner, commissions] = await Promise.all([
    prisma.assessment.count({ where: { bdmId: user.id, createdAt: { gte: startOfWeek() } } }),
    prisma.assessment.count({ where: { bdmId: user.id, createdAt: { gte: startOfMonth() } } }),
    Promise.all(
      partners.map(async (p) => {
        const [assessments, applications] = await Promise.all([
          prisma.assessment.count({ where: { partnerId: p.id } }),
          prisma.application.count({ where: { lead: { partnerId: p.id } } }),
        ]);
        return { name: p.companyName, assessments, applications };
      })
    ),
    prisma.commission.groupBy({ by: ["status"], where: { partnerId: { in: partnerIds.length ? partnerIds : ["__none__"] } }, _sum: { amount: true } }),
  ]);

  const owed = commissions.find((c) => c.status === "OWED")?._sum.amount ?? 0;
  const paid = commissions.find((c) => c.status === "PAID")?._sum.amount ?? 0;

  return (
    <>
      <KpiRow
        kpis={[
          { label: "My Partners", value: partners.length, href: "/partners" },
          { label: "Assessments This Week", value: assessWeek, href: "/assessments" },
          { label: "Assessments This Month", value: assessMonth, href: "/assessments" },
          { label: "Commission Owed", value: formatINR(owed) },
          { label: "Commission Paid", value: formatINR(paid) },
        ]}
      />
      <Panel title="Partner Performance">
        {perPartner.length === 0 ? <Empty>No partners assigned to you yet.</Empty> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Partner</th>
                <th className="pb-2 text-right">Assessments</th>
                <th className="pb-2 text-right">Applications</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perPartner.map((p) => (
                <tr key={p.name}>
                  <td className="py-2 text-slate-700">{p.name}</td>
                  <td className="py-2 text-right font-medium">{p.assessments}</td>
                  <td className="py-2 text-right">{p.applications}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// VP / Admin — Section 6.7, 7.9 (global view)
// ---------------------------------------------------------------------------
async function VpDashboard({ user }: { user: SessionUser }) {
  const [total, byStatus, b2bLeads, payAll, byCountry, bdms] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.count({ where: { vertical: "B2B" } }),
    prisma.payment.findMany({ select: { amount: true } }),
    prisma.application.groupBy({ by: ["country"], _count: true }),
    prisma.user.findMany({ where: { role: "BDM", isActive: true }, select: { id: true, name: true } }),
  ]);

  const statusMap = toStatusMap(byStatus);
  const revenue = sum(payAll.map((p) => p.amount));
  const b2cLeads = total - b2bLeads;

  // Per-country approval performance.
  const approvedByCountry = await prisma.application.groupBy({
    by: ["country"],
    where: { currentStage: "ST_6" },
    _count: true,
  });
  const approvedMap: Record<string, number> = {};
  for (const r of approvedByCountry) approvedMap[r.country] = r._count;

  // BDM performance: partners managed + assessments.
  const bdmPerf = await Promise.all(
    bdms.map(async (b) => {
      const [partners, assessments] = await Promise.all([
        prisma.b2BPartner.count({ where: { assignedBdmId: b.id } }),
        prisma.assessment.count({ where: { bdmId: b.id } }),
      ]);
      return { name: b.name, partners, assessments };
    })
  );

  return (
    <>
      <KpiRow
        kpis={[
          { label: "Total Leads", value: total, href: "/leads" },
          { label: "Enrolled", value: statusMap["ENROLLED"] ?? 0, href: "/leads?status=ENROLLED" },
          { label: "Visa Approved", value: statusMap["VISA_APPROVED"] ?? 0, href: "/leads?status=VISA_APPROVED" },
          { label: "Visa Refused", value: statusMap["VISA_REFUSED"] ?? 0, href: "/leads?status=VISA_REFUSED" },
          { label: "Revenue Collected", value: formatINR(revenue) },
        ]}
      />
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="B2C vs B2B Split">
          <BarList rows={[["B2C", b2cLeads], ["B2B", b2bLeads]] as [string, number][]} />
        </Panel>
        <Panel title="Country Performance (cases · approved)">
          {byCountry.length === 0 ? <Empty>No applications yet.</Empty> : (
            <ul className="space-y-2 text-sm">
              {byCountry.map((r) => (
                <li key={r.country} className="flex justify-between">
                  <span className="text-slate-600">{r.country}</span>
                  <span className="font-medium text-slate-800">{r._count} · {approvedMap[r.country] ?? 0} approved</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="BDM Performance">
        {bdmPerf.length === 0 ? <Empty>No BDMs configured.</Empty> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">BDM</th>
                <th className="pb-2 text-right">Partners</th>
                <th className="pb-2 text-right">Assessments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bdmPerf.map((b) => (
                <tr key={b.name}>
                  <td className="py-2 text-slate-700">{b.name}</td>
                  <td className="py-2 text-right font-medium">{b.partners}</td>
                  <td className="py-2 text-right">{b.assessments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared UI primitives & helpers
// ---------------------------------------------------------------------------
type Kpi = { label: string; value: number | string; href?: string; alert?: boolean };

function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => {
        const inner = (
          <>
            <div className={"text-2xl font-semibold " + (k.alert ? "text-rose-600" : "text-slate-900")}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </>
        );
        return k.href ? (
          <Link key={k.label} href={k.href} className="card p-4 transition hover:shadow-md">{inner}</Link>
        ) : (
          <div key={k.label} className="card p-4">{inner}</div>
        );
      })}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

function Funnel({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((f) => (
        <div key={f.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-slate-600">{f.label}</span>
          <div className="h-6 flex-1 rounded bg-slate-100">
            <div className="flex h-6 items-center rounded bg-brand-500 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(6, (f.value / max) * 100)}%` }}>
              {f.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BarList({ rows }: { rows: [string, number][] }) {
  const sorted = [...rows].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return <Empty>No data.</Empty>;
  const max = Math.max(...sorted.map((r) => r[1]), 1);
  return (
    <div className="space-y-2">
      {sorted.map(([label, count]) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-slate-600" title={label}>{label}</span>
          <div className="h-5 flex-1 rounded bg-slate-100">
            <div className="flex h-5 items-center rounded bg-brand-400 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(8, (count / max) * 100)}%` }}>
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentLeadList({ leads }: { leads: { id: string; fullName: string; status: string; branch: { name: string } }[] }) {
  if (leads.length === 0) return <Empty>No leads yet.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {leads.map((l) => (
        <li key={l.id} className="flex items-center justify-between py-2 text-sm">
          <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">{l.fullName}</Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{l.branch.name}</span>
            <StatusBadge status={l.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function toStatusMap(rows: { status: string; _count: number }[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.status] = r._count;
  return m;
}

function toStageMap(rows: { currentStage: string; _count: number }[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.currentStage] = r._count;
  return m;
}

function funnelFromStatusMap(statusMap: Record<string, number>): { label: string; value: number }[] {
  const enrolled = statusMap["ENROLLED"] ?? 0;
  const approved = statusMap["VISA_APPROVED"] ?? 0;
  const refused = statusMap["VISA_REFUSED"] ?? 0;
  const interested = (statusMap["INTERESTED"] ?? 0) + enrolled + approved + refused;
  const contacted = (statusMap["CONTACTED"] ?? 0) + (statusMap["FOLLOW_UP"] ?? 0) + interested;
  const total = Object.values(statusMap).reduce((s, n) => s + n, 0);
  return [
    { label: "Leads", value: total },
    { label: "Contacted", value: contacted },
    { label: "Interested", value: interested },
    { label: "Enrolled", value: enrolled + approved + refused },
    { label: "Visa Approved", value: approved },
  ];
}

function sum(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0);
}
