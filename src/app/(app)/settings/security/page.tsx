import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { changePasswordAction, start2FAAction, disable2FAAction } from "./actions";

export default async function SecuritySettingsPage({ searchParams }: { searchParams: { pw?: string } }) {
  const sessionUser = (await getCurrentUser())!;
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { twoFactorEnabled: true, role: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Security Settings</h1>
      <p className="mb-5 text-sm text-slate-500">{roleLabel(sessionUser.role)} · {sessionUser.email}</p>

      {searchParams.pw && (
        <p className="mb-5 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">{searchParams.pw}</p>
      )}

      {/* Two-factor */}
      <section className="card mb-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Two-Factor Authentication</h2>
            <p className="mt-1 text-sm text-slate-500">
              {user?.twoFactorEnabled
                ? "Enabled — you'll be asked for a code from your authenticator app at login."
                : "Add a second login step using an authenticator app (recommended for management roles)."}
            </p>
          </div>
          <span className={`badge ${user?.twoFactorEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {user?.twoFactorEnabled ? "On" : "Off"}
          </span>
        </div>

        {user?.twoFactorEnabled ? (
          <form action={disable2FAAction} className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Confirm password to disable</label>
              <input name="password" type="password" className="input" required />
            </div>
            <button className="btn-danger">Disable 2FA</button>
          </form>
        ) : (
          <form action={start2FAAction} className="mt-4">
            <button className="btn-primary">Set up 2FA</button>
          </form>
        )}
      </section>

      {/* Change password */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Change Password</h2>
        <form action={changePasswordAction} className="space-y-3">
          <div>
            <label className="label">Current password</label>
            <input name="current" type="password" className="input" required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">New password</label>
              <input name="next" type="password" className="input" required minLength={PASSWORD_MIN_LENGTH} />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input name="confirm" type="password" className="input" required minLength={PASSWORD_MIN_LENGTH} />
            </div>
          </div>
          <p className="text-xs text-slate-400">At least {PASSWORD_MIN_LENGTH} characters, with a letter and a number.</p>
          <button className="btn-primary">Update Password</button>
        </form>
      </section>
    </div>
  );
}
