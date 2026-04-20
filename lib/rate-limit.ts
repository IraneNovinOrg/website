import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * In-memory rate limiter.
 *
 * Kept intentionally simple — a Map of `key -> { count, resetTime }` with a
 * fixed-window policy. A background sweep drops expired entries every 5
 * minutes so long-lived processes don't grow the map without bound.
 *
 * This module is imported from API routes that need abuse-resistance on
 * write endpoints (see `limitOrRespond` below). The two exported pieces are:
 *   - `rateLimit(key, limit, windowMs)` — core limiter; returns `{ success,
 *     remaining, retryAfter }` (existing callers only consumed `success` +
 *     `remaining`, so adding `retryAfter` is backward compatible).
 *   - `limitOrRespond(request, userId, { max, windowMs, bucket })` — helper
 *     that derives an `ip+userId` key, calls `rateLimit`, and returns either
 *     a ready-to-return 429 `NextResponse` or `null` when the request is
 *     allowed to proceed.
 */
const rateMap = new Map<string, { count: number; resetTime: number }>();

// Periodic sweep: once every 5 minutes, drop entries whose window has already
// expired. Guarded so we only schedule one interval per process, and unref'd
// so it doesn't keep the Node event loop alive during graceful shutdown.
declare global {
  // eslint-disable-next-line no-var
  var __rateLimitSweep: NodeJS.Timeout | undefined;
}

if (!globalThis.__rateLimitSweep && typeof setInterval === "function") {
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateMap.entries()) {
      if (entry.resetTime <= now) rateMap.delete(key);
    }
  }, 5 * 60 * 1000);
  if (typeof sweep.unref === "function") sweep.unref();
  globalThis.__rateLimitSweep = sweep;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Seconds until the window resets. 0 when the request was allowed. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number = 3,
  windowMs: number = 60 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)),
    };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, retryAfter: 0 };
}

/**
 * Wrapper for API routes: returns a 429 `NextResponse` if the caller is over
 * the limit, otherwise `null` (so the route handler can continue).
 *
 * Keying: `<bucket>:<ip>:<userId | "anon">`. IP is taken from
 * `x-forwarded-for` (first hop) or `x-real-ip`, falling back to `"anon"`.
 */
export function limitOrRespond(
  request: NextRequest,
  userId: string | null,
  limits: { max: number; windowMs: number; bucket: string }
): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anon";
  const key = `${limits.bucket}:${ip}:${userId ?? "anon"}`;
  const r = rateLimit(key, limits.max, limits.windowMs);
  if (!r.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: r.retryAfter, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(r.retryAfter) } }
    );
  }
  return null;
}
