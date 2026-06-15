"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { createAssessmentAction, type CreateAssessmentState } from "../actions";
import { ELIGIBILITY_OUTCOMES, COUNTRIES } from "@/lib/constants";

const initialState: CreateAssessmentState = {};

export function NewAssessmentForm({ partners }: { partners: { id: string; companyName: string }[] }) {
  const [state, formAction] = useFormState(createAssessmentAction, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {state.error && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>
      )}

      <div>
        <label className="label">Student Name *</label>
        <input name="studentName" className="input" required />
        {state.fieldErrors?.studentName && (
          <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.studentName}</p>
        )}
      </div>

      <div>
        <label className="label">Partner *</label>
        <select name="partnerId" className="input" defaultValue="" required>
          <option value="" disabled>Select a partner</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.companyName}</option>
          ))}
        </select>
        {state.fieldErrors?.partnerId && (
          <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.partnerId}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Country</label>
          <select name="country" className="input" defaultValue="">
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Program</label>
          <input name="program" className="input" />
        </div>
        <div>
          <label className="label">Eligibility Outcome *</label>
          <select name="eligibilityOutcome" className="input" defaultValue="" required>
            <option value="" disabled>Select an outcome</option>
            {Object.entries(ELIGIBILITY_OUTCOMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {state.fieldErrors?.eligibilityOutcome && (
            <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.eligibilityOutcome}</p>
          )}
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea name="notes" rows={4} className="input" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">Create Assessment</button>
        <Link href="/assessments" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
