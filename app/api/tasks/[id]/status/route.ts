import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, logActivity } from "@/lib/db/index";
import { isAdmin } from "@/lib/admin";
import { limitOrRespond } from "@/lib/rate-limit";

const ALLOWED = [
  "open",
  "claimed",
  "in-progress",
  "in-review",
  "submitted",
  "changes-requested",
  "done",
  "accepted",
] as const;
type Status = (typeof ALLOWED)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 60,
    windowMs: 60 * 60 * 1000,
    bucket: "task-status",
  });
  if (limited) return limited;

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status as Status;
  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = getDb();
  const task = db
    .prepare("SELECT assignee_id, idea_id, title FROM tasks WHERE id = ?")
    .get(id) as
    | { assignee_id: string | null; idea_id: string; title: string }
    | undefined;
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const userId =
    (session.user as { id?: string }).id || session.user.email || "";
  const isAssignee = task.assignee_id === userId;
  const admin = isAdmin(session.user.email || "");
  if (!isAssignee && !admin) {
    return NextResponse.json(
      { error: "Only the assignee or admin can change status" },
      { status: 403 }
    );
  }

  // Normalize "done" → "accepted" (canonical terminal state used elsewhere)
  // and "in-review" → "submitted" (canonical review state).
  const normalized: string =
    status === "done" ? "accepted" : status === "in-review" ? "submitted" : status;

  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(normalized, id);

  logActivity({
    ideaId: task.idea_id,
    eventType: "task_status_changed",
    actorName: session.user.name || session.user.email || "",
    details: `"${task.title}" -> ${status}`,
  });

  return NextResponse.json({ success: true, status: normalized });
}
