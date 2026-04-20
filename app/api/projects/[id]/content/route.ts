/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, logActivity } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { content } = await request.json();
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const db = getDb();

  // Check idea exists
  const idea = db.prepare("SELECT id FROM ideas WHERE id = ?").get(id);
  if (!idea) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(content, id);

  logActivity({
    ideaId: id,
    eventType: "project_content_updated",
    actorId: (session.user as any).id,
    actorName: session.user.name || session.user.email,
  });

  return NextResponse.json({ success: true });
}
