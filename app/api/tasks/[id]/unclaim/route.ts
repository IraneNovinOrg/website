import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { isAdmin as isAdminEmail } from "@/lib/admin";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string || session.user.email || "";

  const limited = limitOrRespond(request, userId || null, {
    max: 30,
    windowMs: 60 * 60 * 1000,
    bucket: "task-unclaim",
  });
  if (limited) return limited;

  const db = getDb();

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Only the assignee or admin can unclaim
  const isAdmin = isAdminEmail(session.user.email);

  if (task.assignee_id !== userId && !isAdmin) {
    return NextResponse.json({ error: "Only the assignee can release this task" }, { status: 403 });
  }

  if (!["claimed", "in-progress"].includes(task.status as string)) {
    return NextResponse.json({ error: "Task cannot be unclaimed in its current state" }, { status: 400 });
  }

  db.prepare(`
    UPDATE tasks SET status = 'open', assignee_id = NULL, assignee_name = NULL,
      claimed_at = NULL, due_date = NULL
    WHERE id = ?
  `).run(id);

  // Log activity
  import("@/lib/db").then(({ logActivity }) => {
    logActivity({
      ideaId: task.idea_id as string,
      eventType: "task_unclaimed",
      actorId: userId,
      actorName: session.user?.name || "Unknown",
      details: task.title as string,
    });
  });

  // Return updated task
  const { getTaskById } = await import("@/lib/ai-tasks");
  return NextResponse.json({ task: getTaskById(id) });
}
