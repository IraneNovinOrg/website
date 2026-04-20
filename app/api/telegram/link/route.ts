import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { verifyAndConsumeLinkToken, generateLinkToken } from "@/lib/telegram/bot";

// POST: link Telegram account using a token from the bot
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const result = verifyAndConsumeLinkToken(token);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Link the Telegram chat ID to the user
    getDb()
      .prepare("UPDATE users SET telegram_chat_id = ? WHERE id = ?")
      .run(result.telegramChatId, session.user.id);

    return NextResponse.json({
      success: true,
      telegramUsername: result.telegramUsername,
    });
  } catch (e) {
    console.error("Telegram link error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: unlink Telegram
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  getDb()
    .prepare("UPDATE users SET telegram_chat_id = NULL WHERE id = ?")
    .run(session.user.id);

  return NextResponse.json({ success: true });
}

// GET: generate a link token for the deep link flow
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate token with userId as the chat ID placeholder
  // The bot will replace this when the user clicks the deep link
  const token = generateLinkToken(session.user.id, null);

  let botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    try {
      const { readFileSync } = await import("fs");
      const { join } = await import("path");
      const cfg = JSON.parse(readFileSync(join(process.cwd(), "_config", "telegram.json"), "utf-8"));
      botUsername = cfg.botUsername;
    } catch { /* ignore */ }
  }
  botUsername = botUsername || "IranENovinBot";
  const deepLink = `https://t.me/${botUsername}?start=link_${token}`;

  return NextResponse.json({ deepLink, token });
}
