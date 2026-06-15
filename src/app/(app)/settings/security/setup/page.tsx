import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { otpauthUri, qrDataUrl } from "@/lib/twofactor";
import { confirm2FAAction } from "../actions";

export default async function TwoFASetupPage({ searchParams }: { searchParams: { err?: string } }) {
  const sessionUser = (await getCurrentUser())!;
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { email: true, twoFactorEnabled: true, twoFactorSecret: true },
  });

  if (!user || user.twoFactorEnabled || !user.twoFactorSecret) redirect("/settings/security");

  const otpauth = otpauthUri(user.email, user.twoFactorSecret);
  const qr = await qrDataUrl(otpauth);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/settings/security" className="text-sm text-slate-500 hover:text-slate-700">← Security</Link>
        <h1 className="text-xl font-semibold text-slate-900">Set up 2FA</h1>
      </div>

      <section className="card p-5">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open your authenticator app (Google Authenticator, Authy, etc.).</li>
          <li>Scan this QR code, or enter the key manually.</li>
          <li>Enter the 6-digit code below to confirm.</li>
        </ol>

        <div className="mb-4 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="2FA QR code" width={200} height={200} className="rounded-lg border border-slate-200" />
          <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{user.twoFactorSecret}</code>
        </div>

        {searchParams.err && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{searchParams.err}</p>
        )}

        <form action={confirm2FAAction} className="space-y-3">
          <input
            name="code"
            inputMode="numeric"
            maxLength={6}
            className="input text-center text-lg tracking-[0.5em]"
            placeholder="000000"
            required
          />
          <button className="btn-primary w-full">Confirm & Enable</button>
        </form>
      </section>
    </div>
  );
}
