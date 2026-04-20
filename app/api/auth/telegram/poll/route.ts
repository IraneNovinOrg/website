/**
 * Poll the status of a pending Telegram sign-in session.
 * Client hits this every ~2s while waiting for the user to confirm in
 * Telegram. Returns minimal info — the actual sign-in happens via
 * `signIn("telegram", { token })` once status is "confirmed".
 */

import { NextRequest, NextResponse } from "next/server";
import { getLoginSession } from "@/lib/telegram/login-session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const session = getLoginSession(token);
  if (!session) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  // Never leak the Telegram chat id to the browser — it stays server-side
  // and only flows into the NextAuth authorize step.
  return NextResponse.json(
    {
      status: session.status,
      expiresAt: session.expiresAt,
      // Surface the first name so the UI can say "Welcome, Omid" while the
      // confirmation lands. It's the same name Telegram would show anyway.
      previewName: session.tgFirstName
        ? [session.tgFirstName, session.tgLastName].filter(Boolean).join(" ")
        : null,
    },
    {
      // Don't let CDNs cache this — status changes second-to-second.
      headers: { "Cache-Control": "no-store" },
    }
  );
}
