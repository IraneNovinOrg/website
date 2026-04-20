import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  setLeadReview,
  updateTaskStatus,
} from "@/lib/ai-tasks";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 20,
    windowMs: 60 * 60 * 1000,
    bucket: "task-review",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { submissionId, decision, note } = body;

    if (!submissionId || !decision) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const submission = setLeadReview(submissionId, decision, note || null);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Update task status based on decision
    if (decision === "accepted") {
      updateTaskStatus(id, "accepted");

      // Channel post: project update for task acceptance (fire-and-forget)
      import("@/lib/ai-tasks").then(({ getTaskById }) => {
        const task = getTaskById(id);
        if (task) {
          import("@/lib/telegram/channel").then(({ postProjectUpdate }) => {
            postProjectUpdate({
              id: task.ideaId,
              title: task.title,
              updateType: 'Task Accepted',
              detail: `"${task.title}" has been reviewed and accepted`,
            }).catch(console.error);
          }).catch(() => {});
        }
      }).catch(() => {});
    } else {
      updateTaskStatus(id, "changes-requested");
    }

    return NextResponse.json({ submission });
  } catch (e) {
    console.error("POST /api/tasks/[id]/review error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
