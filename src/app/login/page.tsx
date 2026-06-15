"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import { LogoLockup } from "@/components/Logo";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoLockup className="mb-4" />
          <h1 className="text-lg font-semibold text-slate-900">CRM Sign in</h1>
          <p className="text-sm text-slate-500">Immigration &amp; Education Consultancy</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" className="input" placeholder="you@thesfedu.com" required />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" className="input" placeholder="••••••••" required />
          </div>

          {state.error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
          )}

          <SubmitButton />
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-medium text-slate-600">Demo accounts (password: Password123!)</p>
          <p className="mt-1">admin@thesfedu.com · reception@thesfedu.com · counselor.direct@thesfedu.com · vp@thesfedu.com</p>
        </div>
      </div>
    </div>
  );
}
