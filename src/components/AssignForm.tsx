"use client";

import { assignCounselorsAction } from "@/app/(app)/leads/actions";

type Opt = { id: string; name: string };

export function AssignForm({
  leadId,
  directCounselors,
  careerCounselors,
  currentDirectId,
  currentCareerId,
}: {
  leadId: string;
  directCounselors: Opt[];
  careerCounselors: Opt[];
  currentDirectId?: string;
  currentCareerId?: string;
}) {
  return (
    <form action={assignCounselorsAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div>
        <label className="label">Direct Counselor</label>
        <select name="directCounselorId" className="input" defaultValue={currentDirectId ?? ""}>
          <option value="">Unassigned</option>
          {directCounselors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Career Desk Counselor</label>
        <select name="careerCounselorId" className="input" defaultValue={currentCareerId ?? ""}>
          <option value="">Unassigned</option>
          {careerCounselors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-secondary w-full">Save Assignment</button>
    </form>
  );
}
