import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";

export async function POST(request: NextRequest) {
  const bot = getBot();
  if (!bot) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Telegram webhook error:", e);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
