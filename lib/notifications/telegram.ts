/**
 * Thin wrapper around the existing Telegram bot (`lib/telegram/notify.ts`).
 * Formats message as Markdown with bold title + optional body + link button.
 * Never throws — returns false on any failure.
 */

import { notifyUser } from "@/lib/telegram/notify";

function escapeMarkdown(text: string): string {
  // Telegraf's legacy Markdown parser requires these escaped.
  return text.replace(/([_*`\[])/g, "\\$1");
}

/**
 * Send a Telegram message to a linked user.
 *
 * NOTE: The underlying `notifyUser(userId, message, buttons)` looks up the
 * chat id by user id. We pass `userId` (not chatId) for compatibility with
 * that helper; the caller should have already confirmed the user is linked.
 */
export async function sendTelegram(
  userId: string,
  title: string,
  body?: string,
  linkUrl?: string
): Promise<boolean> {
  try {
    if (!userId || !title) return false;

    const safeTitle = escapeMarkdown(title);
    const safeBody = body ? escapeMarkdown(body) : "";
    const lines = [`*${safeTitle}*`];
    if (safeBody) lines.push("", safeBody);

    const message = lines.join("\n");
    const buttons = linkUrl
      ? [{ text: "Open on IranENovin", url: linkUrl }]
      : undefined;

    await notifyUser(userId, message, buttons);
    return true;
  } catch (e) {
    console.error("[notifications/telegram] sendTelegram failed:", e);
    return false;
  }
}
