/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { limitOrRespond } from "@/lib/rate-limit";

function genId(): string {
  return "sub-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** GET: returns whether the current user is subscribed to this project. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ subscribed: false });
  const { id } = await params;
  const row = getDb()
    .prepare("SELECT channels FROM project_subscriptions WHERE user_id = ? AND idea_id = ?")
    .get((session.user as any).id, id) as { channels?: string } | undefined;
  if (!row) return NextResponse.json({ subscribed: false });
  let channels: string[] = [];
  try { channels = JSON.parse(row.channels || "[]"); } catch { /* ignore */ }
  return NextResponse.json({ subscribed: true, channels });
}

/** POST: subscribe the current user to updates for this project. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limited = limitOrRespond(request, session.user.id, {
    max: 60,
    windowMs: 60 * 60 * 1000,
    bucket: "project-sub",
  });
  if (limited) return limited;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const channels: string[] = Array.isArray(body.channels) && body.channels.length > 0
    ? body.channels
    : ["in_app", "telegram"];

  const db = getDb();
  const exists = db.prepare("SELECT id FROM ideas WHERE id = ?").get(id);
  if (!exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const userId = (session.user as any).id;
  db.prepare(
    "INSERT INTO project_subscriptions (id, user_id, idea_id, channels) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, idea_id) DO UPDATE SET channels = excluded.channels"
  ).run(genId(), userId, id, JSON.stringify(channels));

  return NextResponse.json({ subscribed: true, channels });
}

/** DELETE: unsubscribe. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { id } = await params;
  getDb()
    .prepare("DELETE FROM project_subscriptions WHERE user_id = ? AND idea_id = ?")
    .run((session.user as any).id, id);
  return NextResponse.json({ subscribed: false });
}
