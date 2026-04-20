/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { limitOrRespond } from "@/lib/rate-limit";

function genId(): string {
  return "pcm-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, author_id, author_name, author_avatar, content, created_at, edited_at FROM project_chat_messages WHERE idea_id = ? ORDER BY created_at ASC LIMIT 500"
    )
    .all(id) as any[];
  return NextResponse.json({ messages: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 60,
    windowMs: 60 * 60 * 1000,
    bucket: "project-chat",
  });
  if (limited) return limited;

  const { id: ideaId } = await params;
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (content.length > 4000) {
    return NextResponse.json({ error: "Message too long (4000 char max)" }, { status: 400 });
  }

  const db = getDb();
  const exists = db.prepare("SELECT id FROM ideas WHERE id = ?").get(ideaId);
  if (!exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const msgId = genId();
  const authorId = (session.user as any).id || null;
  const authorName = session.user.name || session.user.email || "Anonymous";
  const authorAvatar = session.user.image || null;

  db.prepare(
    "INSERT INTO project_chat_messages (id, idea_id, author_id, author_name, author_avatar, content) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(msgId, ideaId, authorId, authorName, authorAvatar, content);

  return NextResponse.json(
    {
      message: {
        id: msgId,
        idea_id: ideaId,
        author_id: authorId,
        author_name: authorName,
        author_avatar: authorAvatar,
        content,
        created_at: new Date().toISOString(),
      },
    },
    { status: 201 }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { id: ideaId } = await params;
  const body = await request.json().catch(() => ({}));
  const messageId = String(body.messageId || "");
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const db = getDb();
  const msg = db.prepare("SELECT author_id, author_name FROM project_chat_messages WHERE id = ? AND idea_id = ?").get(messageId, ideaId) as any;
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  // Only author or admin can delete
  const { isAdmin } = await import("@/lib/admin");
  const isMine =
    ((session.user as any).id && msg.author_id === (session.user as any).id) ||
    (session.user.name && msg.author_name === session.user.name);
  if (!isMine && !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  db.prepare("DELETE FROM project_chat_messages WHERE id = ?").run(messageId);
  return NextResponse.json({ success: true });
}
