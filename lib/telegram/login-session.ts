/**
 * Telegram deep-link sign-in sessions.
 *
 * This is the "tap a link or scan a QR, the bot confirms" alternative to the
 * Login Widget. Unlike the widget it never prompts for a phone number — the
 * user is already authenticated to Telegram inside the app.
 *
 * State machine:
 *   pending  → confirmed  → consumed
 *   (TTL 10 min; expired sessions are rejected on read.)
 */

import crypto from "crypto";
import { getDb } from "../db/index";

const TOKEN_BYTES = 24; // 192 bits → url-safe base64 = 32 chars
const TTL_MS = 10 * 60 * 1000;

export type LoginSessionStatus = "pending" | "confirmed" | "consumed" | "expired";

export interface LoginSession {
  token: string;
  status: LoginSessionStatus;
  tgChatId: string | null;
  tgUsername: string | null;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgPhotoUrl: string | null;
  createdAt: string;
  confirmedAt: string | null;
  consumedAt: string | null;
  expiresAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function rowToSession(row: Row): LoginSession {
  return {
    token: row.token,
    status: row.status,
    tgChatId: row.tg_chat_id || null,
    tgUsername: row.tg_username || null,
    tgFirstName: row.tg_first_name || null,
    tgLastName: row.tg_last_name || null,
    tgPhotoUrl: row.tg_photo_url || null,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at || null,
    consumedAt: row.consumed_at || null,
    expiresAt: row.expires_at,
  };
}

/** Create a fresh pending session. Caller displays the token as a QR + link. */
export function createLoginSession(): LoginSession {
  const token = crypto
    .randomBytes(TOKEN_BYTES)
    .toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  getDb()
    .prepare(
      `INSERT INTO telegram_login_sessions (token, status, expires_at)
       VALUES (?, 'pending', ?)`
    )
    .run(token, expiresAt);

  const row = getDb()
    .prepare("SELECT * FROM telegram_login_sessions WHERE token = ?")
    .get(token);
  return rowToSession(row);
}

/** Read current status; auto-marks expired pending rows. */
export function getLoginSession(token: string): LoginSession | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM telegram_login_sessions WHERE token = ?")
    .get(token) as Row;
  if (!row) return null;

  const nowMs = Date.now();
  const expMs = new Date(row.expires_at).getTime();
  if (row.status === "pending" && expMs < nowMs) {
    db.prepare(
      "UPDATE telegram_login_sessions SET status = 'consumed' WHERE token = ? AND status = 'pending'"
    ).run(token);
    return { ...rowToSession(row), status: "expired" };
  }

  return rowToSession(row);
}

/** Called from the bot when the user taps "Yes, sign me in". */
export function confirmLoginSession(
  token: string,
  tg: {
    chatId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
  }
): { ok: boolean; reason?: "not_found" | "expired" | "already_confirmed" } {
  const db = getDb();
  const row = db
    .prepare("SELECT token, status, expires_at FROM telegram_login_sessions WHERE token = ?")
    .get(token) as Row;
  if (!row) return { ok: false, reason: "not_found" };

  if (row.status !== "pending") {
    return { ok: false, reason: "already_confirmed" };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(
      "UPDATE telegram_login_sessions SET status = 'consumed' WHERE token = ?"
    ).run(token);
    return { ok: false, reason: "expired" };
  }

  db.prepare(
    `UPDATE telegram_login_sessions
       SET status = 'confirmed',
           tg_chat_id = ?,
           tg_username = ?,
           tg_first_name = ?,
           tg_last_name = ?,
           tg_photo_url = ?,
           confirmed_at = datetime('now')
     WHERE token = ? AND status = 'pending'`
  ).run(
    tg.chatId,
    tg.username || null,
    tg.firstName || null,
    tg.lastName || null,
    tg.photoUrl || null,
    token
  );
  return { ok: true };
}

/**
 * Consume a confirmed session — called from the NextAuth authorize path.
 * Atomic: rejects re-use, so a stolen token can't sign in twice.
 */
export function consumeLoginSession(token: string): LoginSession | null {
  const db = getDb();
  const session = getLoginSession(token);
  if (!session || session.status !== "confirmed") return null;

  const info = db
    .prepare(
      "UPDATE telegram_login_sessions SET status = 'consumed', consumed_at = datetime('now') WHERE token = ? AND status = 'confirmed'"
    )
    .run(token);
  if (info.changes === 0) return null;
  return { ...session, status: "consumed" };
}

/** Sweep expired rows older than an hour so the table stays small. */
export function sweepExpiredLoginSessions(): number {
  const info = getDb()
    .prepare(
      "DELETE FROM telegram_login_sessions WHERE expires_at < datetime('now', '-1 hour')"
    )
    .run();
  return info.changes;
}
