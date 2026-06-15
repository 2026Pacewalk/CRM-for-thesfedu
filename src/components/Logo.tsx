/* eslint-disable @next/next/no-img-element */
// Official Silver Fern Education Consultants logo assets (from thesfedu.com),
// stored under /public. LogoMark = circular badge; LogoLockup = full horizontal
// logo. Plain <img> so it works in both server and client components.

type Props = { className?: string; withText?: boolean };

// Circular fern badge — for compact spots (sidebar, document headers).
export function LogoMark({ className }: Props) {
  return (
    <img
      src="/logo-badge.png"
      alt="Silver Fern Education Consultants"
      className={"object-contain " + (className ?? "")}
    />
  );
}

// Full horizontal logo lockup — for the sign-in page and letterheads.
export function LogoLockup({ className }: Props) {
  return (
    <img
      src="/logo.png"
      alt="Silver Fern Education Consultants"
      className={"h-16 w-auto max-w-full object-contain " + (className ?? "")}
    />
  );
}
