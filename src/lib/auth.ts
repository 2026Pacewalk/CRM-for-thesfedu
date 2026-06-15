import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_IDLE_SECONDS, SESSION_COOKIE } from "./session-config";

const COOKIE_NAME = SESSION_COOKIE;
const PENDING_COOKIE = "sfedu_2fa";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-secret-change-me"
);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  vertical: string | null;
  branchId: string | null;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// --- session token ---
async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_IDLE_SECONDS}s`)
    .sign(secret);
}

export async function readToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
      vertical: (payload.vertical as string) ?? null,
      branchId: (payload.branchId as string) ?? null,
    };
  } catch {
    return null;
  }
}

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  vertical: string | null;
  branchId: string | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  passwordHash: string;
};

// Step 1 of login: verify email + password. Returns the user record (incl. 2FA
// flag) on success, or null. Does NOT set any session.
export async function verifyCredentials(email: string, password: string): Promise<UserRecord | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

// Establish a full authenticated session (called after password, and after 2FA if
// enabled).
export async function establishSession(user: {
  id: string; name: string; email: string; role: string; vertical: string | null; branchId: string | null;
}): Promise<void> {
  const sessionUser: SessionUser = {
    id: user.id, name: user.name, email: user.email, role: user.role,
    vertical: user.vertical, branchId: user.branchId,
  };
  const token = await createToken(sessionUser);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_IDLE_SECONDS,
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id },
  });
}

// --- pending 2FA (between password step and code step) ---
export async function setPending2FA(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId, pending: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
  cookies().set(PENDING_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300,
  });
}

export async function getPending2FAUserId(): Promise<string | null> {
  const token = cookies().get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.pending ? (payload.uid as string) : null;
  } catch {
    return null;
  }
}

export function clearPending2FA() {
  cookies().delete(PENDING_COOKIE);
}

export function logout() {
  cookies().delete(COOKIE_NAME);
}

// Returns the current session user (or null). Use in Server Components / actions.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readToken(token);
}

export { COOKIE_NAME };
