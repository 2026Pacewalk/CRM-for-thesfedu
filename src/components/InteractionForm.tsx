"use client";

import { useRef } from "react";
import { addInteractionAction } from "@/app/(app)/leads/actions";
import { INTERACTION_TYPES } from "@/lib/constants";

export function InteractionForm({ leadId }: { leadId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await addInteractionAction(fd);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Type</label>
          <select name="type" className="input" defaultValue="CALL">
            {Object.entries(INTERACTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Follow-up date</label>
          <input name="followUpDate" type="date" className="input" />
        </div>
      </div>
      <div>
        <label className="label">Summary *</label>
        <textarea name="summary" rows={2} className="input" placeholder="What was discussed…" required />
      </div>
      <div>
        <label className="label">Next action</label>
        <input name="nextAction" className="input" placeholder="e.g. Send document checklist" />
      </div>
      <button type="submit" className="btn-primary">Log Interaction</button>
    </form>
  );
}
