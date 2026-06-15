"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { mergeLeadAction, type MergeLeadState } from "@/app/(app)/leads/actions";

type Candidate = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  branch: { name: string };
};

function MergeButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full text-xs" disabled={disabled || pending}>
      {pending ? "Merging…" : "Merge selected into this lead"}
    </button>
  );
}

// Finds potential duplicates of the current lead and lets an authorized user merge
// one into it, keeping this lead as the surviving "original" (Section 7.2).
export function MergeLeadPanel({
  leadId,
  phone,
  email,
  fullName,
}: {
  leadId: string;
  phone: string;
  email: string | null;
  fullName: string;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [state, formAction] = useFormState<MergeLeadState, FormData>(mergeLeadAction, {});

  useEffect(() => {
    const params = new URLSearchParams({ phone, name: fullName, ...(email ? { email } : {}) });
    fetch(`/api/leads/check-duplicate?${params.toString()}`)
      .then((r) => r.json())
      .then((d: { matches: Candidate[] }) => {
        // Exclude the current lead and any already-merged tombstones.
        setCandidates((d.matches ?? []).filter((m) => m.id !== leadId && m.status !== "DUPLICATE"));
      })
      .catch(() => setCandidates([]));
  }, [leadId, phone, email, fullName]);

  if (candidates === null) {
    return <p className="text-sm text-slate-400">Checking for duplicates…</p>;
  }
  if (candidates.length === 0) {
    return <p className="text-sm text-slate-400">No potential duplicates found.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="primaryId" value={leadId} />
      <input type="hidden" name="duplicateId" value={selected} />
      <p className="text-xs text-slate-500">
        Select a duplicate to merge <span className="font-medium">into this lead</span>. Its history, tasks,
        applications and documents move here; the other record is flagged as Duplicate.
      </p>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:bg-slate-50">
              <input
                type="radio"
                name="pick"
                value={c.id}
                checked={selected === c.id}
                onChange={() => setSelected(c.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-slate-700">{c.fullName}</span>
                <span className="block text-xs text-slate-400">
                  {c.phone}{c.email ? ` · ${c.email}` : ""} · {c.branch.name}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <MergeButton disabled={!selected} />
    </form>
  );
}
