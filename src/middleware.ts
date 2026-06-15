import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { SESSION_IDLE_SECONDS, SESSION_COOKIE } from "@/lib/session-config";

const COOKIE_NAME = SESSION_COOKIE;
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-secret-change-me"
);

// Re-issue the session cookie with a fresh expiry so the idle window slides while
// the user is active (Section 7.7). Throttled: only re-signs if >60s since issue,
// to avoid a Set-Cookie on every burst request.
async function slideSession(res: NextResponse, payload: JWTPayload): Promise<void> {
  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  if (Date.now() / 1000 - iat < 60) return;
  const fresh = await new SignJWT({
    id: payload.id, name: payload.name, email: payload.email,
    role: payload.role, vertical: payload.vertical ?? null, branchId: payload.branchId ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_IDLE_SECONDS}s`)
    .sign(secret);
  res.cookies.set(COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_IDLE_SECONDS,
  });
}

// Routes that do not require authentication. /login/2fa is reachable mid-login.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/payments/razorpay/webhook",
  "/api/integrations/whatsapp/webhook", // guarded by verify token + optional signature
  "/api/integrations/leadforms/webhook", // guarded by verify token + optional signature
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
  let payload: JWTPayload | null = null;
  if (token) {
    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
      authed = true;
    } catch {
      // Token missing/expired/invalid → treated as logged out. An expired token
      // means the idle window lapsed, so the user is sent to login below.
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

  const res = NextResponse.next();
  if (authed && payload) await slideSession(res, payload);
  return res;
}

export const config = {
  // Protect everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
