"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadDocumentAction, deleteDocumentAction, type UploadState } from "@/app/(app)/documents/actions";
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  ALLOWED_UPLOAD_EXTENSIONS,
  expiryTier,
  EXPIRY_TIER_LABELS,
  EXPIRY_TIER_COLORS,
} from "@/lib/constants";

export type DocItem = {
  id: string;
  type: string;
  label: string | null;
  fileName: string;
  version: number;
  fileSize: number;
  uploadedAt: string | Date;
  expiresAt?: string | Date | null;
  uploadedByName?: string | null;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function UploadButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>;
}

export function DocumentSection({
  leadId,
  applicationId,
  documents,
  canUpload,
}: {
  leadId?: string;
  applicationId?: string;
  documents: DocItem[];
  canUpload: boolean;
}) {
  const [state, formAction] = useFormState<UploadState, FormData>(uploadDocumentAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-4">
      {canUpload && (
        <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {leadId && <input type="hidden" name="leadId" value={leadId} />}
          {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
          <div>
            <label className="label">Document type</label>
            <select name="type" className="input" defaultValue="">
              <option value="">Select…</option>
              {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Label (optional)</label>
            <input name="label" className="input" placeholder="e.g. Sept intake transcript" />
          </div>
          <div>
            <label className="label">Expiry date <span className="text-xs text-slate-400">(optional — passports, test scores)</span></label>
            <input name="expiresAt" type="date" className="input" />
          </div>
          <div>
            <label className="label">File <span className="text-xs text-slate-400">({ALLOWED_UPLOAD_EXTENSIONS.join(", ")}, max 20 MB)</span></label>
            <input name="file" type="file" className="input" accept={ALLOWED_UPLOAD_EXTENSIONS.map((e) => "." + e).join(",")} />
          </div>
          {state.error && <p className="text-xs text-rose-600 sm:col-span-2">{state.error}</p>}
          <div className="sm:col-span-2"><UploadButton /></div>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">No documents uploaded yet.</p>
      ) : (
        <>
          {leadId && (
            <div className="flex justify-end">
              <a href={`/api/documents/bulk?leadId=${leadId}`} className="btn-secondary px-3 py-1.5 text-xs">
                ⬇ Download all (ZIP)
              </a>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => {
              const tier = expiryTier(d.expiresAt ?? null);
              return (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <a href={`/api/documents/${d.id}`} target="_blank" className="font-medium text-brand-700 hover:underline">
                      {d.fileName}
                    </a>
                    {d.expiresAt && tier !== "OK" && (
                      <span className={`badge ml-2 ${EXPIRY_TIER_COLORS[tier]}`}>{EXPIRY_TIER_LABELS[tier]}</span>
                    )}
                    <div className="text-[11px] text-slate-400">
                      {documentTypeLabel(d.type)}{d.label ? ` · ${d.label}` : ""} · v{d.version} · {fmtSize(d.fileSize)} · {fmtDate(d.uploadedAt)}
                      {d.uploadedByName ? ` · ${d.uploadedByName}` : ""}
                      {d.expiresAt ? ` · expires ${fmtDate(d.expiresAt)}` : ""}
                    </div>
                  </div>
                  {canUpload && (
                    <form action={deleteDocumentAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-xs text-rose-500 hover:underline">Delete</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
