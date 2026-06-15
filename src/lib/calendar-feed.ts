import "server-only";
import crypto from "node:crypto";

// Stateless, unguessable token for a user's personal calendar feed (Section 7.10).
// Calendar apps (Google/Outlook) fetch the .ics URL unauthenticated, so the token
// itself authorizes: token = base64url(userId).HMAC-SHA256(userId). No DB column
// needed — derived from AUTH_SECRET, and revocable by rotating that secret.
const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(userId: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(userId).digest());
}

export function makeFeedToken(userId: string): string {
  return `${b64url(Buffer.from(userId))}.${sign(userId)}`;
}

export function verifyFeedToken(token: string): string | null {
  const [idPart, sig] = token.split(".");
  if (!idPart || !sig) return null;
  let userId: string;
  try {
    userId = Buffer.from(idPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(userId);
  // Constant-time compare.
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

// --- iCalendar (RFC 5545) generation ---
type CalEvent = { uid: string; date: Date; summary: string; description?: string };

function fmtDateOnly(d: Date): string {
  // All-day event date in YYYYMMDD (floating, local-day).
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// `stamp` is passed in (not read from the clock here) so callers control DTSTAMP.
export function buildICalendar(name: string, events: CalEvent[], stamp: Date): string {
  const dtstamp =
    `${stamp.getUTCFullYear()}${String(stamp.getUTCMonth() + 1).padStart(2, "0")}${String(stamp.getUTCDate()).padStart(2, "0")}` +
    `T${String(stamp.getUTCHours()).padStart(2, "0")}${String(stamp.getUTCMinutes()).padStart(2, "0")}${String(stamp.getUTCSeconds()).padStart(2, "0")}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//theSFedu CRM//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const e of events) {
    const day = fmtDateOnly(e.date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // RFC 5545 requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}
