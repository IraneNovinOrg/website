/**
 * Notifications dispatcher — single entry point for delivering a notification
 * across multiple channels. Always inserts an in-app row; other channels are
 * opportunistic based on user preferences.
 *
 * Design rules:
 *   - Fire-and-forget: never throws, never blocks on channel failures.
 *   - Per-channel errors are logged and swallowed.
 *   - Reads `users.notification_prefs` (JSON) and `telegram_links` to decide
 *     delivery.
 */

import { getDb } from "@/lib/db/index";
import { createNotification } from "@/lib/db/notifications";
import { logError, logInfo } from "@/lib/logger";
import { sendTelegram } from "./telegram";
import { sendEmail } from "./email";

export type NotificationChannel = "in_app" | "telegram" | "email";

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
  channels?: NotificationChannel[];
  sourceType?: string;
  sourceId?: string;
  /** Optional relevance score 0-1. Currently used for logging only. */
  relevanceScore?: number;
}

interface UserRow {
  id: string;
  email: string | null;
  telegram_chat_id: string | null;
  notification_prefs: string | null;
}

interface TelegramLinkRow {
  telegram_chat_id: string | null;
}

interface NotificationPrefs {
  telegram?: boolean;
  email?: boolean;
  inApp?: boolean;
  // Legacy fields used by the bot — still respected.
  channel?: string;
  taskMatches?: boolean;
  expertReviews?: boolean;
  projectUpdates?: boolean;
  weeklyDigest?: boolean;
  // Per-type muting, e.g. { mutedTypes: ["ai_reply"] }
  mutedTypes?: string[];
}

function parsePrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as NotificationPrefs) : {};
  } catch {
    return {};
  }
}

function isMuted(prefs: NotificationPrefs, type: string): boolean {
  return Array.isArray(prefs.mutedTypes) && prefs.mutedTypes.includes(type);
}

function userWantsTelegram(prefs: NotificationPrefs): boolean {
  // Default: send if user has linked telegram. User can opt out with
  // `notification_prefs.telegram = false` or `mutedTypes` entry.
  if (prefs.telegram === false) return false;
  return true;
}

function userWantsEmail(prefs: NotificationPrefs): boolean {
  // Default: OFF — user must explicitly set `notification_prefs.email = true`
  return prefs.email === true;
}

/**
 * Look up Telegram chat id — prefer `telegram_links` table, fall back to
 * legacy `users.telegram_chat_id` column.
 */
function lookupTelegramChatId(userId: string): string | null {
  try {
    const db = getDb();
    const link = db
      .prepare(
        "SELECT telegram_chat_id FROM telegram_links WHERE user_id = ? LIMIT 1"
      )
      .get(userId) as TelegramLinkRow | undefined;
    if (link?.telegram_chat_id) return link.telegram_chat_id;

    const fallback = db
      .prepare("SELECT telegram_chat_id FROM users WHERE id = ? LIMIT 1")
      .get(userId) as { telegram_chat_id: string | null } | undefined;
    return fallback?.telegram_chat_id ?? null;
  } catch {
    return null;
  }
}

function loadUser(userId: string): UserRow | null {
  try {
    const db = getDb();
    return (
      (db
        .prepare(
          "SELECT id, email, telegram_chat_id, notification_prefs FROM users WHERE id = ? LIMIT 1"
        )
        .get(userId) as UserRow | undefined) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Dispatch a notification. Never throws — errors are logged per channel.
 * Callers should still use `.catch(console.error)` as a safety net for
 * any unexpected synchronous failure during setup.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const {
    userId,
    type,
    title,
    body,
    linkUrl,
    channels = ["in_app"],
    sourceType,
    sourceId,
    relevanceScore,
  } = payload;

  if (!userId || !type || !title) {
    logError(
      `[notifications] skipped — missing required field (userId=${userId}, type=${type})`,
      "notifications"
    );
    return;
  }

  const user = loadUser(userId);
  const prefs = parsePrefs(user?.notification_prefs);

  if (isMuted(prefs, type)) {
    logInfo(`[notifications] muted type=${type} for user=${userId}`, "notifications");
    return;
  }

  const wantChannel = (ch: NotificationChannel) => channels.includes(ch);

  // ─── 1. In-app (always, unless explicitly excluded) ─────────────────────
  if (wantChannel("in_app")) {
    try {
      createNotification({
        userId,
        type,
        title,
        body: body ?? null,
        url: linkUrl ?? null,
        sourceType: sourceType ?? null,
        sourceId: sourceId ?? null,
      });
    } catch (e) {
      logError(
        `[notifications] in_app insert failed: ${(e as Error).message}`,
        "notifications"
      );
    }
  }

  // ─── 2. Telegram ────────────────────────────────────────────────────────
  if (wantChannel("telegram")) {
    try {
      const chatId = lookupTelegramChatId(userId);
      if (chatId && userWantsTelegram(prefs)) {
        await sendTelegram(userId, title, body, linkUrl);
      }
    } catch (e) {
      logError(
        `[notifications] telegram send failed: ${(e as Error).message}`,
        "notifications"
      );
    }
  }

  // ─── 3. Email ───────────────────────────────────────────────────────────
  if (wantChannel("email") && process.env.RESEND_API_KEY) {
    try {
      if (user?.email && userWantsEmail(prefs)) {
        await sendEmail({
          to: user.email,
          subject: title,
          body: body || "",
          linkUrl,
        });
      }
    } catch (e) {
      logError(
        `[notifications] email send failed: ${(e as Error).message}`,
        "notifications"
      );
    }
  }

  if (typeof relevanceScore === "number") {
    logInfo(
      `[notifications] dispatched type=${type} user=${userId} relevance=${relevanceScore.toFixed(2)}`,
      "notifications"
    );
  }
}
