/**
 * Start a Telegram deep-link sign-in session.
 * Returns a fresh token + the `t.me/<bot>?start=login_<token>` deep link the
 * client renders as a button + QR code.
 */

import { NextResponse } from "next/server";
import { createLoginSession } from "@/lib/telegram/login-session";
import { limitOrRespond } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export async function POST(request: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !BOT_USERNAME) {
    return NextResponse.json(
      { error: "Telegram sign-in is not configured on this instance." },
      { status: 501 }
    );
  }

  // Anyone (signed-out) can start a session, so rate-limit by IP to stop a
  // bot from creating millions of pending rows.
  const limited = limitOrRespond(request, null, {
    max: 20,
    windowMs: 60 * 60 * 1000,
    bucket: "tg-login-start",
  });
  if (limited) return limited;

  const session = createLoginSession();
  const deepLink = `https://t.me/${BOT_USERNAME}?start=login_${session.token}`;

  return NextResponse.json({
    token: session.token,
    deepLink,
    // "Tap to open Telegram" on Android/iOS — falls back to https link.
    appLink: `tg://resolve?domain=${BOT_USERNAME}&start=login_${session.token}`,
    expiresAt: session.expiresAt,
  });
}
