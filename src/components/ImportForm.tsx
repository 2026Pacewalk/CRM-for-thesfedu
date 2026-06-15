"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { importLeadsAction, type ImportState } from "@/app/(app)/leads/import/actions";

const SAMPLE = `fullName,phone,email,source,vertical,services,branchCode,notes
Amrit Singh,+91 98111 22333,amrit@example.com,WALK_IN,B2C_DIRECT,STUDY_VISA;IELTS_PREP,CHD,Sept intake
Priya Sharma,+91 99222 33444,,SOCIAL_MEDIA,BOTH,CAREER_COUNSELLING;PSYCHOMETRIC,CHD,`;

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Importing…" : "Import Leads"}</button>;
}

export function ImportForm() {
  const [state, formAction] = useFormState<ImportState, FormData>(importLeadsAction, {});

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Format</h2>
        <p className="mb-2 text-xs text-slate-500">
          Columns: <code>fullName, phone, email, source, vertical, services, branchCode, notes</code>.
          Only <b>fullName</b> and <b>phone</b> are required. <code>services</code> is semicolon-separated
          (e.g. <code>STUDY_VISA;IELTS_PREP</code>). <code>source</code>/<code>vertical</code>/<code>services</code> use the
          system keys.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">{SAMPLE}</pre>
      </section>

      <form action={formAction} className="card space-y-3 p-5">
        <label className="label">Paste CSV</label>
        <textarea name="csv" rows={10} className="input font-mono text-xs" defaultValue={SAMPLE} />
        {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
        <div className="flex justify-end gap-3">
          <Link href="/leads" className="btn-secondary">Back to Leads</Link>
          <SubmitButton />
        </div>
      </form>

      {state.done && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Import Summary</h2>
          <div className="mb-3 flex gap-4 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">Imported: {state.imported}</span>
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">Skipped (duplicates): {state.skipped}</span>
            <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-rose-700">Failed: {state.failed?.length ?? 0}</span>
          </div>
          {state.failed && state.failed.length > 0 && (
            <ul className="space-y-1 text-xs text-rose-600">
              {state.failed.map((f) => <li key={f.row}>Row {f.row}: {f.reason}</li>)}
            </ul>
          )}
          <Link href="/leads" className="btn-primary mt-3 inline-flex">View Leads</Link>
        </section>
      )}
    </div>
  );
}
