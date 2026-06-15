import "server-only";
import { authenticator } from "otplib";
import QRCode from "qrcode";

// TOTP two-factor auth (Section 7.7) using authenticator apps (Google Authenticator,
// Authy, etc.). otplib handles RFC-6238 codes; we allow a ±1 step window for clock skew.
authenticator.options = { window: 1 };

const ISSUER = "theSFedu CRM";

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function otpauthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}

export async function qrDataUrl(otpauth: string): Promise<string> {
  return QRCode.toDataURL(otpauth, { margin: 1, width: 200 });
}
