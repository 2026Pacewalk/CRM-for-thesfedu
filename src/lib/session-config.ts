// Inactivity-based session timeout (Section 7.7). The session is a sliding window:
// every authenticated request re-issues the cookie with a fresh expiry, so the
// session stays alive while the user is active and logs out after this many idle
// minutes. Configurable via SESSION_IDLE_MINUTES (default 30).
//
// Kept free of `server-only`/prisma imports so it is safe to use from middleware
// (edge runtime) as well as server actions.
export const SESSION_IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES ?? "30") || 30;
export const SESSION_IDLE_SECONDS = SESSION_IDLE_MINUTES * 60;

// Cookie name for the session JWT (shared by auth + middleware).
export const SESSION_COOKIE = "sfedu_session";
