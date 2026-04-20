import { getDb } from "./db/index";

type LogLevel = "info" | "warn" | "error" | "critical";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  actorName?: string;
  ideaId?: string;
}

export function log(entry: LogEntry): void {
  const db = getDb();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  try {
    db.prepare(`
      INSERT INTO logs (id, level, message, context, actor_name, idea_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, entry.level, entry.message, entry.context || null, entry.actorName || null, entry.ideaId || null);
  } catch {
    // Table might not exist yet
    console.log(`[${entry.level.toUpperCase()}] ${entry.message}`);
  }

  // Also console.log for dev
  const prefix = { info: "i", warn: "!", error: "X", critical: "!!!" }[entry.level];
  console.log(`${prefix} [${entry.level}] ${entry.message}`);

  // Send critical errors to Telegram
  if (entry.level === "critical") {
    sendCriticalAlert(entry).catch(() => {});
  }
}

async function sendCriticalAlert(entry: LogEntry): Promise<void> {
  const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return;

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const text = `CRITICAL ERROR\n\nMessage: ${entry.message}\nContext: ${entry.context || "N/A"}\nTime: ${new Date().toISOString()}`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch {
    // Don't recurse
  }
}

export function logInfo(message: string, context?: string): void {
  log({ level: "info", message, context });
}

export function logWarn(message: string, context?: string): void {
  log({ level: "warn", message, context });
}

export function logError(message: string, context?: string): void {
  log({ level: "error", message, context });
}

export function logCritical(message: string, context?: string): void {
  log({ level: "critical", message, context });
}
