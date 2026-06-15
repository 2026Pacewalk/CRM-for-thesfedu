"use client";

import { useState } from "react";
import { advanceStageAction } from "@/app/(app)/applications/actions";
import { APPLICATION_STAGES, STAGE_TRANSITIONS, type StageKey } from "@/lib/constants";

type Inst = { id: string; name: string };

export function StageAdvanceForm({
  applicationId,
  currentStage,
  institutions,
}: {
  applicationId: string;
  currentStage: string;
  institutions: Inst[];
}) {
  const allowed = STAGE_TRANSITIONS[currentStage as StageKey] ?? [];
  const [toStage, setToStage] = useState<string>("");

  if (allowed.length === 0) {
    return <p className="text-xs text-slate-400">This application has reached a final stage.</p>;
  }

  return (
    <form action={advanceStageAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div>
        <label className="label">Advance to</label>
        <select name="toStage" className="input" value={toStage} onChange={(e) => setToStage(e.target.value)} required>
          <option value="">Select next stage…</option>
          {allowed.map((s) => (
            <option key={s} value={s}>{APPLICATION_STAGES[s]}</option>
          ))}
        </select>
      </div>

      {/* OL Applied — capture institution / program / intake */}
      {toStage === "ST_2" && (
        <>
          <div>
            <label className="label">Institution</label>
            <select name="institutionId" className="input">
              <option value="">Select institution…</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Program</label>
              <input name="program" className="input" placeholder="e.g. MSc Computer Science" />
            </div>
            <div>
              <label className="label">Intake</label>
              <input name="intake" className="input" placeholder="e.g. Sept 2026" />
            </div>
          </div>
        </>
      )}

      {/* File Lodged — capture lodgment reference + date */}
      {toStage === "ST_5" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lodgment Ref</label>
            <input name="lodgmentRef" className="input" placeholder="Reference number" />
          </div>
          <div>
            <label className="label">Lodgment Date</label>
            <input name="lodgmentDate" type="date" className="input" />
          </div>
        </div>
      )}

      {/* Visa Refused — capture refusal grounds */}
      {toStage === "ST_7" && (
        <div>
          <label className="label">Refusal Reason *</label>
          <textarea name="refusalReason" rows={2} className="input" placeholder="Grounds for refusal…" required />
        </div>
      )}

      <div>
        <label className="label">Note</label>
        <input name="note" className="input" placeholder="Optional note for the timeline" />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={!toStage}>Update Stage</button>
    </form>
  );
}
