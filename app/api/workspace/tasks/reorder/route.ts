/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getTaskById } from "@/lib/ai-tasks";
import { isAdmin } from "@/lib/admin";
import { TASK_STATUSES } from "@/lib/workspace/tasks/constants";

/**
 * Workspace V2 atomic task move.
 *
 * POST body: { taskId: string, newStatus: TaskStatus, newOrder?: number }
 *
 * Performs `status` + `task_order` update in a single SQLite transaction so
 * a drag-drop never leaves the board in a split-brained state. Permission
 * mirrors PATCH: admin or current assignee.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const userEmail = session.user.email;
  const userId = (session.user as any).id || userEmail;

  let body: {
    taskId?: unknown;
    newStatus?: unknown;
    newOrder?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.taskId !== "string" || !body.taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }
  if (
    typeof body.newStatus !== "string" ||
    !TASK_STATUSES.includes(body.newStatus as any)
  ) {
    return NextResponse.json(
      { error: `Invalid newStatus: ${String(body.newStatus)}` },
      { status: 400 }
    );
  }

  const existing = getTaskById(body.taskId);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const admin = isAdmin(userEmail);
  const ownsTask = existing.assigneeId === userId;
  if (!admin && !ownsTask && existing.status !== "open") {
    return NextResponse.json(
      { error: "Only the assignee or an admin can move this task" },
      { status: 403 }
    );
  }

  const db = getDb();
  const newOrder =
    typeof body.newOrder === "number" && Number.isFinite(body.newOrder)
      ? Math.max(0, Math.floor(body.newOrder))
      : null;

  try {
    const move = db.transaction((taskId: string, status: string) => {
      if (newOrder !== null) {
        // Shift existing tasks in the target column to make room.
        db.prepare(
          `UPDATE tasks
           SET task_order = task_order + 1
           WHERE idea_id = ?
             AND status = ?
             AND task_order >= ?
             AND id != ?`
        ).run(existing.ideaId, status, newOrder, taskId);
        db.prepare(
          "UPDATE tasks SET status = ?, task_order = ? WHERE id = ?"
        ).run(status, newOrder, taskId);
      } else {
        db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
          status,
          taskId
        );
      }
    });
    move(body.taskId, body.newStatus);
  } catch (err) {
    console.error("[workspace/tasks/reorder] failed:", err);
    return NextResponse.json(
      { error: "Failed to reorder task" },
      { status: 500 }
    );
  }

  const updated = getTaskById(body.taskId);
  return NextResponse.json({ task: updated });
}
