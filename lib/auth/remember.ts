/**
 * Client-side "Keep me signed in" preference.
 *
 * Setting the cookie right before `signIn(...)` lets the server-side
 * `jwt` callback read the choice on first token issuance and set
 * `token.exp` accordingly. The cookie itself is short-lived (10 min) —
 * it only needs to survive the OAuth round-trip.
 */

export const REMEMBER_COOKIE = "ie.remember";

// Authoritative session lengths. Keep in sync with lib/auth.ts — the
// jwt callback reads the same constants.
export const REMEMBER_TTL_LONG_SEC = 30 * 24 * 60 * 60; // 30 days
export const REMEMBER_TTL_SHORT_SEC = 24 * 60 * 60;     // 1 day

/** Sets (or clears) the preference cookie. Safe to call on the server — no-op there. */
export function setRememberPreference(remember: boolean) {
  if (typeof document === "undefined") return;
  // 10-minute cookie: the OAuth redirect round-trip never exceeds this.
  // SameSite=Lax so it survives top-level navigation (Google/GitHub bounce).
  document.cookie = `${REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/; Max-Age=600; SameSite=Lax`;
}

/** Server-side read. */
export function readRememberPreferenceFromCookies(
  cookieString: string | undefined | null
): boolean {
  if (!cookieString) return true; // default: remember (safest UX)
  const match = cookieString
    .split(/;\s*/)
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REMEMBER_COOKIE}=`));
  if (!match) return true;
  const value = match.slice(REMEMBER_COOKIE.length + 1);
  return value !== "0";
}
