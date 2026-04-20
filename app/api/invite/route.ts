/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { limitOrRespond } from "@/lib/rate-limit";

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = request.nextUrl.searchParams.get("history");
  if (history) {
    const db = getDb();
    const invitations = db.prepare(
      "SELECT * FROM invitations WHERE inviter_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(session.user.id);

    return NextResponse.json({ invitations });
  }

  return NextResponse.json({ invitations: [] });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = limitOrRespond(request, session.user.id, {
    max: 5,
    windowMs: 60 * 60 * 1000,
    bucket: "invite",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { type, recipientName, recipientContact, contactType, personalMessage } = body;

    const db = getDb();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const code = genCode();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";
    const inviteUrl = `${appUrl}/en/join?invite=${code}`;

    db.prepare(`
      INSERT INTO invitations (id, inviter_id, inviter_name, type, recipient_name,
        recipient_contact, contact_type, personal_message, invite_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      session.user.id,
      session.user.name || null,
      type || "direct",
      recipientName || null,
      recipientContact || null,
      contactType || "link",
      personalMessage || null,
      code
    );

    return NextResponse.json({
      success: true,
      inviteCode: code,
      url: inviteUrl,
    });
  } catch (e) {
    console.error("POST /api/invite error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
