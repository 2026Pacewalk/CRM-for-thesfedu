"use client";

import { useState } from "react";
import { updateLeadStatusAction } from "@/app/(app)/leads/actions";
import {
  LEAD_STATUSES,
  STATUS_TRANSITIONS,
  STATUS_REQUIRES_REASON,
  type LeadStatusKey,
} from "@/lib/constants";

export function StatusChanger({ leadId, current }: { leadId: string; current: string }) {
  const allowed = STATUS_TRANSITIONS[current as LeadStatusKey] ?? [];
  const [target, setTarget] = useState<string>("");
  const needsReason = !!target && STATUS_REQUIRES_REASON.includes(target as LeadStatusKey);

  if (allowed.length === 0) {
    return <p className="text-xs text-slate-400">This is a terminal status — no further transitions.</p>;
  }

  return (
    <form action={updateLeadStatusAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div>
        <label className="label">Change status to</label>
        <select name="toStatus" className="input" value={target} onChange={(e) => setTarget(e.target.value)} required>
          <option value="">Select…</option>
          {allowed.map((s) => (
            <option key={s} value={s}>{LEAD_STATUSES[s]}</option>
          ))}
        </select>
      </div>
      {needsReason && (
        <div>
          <label className="label">Reason *</label>
          <textarea name="reason" rows={2} className="input" placeholder="Required reason…" required />
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={!target}>
        Update Status
      </button>
    </form>
  );
}
