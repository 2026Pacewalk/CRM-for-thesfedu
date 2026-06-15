"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { createPartnerAction, type CreatePartnerState } from "../actions";
import { PARTNER_TYPES } from "@/lib/constants";

const initialState: CreatePartnerState = {};

export function NewPartnerForm({ bdms }: { bdms: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createPartnerAction, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {state.error && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>
      )}

      <div>
        <label className="label">Company Name *</label>
        <input name="companyName" className="input" required />
        {state.fieldErrors?.companyName && (
          <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.companyName}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Contact Name</label>
          <input name="contactName" className="input" />
        </div>
        <div>
          <label className="label">Contact Phone</label>
          <input name="contactPhone" className="input" />
        </div>
        <div>
          <label className="label">Contact Email</label>
          <input name="contactEmail" type="email" className="input" />
          {state.fieldErrors?.contactEmail && (
            <p className="mt-1 text-xs text-rose-600">{state.fieldErrors.contactEmail}</p>
          )}
        </div>
        <div>
          <label className="label">Partner Type</label>
          <select name="partnerType" className="input" defaultValue="">
            <option value="">—</option>
            {PARTNER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Assigned BDM</label>
          <select name="assignedBdmId" className="input" defaultValue="">
            <option value="">—</option>
            {bdms.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Commission Rate (%)</label>
          <input name="commissionRate" type="number" step="0.01" min="0" className="input" />
        </div>
        <div>
          <label className="label">Agreement Date</label>
          <input name="agreementDate" type="date" className="input" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">Create Partner</button>
        <Link href="/partners" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
