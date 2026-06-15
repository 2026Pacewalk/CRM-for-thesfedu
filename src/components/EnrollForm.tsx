"use client";

import { useState } from "react";
import { enrollLeadAction } from "@/app/(app)/enrollments/actions";
import { serviceLabel } from "@/lib/constants";
import { formatINR } from "@/lib/money";

type Pkg = { id: string; name: string; serviceCategory: string; basePrice: number; taxRate: number };

export function EnrollForm({ leadId, packages }: { leadId: string; packages: Pkg[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [discount, setDiscount] = useState(0);

  const chosen = packages.filter((p) => selected[p.id]);
  const gross = chosen.reduce((s, p) => s + p.basePrice, 0);
  const tax = chosen.reduce((s, p) => s + p.basePrice * (p.taxRate / 100), 0);
  const net = Math.max(0, gross + tax - (discount || 0));

  return (
    <form action={enrollLeadAction} className="space-y-5">
      <input type="hidden" name="leadId" value={leadId} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Select Packages *</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active service packages configured. Ask an admin to add them under Admin → Service Packages.
          </p>
        ) : (
          <div className="space-y-2">
            {packages.map((p) => (
              <label
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="packageIds"
                    value={p.id}
                    className="rounded border-slate-300"
                    checked={!!selected[p.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))}
                  />
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="badge bg-slate-100 text-slate-500">{serviceLabel(p.serviceCategory)}</span>
                </span>
                <span className="text-slate-600">
                  {formatINR(p.basePrice)} {p.taxRate > 0 && <span className="text-xs text-slate-400">+{p.taxRate}% tax</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Discount & Notes</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Discount (₹)</label>
            <input
              name="discount"
              type="number"
              min={0}
              className="input"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea name="notes" rows={2} className="input" placeholder="Enrollment notes…" />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h2>
        <dl className="space-y-1 text-sm">
          <Row label="Gross" value={formatINR(gross)} />
          <Row label="Tax" value={formatINR(tax)} />
          <Row label="Discount" value={`- ${formatINR(discount)}`} />
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Net Payable</span>
            <span>{formatINR(net)}</span>
          </div>
        </dl>
      </section>

      <div className="flex justify-end gap-3">
        <a href={`/leads/${leadId}`} className="btn-secondary">Cancel</a>
        <button type="submit" className="btn-primary" disabled={chosen.length === 0}>
          Enroll Student
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
