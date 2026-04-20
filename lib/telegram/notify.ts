import { Markup } from "telegraf";
import { getBot, getTelegramChatId } from "./bot";

export async function notifyUser(
  userId: string,
  message: string,
  buttons?: { text: string; url?: string; callbackData?: string }[]
) {
  const bot = getBot();
  if (!bot) return;

  const chatId = getTelegramChatId(userId);
  if (!chatId) return;

  const keyboard = buttons?.map((b) =>
    b.url
      ? Markup.button.url(b.text, b.url)
      : Markup.button.callback(b.text, b.callbackData!)
  );

  try {
    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      ...(keyboard ? Markup.inlineKeyboard(keyboard) : {}),
    });
  } catch (e) {
    console.error(`Telegram notification failed for ${userId}:`, e);
  }
}

export async function askExpertToReview(
  expertUserId: string,
  submission: {
    id: string;
    taskTitle: string;
    projectName: string;
    summary: string;
  }
) {
  await notifyUser(
    expertUserId,
    `🔬 *Expert review requested*\n\n` +
      `Project: ${submission.projectName}\n` +
      `Task: ${submission.taskTitle}\n\n` +
      `AI Summary: ${submission.summary}\n\n` +
      `Can you review this submission?`,
    [
      { text: "✅ Approve", callbackData: `review_approve:${submission.id}` },
      { text: "❌ Reject", callbackData: `review_reject:${submission.id}` },
      {
        text: "👀 View full",
        url: `https://iranenovin.com/en/tasks/${submission.id}`,
      },
    ]
  );
}

export async function notifyTaskAvailable(
  userId: string,
  task: {
    id: string;
    title: string;
    projectName: string;
    skillsNeeded: string[];
  }
) {
  await notifyUser(
    userId,
    `🎯 *New task matches your skills*\n\n` +
      `"${task.title}"\n` +
      `Project: ${task.projectName}\n` +
      `Skills: ${task.skillsNeeded.join(", ")}`,
    [
      {
        text: "Claim this task",
        url: `https://iranenovin.com/en/tasks/${task.id}`,
      },
    ]
  );
}

export async function notifySubmissionReady(
  leadUserId: string,
  submission: {
    taskTitle: string;
    authorName: string;
    projectName: string;
    aiSummary: string;
  }
) {
  await notifyUser(
    leadUserId,
    `📝 *New submission for review*\n\n` +
      `Task: ${submission.taskTitle}\n` +
      `By: ${submission.authorName}\n` +
      `Project: ${submission.projectName}\n\n` +
      `AI says: ${submission.aiSummary}`
  );
}

export async function notifyTaskClaimed(
  leadUserId: string,
  task: { title: string; assigneeName: string; projectName: string }
) {
  await notifyUser(
    leadUserId,
    `👋 *Task claimed*\n\n` +
      `"${task.title}"\n` +
      `Claimed by: ${task.assigneeName}\n` +
      `Project: ${task.projectName}`
  );
}

export async function sendWeeklyDigest(chatId: string, content: string) {
  const bot = getBot();
  if (!bot) return;

  try {
    await bot.telegram.sendMessage(chatId, content, {
      parse_mode: "Markdown",
    });
  } catch (e) {
    console.error(`Weekly digest failed for ${chatId}:`, e);
  }
}

export async function sendDirectMessage(chatId: string, message: string) {
  const bot = getBot();
  if (!bot) return;

  try {
    await bot.telegram.sendMessage(chatId, message);
  } catch (e) {
    console.error(`Direct message failed for ${chatId}:`, e);
  }
}

/**
 * Send a formatted feedback message to a Telegram channel/chat.
 * Uses HTML parse_mode for rich formatting.
 */
export async function sendFeedbackMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  const bot = getBot();
  if (!bot) return false;

  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: "HTML" });
    return true;
  } catch (e) {
    console.error(`Feedback Telegram message failed for ${chatId}:`, e);
    return false;
  }
}

/**
 * Send a photo (as Buffer) to a Telegram channel/chat with an optional caption.
 */
export async function sendFeedbackPhoto(
  chatId: string,
  photoBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<boolean> {
  const bot = getBot();
  if (!bot) return false;

  try {
    await bot.telegram.sendPhoto(
      chatId,
      { source: photoBuffer, filename },
      caption ? { caption, parse_mode: "HTML" } : undefined
    );
    return true;
  } catch (e) {
    console.error(`Feedback Telegram photo failed for ${chatId}:`, e);
    return false;
  }
}

/**
 * Send a document (non-image file) to a Telegram channel/chat.
 */
export async function sendFeedbackDocument(
  chatId: string,
  docBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<boolean> {
  const bot = getBot();
  if (!bot) return false;

  try {
    await bot.telegram.sendDocument(
      chatId,
      { source: docBuffer, filename },
      caption ? { caption, parse_mode: "HTML" } : undefined
    );
    return true;
  } catch (e) {
    console.error(`Feedback Telegram document failed for ${chatId}:`, e);
    return false;
  }
}
