"use client";

import { useFormState, useFormStatus } from "react-dom";
import { verify2FAAction, type TwoFAState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? "Verifying…" : "Verify"}</button>;
}

export default function TwoFAPage() {
  const [state, formAction] = useFormState<TwoFAState, FormData>(verify2FAAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold text-slate-900">Two-factor authentication</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Enter the 6-digit code from your authenticator app.</p>
        <form action={formAction} className="space-y-4">
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="input text-center text-lg tracking-[0.5em]"
            placeholder="000000"
            autoFocus
            required
          />
          {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
          <SubmitButton />
        </form>
        <a href="/login" className="mt-4 block text-center text-xs text-slate-400 hover:text-slate-600">Back to login</a>
      </div>
    </div>
  );
}
