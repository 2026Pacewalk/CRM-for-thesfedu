import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "sfedu_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-secret-change-me"
);

// Routes that do not require authentication. /login/2fa is reachable mid-login.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/payments/razorpay/webhook",
  "/api/cron/digests", // guarded by CRON_SECRET in the route itself
];

// Optional IP allowlist for the admin area (Section 7.11). Comma-separated list in
// MANAGEMENT_IP_WHITELIST; when unset, no restriction is applied.
function adminIpAllowed(req: NextRequest): boolean {
  const list = (process.env.MANAGEMENT_IP_WHITELIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || (req as unknown as { ip?: string }).ip || "";
  return list.includes(ip);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && !adminIpAllowed(req)) {
    return new NextResponse("Forbidden (IP not allowed for admin area)", { status: 403 });
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let authed = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      authed = true;
    } catch {
      authed = false;
    }
  }

  // Logged-in user hitting /login → send to dashboard.
  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Unauthenticated user hitting a protected route → send to login.
  if (!authed && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
