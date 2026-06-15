import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ASSIGN_LEAD, CAN_ENROLL, CAN_BACKEND, CAN_UPLOAD_DOCS, CAN_MERGE_LEAD, CAN_ADMIN } from "@/lib/rbac";
import { eraseLeadAction } from "@/app/(app)/leads/actions";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusChanger } from "@/components/StatusChanger";
import { InteractionForm } from "@/components/InteractionForm";
import { AssignForm } from "@/components/AssignForm";
import { StageBadge } from "@/components/StageBadge";
import { DocumentSection } from "@/components/DocumentSection";
import { SendMessageForm } from "@/components/SendMessageForm";
import { MergeLeadPanel } from "@/components/MergeLeadPanel";
import { recordPaymentAction } from "@/app/(app)/enrollments/actions";
import { createPaymentLinkAction, markPaymentLinkPaidAction } from "@/app/(app)/payments/actions";
import { computeEnrollmentTotals, sumPayments, formatINR } from "@/lib/money";
import {
  parseServices,
  serviceLabel,
  sourceLabel,
  verticalLabel,
  statusLabel,
  paymentModeLabel,
  channelLabel,
  documentTypeLabel,
  requiredDocsForServices,
  INTERACTION_TYPES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  MESSAGE_STATUS_COLORS,
  type ServiceTypeKey,
} from "@/lib/constants";

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      branch: true,
      enteredBy: { select: { name: true } },
      partner: { select: { companyName: true } },
      counselors: { include: { user: { select: { id: true, name: true } } } },
      interactions: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { changedAt: "desc" } },
      tasks: { orderBy: { dueDate: "asc" }, include: { assignedTo: { select: { name: true } } } },
      enrollment: {
        include: {
          items: { include: { package: { select: { name: true } } } },
          payments: { include: { recordedBy: { select: { name: true } } }, orderBy: { paidAt: "desc" } },
          paymentLinks: { orderBy: { createdAt: "desc" } },
        },
      },
      applications: {
        include: { institution: { select: { name: true } }, backendCounselor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      documents: { include: { uploadedBy: { select: { name: true } } }, orderBy: { uploadedAt: "desc" } },
      messageLogs: { include: { sentBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!lead) notFound();

  const canAssign = can(user.role, CAN_ASSIGN_LEAD);
  const services = parseServices(lead.services);
  const directCounselor = lead.counselors.find((c) => c.stream === "DIRECT");
  const careerCounselor = lead.counselors.find((c) => c.stream === "CAREER");

  const enrollment = lead.enrollment;
  const enrollTotals = enrollment ? computeEnrollmentTotals(enrollment.items, enrollment.discountAmount) : null;
  const collected = enrollment ? sumPayments(enrollment.payments) : 0;
  const canEnroll = can(user.role, CAN_ENROLL);
  const canBackend = can(user.role, CAN_BACKEND);

  const templates = await prisma.messageTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, channel: true, subject: true, body: true },
  });

  const [directCounselors, careerCounselors] = canAssign
    ? await Promise.all([
        prisma.user.findMany({
          where: { isActive: true, role: { in: ["B2C_COUNSELOR_DIRECT", "B2C_TL_DIRECT"] } },
          select: { id: true, name: true }, orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ["B2C_COUNSELOR_CAREER", "B2C_TL_CAREER"] } },
          select: { id: true, name: true }, orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/leads" className="text-sm text-slate-500 hover:text-slate-700">← Leads</Link>
        <h1 className="text-xl font-semibold text-slate-900">{lead.fullName}</h1>
        <StatusBadge status={lead.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: profile + interactions */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Lead Profile</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Phone" value={`${lead.phone}${lead.isWhatsapp ? "  (WhatsApp)" : ""}`} />
              <Field label="Email" value={lead.email ?? "—"} />
              <Field label="Date of Birth" value={fmtDate(lead.dateOfBirth)} />
              <Field label="Vertical" value={verticalLabel(lead.vertical)} />
              <Field label="Source" value={`${sourceLabel(lead.source)}${lead.sourceSubType ? ` · ${lead.sourceSubType}` : ""}`} />
              <Field label="Branch" value={lead.branch.name} />
              {lead.partner && <Field label="B2B Partner" value={lead.partner.companyName} />}
              <Field label="Entered By" value={lead.enteredBy?.name ?? "—"} />
              <Field label="Lead Date" value={fmtDateTime(lead.leadDate)} />
              <Field label="Follow-up Date" value={fmtDate(lead.followUpDate)} />
            </dl>
            <div className="mt-4">
              <div className="label">Services Required</div>
              <div className="flex flex-wrap gap-1.5">
                {services.length ? services.map((s) => (
                  <span key={s} className="badge bg-brand-50 text-brand-700">{serviceLabel(s)}</span>
                )) : <span className="text-sm text-slate-400">—</span>}
              </div>
            </div>
            {lead.notes && (
              <div className="mt-4">
                <div className="label">Notes</div>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{lead.notes}</p>
              </div>
            )}
            {lead.closeReason && (
              <div className="mt-4">
                <div className="label">Close / Outcome Reason</div>
                <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{lead.closeReason}</p>
              </div>
            )}
          </section>

          {/* Enrollment & Payments (Section 3.2–3.3) */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Enrollment & Payments</h2>
              {!enrollment && canEnroll && (
                <Link href={`/leads/${lead.id}/enroll`} className="btn-primary px-3 py-1.5 text-xs">Enroll Student</Link>
              )}
            </div>

            {!enrollment ? (
              <p className="text-sm text-slate-400">Not enrolled yet.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {enrollment.items.map((i) => (
                      <span key={i.id} className="badge bg-brand-50 text-brand-700">{i.package.name}</span>
                    ))}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <Field label="Gross" value={formatINR(enrollTotals!.gross)} />
                  <Field label="Tax" value={formatINR(enrollTotals!.tax)} />
                  <Field label="Discount" value={formatINR(enrollTotals!.discount)} />
                  <Field label="Net Payable" value={formatINR(enrollTotals!.net)} />
                  <Field label="Collected" value={formatINR(collected)} />
                  <Field label="Balance" value={formatINR(Math.max(0, enrollTotals!.net - collected))} />
                  <Field label="Status" value={PAYMENT_STATUSES[enrollment.paymentStatus as keyof typeof PAYMENT_STATUSES] ?? enrollment.paymentStatus} />
                </dl>

                {canEnroll && (
                  <form action={recordPaymentAction} className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
                    <input type="hidden" name="enrollmentId" value={enrollment.id} />
                    <div>
                      <label className="label">Amount (₹)</label>
                      <input name="amount" type="number" min={1} className="input" required />
                    </div>
                    <div>
                      <label className="label">Mode</label>
                      <select name="mode" className="input" defaultValue="CASH">
                        {Object.entries(PAYMENT_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Receipt #</label>
                      <input name="receiptNumber" className="input" />
                    </div>
                    <div className="flex items-end">
                      <button className="btn-primary w-full">Record Payment</button>
                    </div>
                  </form>
                )}

                {enrollment.payments.length > 0 && (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {enrollment.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-1.5">
                        <span className="text-slate-700">{formatINR(p.amount)} · {paymentModeLabel(p.mode)}{p.receiptNumber ? ` · #${p.receiptNumber}` : ""}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-400">
                          {p.recordedBy?.name ?? ""} · {fmtDate(p.paidAt)}
                          <a href={`/receipts/${p.id}`} target="_blank" className="text-brand-600 hover:underline">Receipt</a>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Online payment links (Section 7.10) */}
                {canEnroll && Math.max(0, enrollTotals!.net - collected) > 0 && (
                  <form action={createPaymentLinkAction} className="flex items-end gap-2 rounded-lg border border-dashed border-slate-200 p-3">
                    <input type="hidden" name="enrollmentId" value={enrollment.id} />
                    <div className="flex-1">
                      <label className="label">Request online payment (₹)</label>
                      <input name="amount" type="number" min={1} defaultValue={Math.max(0, enrollTotals!.net - collected)} className="input" />
                    </div>
                    <button className="btn-secondary">Create Link</button>
                  </form>
                )}

                {enrollment.paymentLinks.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {enrollment.paymentLinks.map((pl) => (
                      <li key={pl.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                        <span className="text-slate-700">
                          {formatINR(pl.amount)} ·{" "}
                          {pl.shortUrl ? (
                            <a href={pl.shortUrl} target="_blank" className="text-brand-600 hover:underline">payment link</a>
                          ) : (
                            <span className="text-slate-400">simulated link</span>
                          )}
                          <span className={`badge ml-2 ${pl.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{pl.status}</span>
                        </span>
                        {pl.status === "PENDING" && canEnroll && (
                          <form action={markPaymentLinkPaidAction}>
                            <input type="hidden" name="linkId" value={pl.id} />
                            <input type="hidden" name="leadId" value={lead.id} />
                            <button className="text-xs text-emerald-600 hover:underline">Mark paid</button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Country Applications (Section 4) */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Country Applications</h2>
              {canBackend && (
                <Link href={`/applications/new?leadId=${lead.id}`} className="btn-secondary px-3 py-1.5 text-xs">+ Add Country</Link>
              )}
            </div>
            {lead.applications.length === 0 ? (
              <p className="text-sm text-slate-400">No country applications yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lead.applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.country}{a.institution ? ` · ${a.institution.name}` : ""}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{a.backendCounselor?.name ?? "Unassigned"}</span>
                      <StageBadge stage={a.currentStage} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Documents (Section 7.5) */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Documents ({lead.documents.length})</h2>
            <DocumentChecklist services={services} uploadedTypes={lead.documents.map((d) => d.type)} />
            <DocumentSection
              leadId={lead.id}
              canUpload={can(user.role, CAN_UPLOAD_DOCS)}
              documents={lead.documents.map((d) => ({
                id: d.id, type: d.type, label: d.label, fileName: d.fileName, version: d.version,
                fileSize: d.fileSize, uploadedAt: d.uploadedAt, expiresAt: d.expiresAt, uploadedByName: d.uploadedBy?.name,
              }))}
            />
          </section>

          {/* Communications — WhatsApp / Email / SMS (Section 7.10) */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Send Message</h2>
            <SendMessageForm leadId={lead.id} leadPhone={lead.phone} leadEmail={lead.email} templates={templates} />
            {lead.messageLogs.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-2 text-sm">
                {lead.messageLogs.map((m) => (
                  <li key={m.id} className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600">{channelLabel(m.channel)}</span>
                      <span className={`badge ${MESSAGE_STATUS_COLORS[m.status] ?? "bg-slate-100 text-slate-600"}`}>{m.status}</span>
                      <span className="text-xs text-slate-400">{m.status === "RECEIVED" ? "from" : "to"} {m.toAddress} · {m.sentBy?.name ?? "System"} · {fmtDateTime(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{m.body}</p>
                    {m.error && <p className="text-xs text-rose-500">{m.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Interaction log */}
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Log an Interaction</h2>
            <InteractionForm leadId={lead.id} />
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Interaction History ({lead.interactions.length})
            </h2>
            {lead.interactions.length === 0 ? (
              <p className="text-sm text-slate-400">No interactions logged yet.</p>
            ) : (
              <ul className="space-y-3">
                {lead.interactions.map((i) => (
                  <li key={i.id} className="border-l-2 border-brand-200 pl-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="badge bg-slate-100 text-slate-600">
                        {INTERACTION_TYPES[i.type as keyof typeof INTERACTION_TYPES] ?? i.type}
                      </span>
                      <span className="text-slate-700">{i.user.name}</span>
                      <span className="text-xs text-slate-400">{fmtDateTime(i.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{i.summary}</p>
                    {i.nextAction && (
                      <p className="mt-0.5 text-xs text-slate-500">Next: {i.nextAction}{i.followUpDate ? ` (by ${fmtDate(i.followUpDate)})` : ""}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: status + assignment + history */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h2>
            <div className="mb-3"><StatusBadge status={lead.status} /></div>
            <StatusChanger leadId={lead.id} current={lead.status} />
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Counselors</h2>
            {canAssign ? (
              <AssignForm
                leadId={lead.id}
                directCounselors={directCounselors}
                careerCounselors={careerCounselors}
                currentDirectId={directCounselor?.user.id}
                currentCareerId={careerCounselor?.user.id}
              />
            ) : (
              <div className="space-y-2 text-sm">
                <div><span className="text-slate-400">Direct: </span>{directCounselor?.user.name ?? "Unassigned"}</div>
                <div><span className="text-slate-400">Career: </span>{careerCounselor?.user.name ?? "Unassigned"}</div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Status History</h2>
            {lead.statusHistory.length === 0 ? (
              <p className="text-sm text-slate-400">No status changes yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {lead.statusHistory.map((h) => (
                  <li key={h.id} className="flex flex-col">
                    <span className="text-slate-700">
                      {h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}{statusLabel(h.toStatus)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {h.changedBy?.name ?? "System"} · {fmtDateTime(h.changedAt)}
                    </span>
                    {h.reason && <span className="text-xs text-slate-500">Reason: {h.reason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Duplicate merge (Section 7.2) */}
          {can(user.role, CAN_MERGE_LEAD) && lead.status !== "DUPLICATE" && (
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Merge Duplicate</h2>
              <MergeLeadPanel leadId={lead.id} phone={lead.phone} email={lead.email} fullName={lead.fullName} />
            </section>
          )}

          {/* Privacy / GDPR (Section 7.11) — admins only */}
          {can(user.role, CAN_ADMIN) && (
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Privacy (GDPR)</h2>
              <a href={`/api/leads/${lead.id}/export`} className="btn-secondary mb-3 block text-center text-xs">Export data (JSON)</a>
              {lead.status === "ERASED" ? (
                <p className="text-xs text-slate-400">Personal data has been erased.</p>
              ) : (
                <form action={eraseLeadAction} className="space-y-2">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <p className="text-xs text-slate-500">Right to erasure: anonymizes all personal data and deletes uploaded documents. Type <b>ERASE</b> to confirm.</p>
                  <input name="confirm" className="input" placeholder="ERASE" autoComplete="off" />
                  <button className="w-full rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Erase personal data</button>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// Required-document checklist with completion indicators (Section 7.5). The list
// is the union of required docs for the lead's selected services.
function DocumentChecklist({ services, uploadedTypes }: { services: ServiceTypeKey[]; uploadedTypes: string[] }) {
  const required = requiredDocsForServices(services);
  if (required.length === 0) return null;
  const have = new Set(uploadedTypes);
  const done = required.filter((t) => have.has(t)).length;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required Documents</span>
        <span className={`badge ${done === required.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {done}/{required.length} complete
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {required.map((t) => {
          const ok = have.has(t);
          return (
            <li key={t} className="flex items-center gap-2 text-sm">
              <span className={ok ? "text-emerald-600" : "text-slate-300"}>{ok ? "✓" : "○"}</span>
              <span className={ok ? "text-slate-700" : "text-slate-400"}>{documentTypeLabel(t)}</span>
            </li>
          );
        })}
      </ul>
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
