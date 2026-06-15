"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createLeadAction, type CreateLeadState } from "@/app/(app)/leads/actions";
import {
  LEAD_SOURCES,
  SERVICE_TYPES,
  VERTICALS,
  SOCIAL_PLATFORMS,
  statusLabel,
} from "@/lib/constants";

type Opt = { id: string; name: string };
type DupMatch = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  branch: { name: string } | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save Lead"}
    </button>
  );
}

export function NewLeadForm({
  branches,
  directCounselors,
  careerCounselors,
  partners,
  defaultBranchId,
}: {
  branches: Opt[];
  directCounselors: Opt[];
  careerCounselors: Opt[];
  partners: { id: string; companyName: string }[];
  defaultBranchId: string;
}) {
  const [state, formAction] = useFormState<CreateLeadState, FormData>(createLeadAction, {});
  const fe = state.fieldErrors ?? {};

  const [source, setSource] = useState("");
  const [vertical, setVertical] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dups, setDups] = useState<DupMatch[]>([]);

  const isB2B = vertical === "B2B";
  const showSocialPlatform = source === "SOCIAL_MEDIA";

  // Live duplicate detection (Section 7.2) — debounced.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (phone.replace(/\D/g, "").length < 5 && email.length < 4 && name.length < 3) {
        setDups([]);
        return;
      }
      try {
        const params = new URLSearchParams({ phone, email, name });
        const res = await fetch(`/api/leads/check-duplicate?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setDups(data.matches ?? []);
        }
      } catch {
        /* ignore network errors in dedup check */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phone, email, name]);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      {/* Duplicate warning */}
      {dups.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">⚠ Possible duplicate{dups.length > 1 ? "s" : ""} found:</p>
          <ul className="mt-1 space-y-1">
            {dups.map((d) => (
              <li key={d.id} className="text-amber-700">
                <a href={`/leads/${d.id}`} target="_blank" className="underline">
                  {d.fullName}
                </a>{" "}
                · {d.phone}
                {d.email ? ` · ${d.email}` : ""} · {statusLabel(d.status)}
                {d.branch ? ` · ${d.branch.name}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-600">You can still save if this is a different person.</p>
        </div>
      )}

      {/* Contact details */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Contact Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full Name *</label>
            <input name="fullName" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            {fe.fullName && <p className="mt-1 text-xs text-rose-600">{fe.fullName}</p>}
          </div>
          <div>
            <label className="label">Phone Number *</label>
            <input name="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            {fe.phone && <p className="mt-1 text-xs text-rose-600">{fe.phone}</p>}
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="isWhatsapp" className="rounded border-slate-300" />
              Available on WhatsApp
            </label>
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            {fe.email && <p className="mt-1 text-xs text-rose-600">{fe.email}</p>}
          </div>
          <div>
            <label className="label">Date of Birth</label>
            <input name="dateOfBirth" type="date" className="input" />
          </div>
        </div>
      </section>

      {/* Lead source & routing */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Source & Routing</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Lead Source *</label>
            <select name="source" className="input" value={source} onChange={(e) => setSource(e.target.value)} required>
              <option value="">Select source…</option>
              {Object.entries(LEAD_SOURCES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {fe.source && <p className="mt-1 text-xs text-rose-600">{fe.source}</p>}
          </div>
          <div>
            <label className="label">{showSocialPlatform ? "Platform" : "Source Sub-type"}</label>
            {showSocialPlatform ? (
              <select name="sourceSubType" className="input">
                <option value="">Select platform…</option>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input name="sourceSubType" className="input" placeholder="Optional detail" />
            )}
          </div>
          <div>
            <label className="label">Vertical *</label>
            <select name="vertical" className="input" value={vertical} onChange={(e) => setVertical(e.target.value)} required>
              <option value="">Select vertical…</option>
              {Object.entries(VERTICALS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {fe.vertical && <p className="mt-1 text-xs text-rose-600">{fe.vertical}</p>}
          </div>
          <div>
            <label className="label">Branch *</label>
            <select name="branchId" className="input" defaultValue={defaultBranchId} required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          {isB2B && (
            <div className="sm:col-span-2">
              <label className="label">B2B Partner</label>
              <select name="partnerId" className="input">
                <option value="">Select partner…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.companyName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Services Required *</h2>
        <p className="mb-3 text-xs text-slate-400">Select one or more.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SERVICE_TYPES).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <input type="checkbox" name="services" value={k} className="rounded border-slate-300" />
              {v}
            </label>
          ))}
        </div>
        {fe.services && <p className="mt-2 text-xs text-rose-600">{fe.services}</p>}
      </section>

      {/* Assignment & notes */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Assignment & Notes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Direct Counselor</label>
            <select name="directCounselorId" className="input">
              <option value="">Unassigned</option>
              {directCounselors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Career Desk Counselor</label>
            <select name="careerCounselorId" className="input">
              <option value="">Unassigned</option>
              {careerCounselors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes / Remarks</label>
            <textarea name="notes" rows={3} className="input" placeholder="Initial inquiry notes…" />
          </div>
          <div>
            <label className="label">Follow-up Date</label>
            <input name="followUpDate" type="date" className="input" />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <a href="/leads" className="btn-secondary">Cancel</a>
        <SubmitButton />
      </div>
    </form>
  );
}
