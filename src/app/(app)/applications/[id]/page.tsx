import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_BACKEND, CAN_UPLOAD_DOCS } from "@/lib/rbac";
import { StageBadge } from "@/components/StageBadge";
import { StageAdvanceForm } from "@/components/StageAdvanceForm";
import { DocumentSection } from "@/components/DocumentSection";
import { assignApplicationRolesAction } from "../actions";
import { APPLICATION_STAGES, stageLabel } from "@/lib/constants";

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      lead: { select: { id: true, fullName: true, branch: { select: { name: true } } } },
      institution: { select: { id: true, name: true } },
      backendCounselor: { select: { name: true } },
      admissionsOfficer: { select: { name: true } },
      fillingMember: { select: { name: true } },
      stageHistory: { include: { by: { select: { name: true } } }, orderBy: { at: "desc" } },
      documents: { include: { uploadedBy: { select: { name: true } } }, orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!app) notFound();

  const canBackend = can(user.role, CAN_BACKEND);

  const [backendCounselors, admissionsOfficers, fillingMembers, institutions] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, role: "BACKEND_COUNSELOR" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, role: "ADMISSIONS" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, role: "FILLING" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.institution.findMany({ where: { isActive: true, country: app.country }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/applications" className="text-sm text-slate-500 hover:text-slate-700">← Applications</Link>
        <h1 className="text-xl font-semibold text-slate-900">{app.lead.fullName} · {app.country}</h1>
        <StageBadge stage={app.currentStage} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Application Details</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Student" value={app.lead.fullName} />
              <Field label="Country" value={app.country} />
              <Field label="Institution" value={app.institution?.name ?? "—"} />
              <Field label="Program" value={app.program ?? "—"} />
              <Field label="Intake" value={app.intake ?? "—"} />
              <Field label="Branch" value={app.lead.branch.name} />
              <Field label="Lodgment Ref" value={app.lodgmentRef ?? "—"} />
              <Field label="Lodgment Date" value={fmtDate(app.lodgmentDate)} />
              {app.outcome && <Field label="Outcome" value={app.outcome} />}
            </dl>
            {app.refusalReason && (
              <div className="mt-4">
                <div className="label">Refusal Reason</div>
                <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{app.refusalReason}</p>
              </div>
            )}
          </section>

          {/* Pipeline progress */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Pipeline</h2>
            <ol className="flex flex-wrap gap-2 text-xs">
              {Object.entries(APPLICATION_STAGES).map(([code, label]) => {
                const reached = app.stageHistory.some((h) => h.stageCode === code) || app.currentStage === code;
                const current = app.currentStage === code;
                return (
                  <li
                    key={code}
                    className={`rounded-full px-3 py-1 ${
                      current ? "bg-brand-600 text-white" : reached ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {label}
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Documents ({app.documents.length})</h2>
            <DocumentSection
              applicationId={app.id}
              canUpload={can(user.role, CAN_UPLOAD_DOCS)}
              documents={app.documents.map((d) => ({
                id: d.id, type: d.type, label: d.label, fileName: d.fileName, version: d.version,
                fileSize: d.fileSize, uploadedAt: d.uploadedAt, expiresAt: d.expiresAt, uploadedByName: d.uploadedBy?.name,
              }))}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Stage History</h2>
            {app.stageHistory.length === 0 ? (
              <p className="text-sm text-slate-400">No stage changes yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {app.stageHistory.map((h) => (
                  <li key={h.id} className="flex flex-col border-l-2 border-brand-200 pl-3">
                    <span className="text-slate-700">{stageLabel(h.stageCode)}</span>
                    <span className="text-xs text-slate-400">{h.by?.name ?? "System"} · {fmtDateTime(h.at)}</span>
                    {h.note && <span className="text-xs text-slate-500">{h.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Advance Stage</h2>
            {canBackend ? (
              <StageAdvanceForm applicationId={app.id} currentStage={app.currentStage} institutions={institutions} />
            ) : (
              <p className="text-xs text-slate-400">Only backend team members can advance stages.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Team Assignment</h2>
            {canBackend ? (
              <form action={assignApplicationRolesAction} className="space-y-3">
                <input type="hidden" name="applicationId" value={app.id} />
                <SelectField name="backendCounselorId" label="Backend Counselor" options={backendCounselors} current={app.backendCounselorId} />
                <SelectField name="admissionsOfficerId" label="Admissions Officer" options={admissionsOfficers} current={app.admissionsOfficerId} />
                <SelectField name="fillingMemberId" label="Filling Team" options={fillingMembers} current={app.fillingMemberId} />
                <SelectField name="institutionId" label="Institution" options={institutions} current={app.institutionId} />
                <button className="btn-secondary w-full">Save Assignment</button>
              </form>
            ) : (
              <div className="space-y-1 text-sm text-slate-600">
                <div>Backend: {app.backendCounselor?.name ?? "—"}</div>
                <div>Admissions: {app.admissionsOfficer?.name ?? "—"}</div>
                <div>Filling: {app.fillingMember?.name ?? "—"}</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}

function SelectField({
  name, label, options, current,
}: {
  name: string; label: string; options: { id: string; name: string }[]; current: string | null;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select name={name} className="input" defaultValue={current ?? ""}>
        <option value="">Unassigned</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
