import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getTaskById,
  createSubmission,
  updateTaskStatus,
  getSubmissionById,
  setAIReview,
} from "@/lib/ai-tasks";
import type { SubmissionAttachment } from "@/lib/ai-tasks";
import { reviewSubmission } from "@/lib/ai";
import { limitOrRespond } from "@/lib/rate-limit";

interface IncomingAttachment {
  url?: unknown;
  filename?: unknown;
  size?: unknown;
  mimeType?: unknown;
}

function sanitizeAttachments(input: unknown): SubmissionAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: SubmissionAttachment[] = [];
  for (const raw of input as IncomingAttachment[]) {
    if (!raw || typeof raw !== "object") continue;
    const url = typeof raw.url === "string" ? raw.url : "";
    const filename = typeof raw.filename === "string" ? raw.filename : "";
    const size = typeof raw.size === "number" ? raw.size : 0;
    const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : "";
    // Only accept URLs that point at our uploads directory
    if (!url.startsWith("/uploads/")) continue;
    if (!filename) continue;
    out.push({ url, filename, size, mimeType });
    if (out.length >= 20) break;
  }
  return out;
}

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
    max: 10,
    windowMs: 60 * 60 * 1000,
    bucket: "task-submit",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { type, content, attachments } = body;

    const safeAttachments = sanitizeAttachments(attachments);

    if (!type || (!content && safeAttachments.length === 0)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const task = getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const userId = session.user.id || session.user.email || "unknown";
    const userName = session.user.name || "Anonymous";

    // Create submission
    const submission = createSubmission({
      taskId: id,
      ideaId: task.ideaId,
      authorId: userId,
      authorName: userName,
      type,
      content: content || "",
      attachments: safeAttachments,
    });

    // Update task status
    updateTaskStatus(id, "submitted");

    // Primary path: skills.reviewSubmission via ai-trigger (persists decision/confidence too)
    import("@/lib/ai-trigger").then(({ handleProjectEvent }) => {
      handleProjectEvent(task.ideaId, "task_submitted", {
        submissionId: submission.id,
      }).catch(console.error);
      // Also fire task_completed so updateDocument regenerates the doc
      handleProjectEvent(task.ideaId, "task_completed").catch(console.error);
    });

    // Fire-and-forget: notify project lead/reviewers that a submission is ready.
    (async () => {
      try {
        const { getDb } = await import("@/lib/db/index");
        const db = getDb();
        const project = db
          .prepare(
            `SELECT p.lead_user_id, p.title FROM projects p
             WHERE p.id = (SELECT project_id FROM tasks WHERE id = ?)
                OR p.source_idea_id = ?
             LIMIT 1`
          )
          .get(id, task.ideaId) as { lead_user_id?: string; title?: string } | undefined;
        const leadId = project?.lead_user_id;
        if (!leadId || leadId === userId) return;

        const { sendNotification } = await import(
          "@/lib/notifications/dispatcher"
        );
        const { getNotificationTemplate } = await import(
          "@/lib/notifications/templates"
        );
        const tpl = getNotificationTemplate("task_submitted", "en", {
          actorName: userName,
          taskTitle: task.title,
        });
        sendNotification({
          userId: leadId,
          type: "task_submitted",
          title: tpl.title,
          body: tpl.body,
          linkUrl: `/tasks/${id}`,
          channels: ["in_app", "telegram"],
          sourceType: "submission",
          sourceId: submission.id,
        }).catch(console.error);
      } catch (e) {
        console.error("[notifications] task_submitted dispatch failed:", e);
      }
    })();

    // Legacy quick-review fallback — harmless and helps if skills flow fails.
    reviewSubmission(
      { title: task.title, description: task.description, outputType: task.outputType },
      { content, type }
    )
      .then((review) => {
        // Only set if nothing already written (skills path may have populated it)
        const cur = getSubmissionById(submission.id);
        if (cur && !cur.aiReview) setAIReview(submission.id, review);
      })
      .catch((e) => console.error("AI review failed:", e));

    return NextResponse.json({ submission }, { status: 201 });
  } catch (e) {
    console.error("POST /api/tasks/[id]/submit error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
