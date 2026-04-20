import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimTask } from "@/lib/ai-tasks";
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

  const userId = session.user.id || session.user.email || "unknown";
  const userName = session.user.name || "Anonymous";

  const limited = limitOrRespond(request, userId, {
    max: 30,
    windowMs: 60 * 60 * 1000,
    bucket: "task-claim",
  });
  if (limited) return limited;

  const { getUserTrustLevel, canClaimTask } = await import("@/lib/permissions");
  const trustLevel = getUserTrustLevel(userId);
  if (!canClaimTask(trustLevel)) {
    return NextResponse.json({ error: "You need Contributor status (Trust Level 2) to claim tasks. Keep commenting and participating!" }, { status: 403 });
  }

  const task = claimTask(id, userId, userName);
  if (!task) {
    return NextResponse.json(
      { error: "Task not available for claiming" },
      { status: 400 }
    );
  }

  // Log activity for task claim
  import("@/lib/db").then(({ logActivity }) => {
    logActivity({
      ideaId: task.ideaId,
      eventType: "task_claimed",
      actorId: userId,
      actorName: userName,
      details: task.title,
    });
  });

  // Dispatch to AI agent for task_claimed
  import("@/lib/ai/agent").then(({ handleAgentEvent }) => {
    handleAgentEvent({
      type: "task_claimed",
      ideaId: task.ideaId,
      entityId: id,
      actorId: userId,
      actorName: userName,
    }).catch(console.error);
  });

  // Fire-and-forget: notify project lead that a task was claimed.
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
      const tpl = getNotificationTemplate("task_assigned", "en", {
        actorName: userName,
        taskTitle: task.title,
        projectTitle: project?.title || "",
      });
      sendNotification({
        userId: leadId,
        type: "task_assigned",
        title: tpl.title,
        body: tpl.body,
        linkUrl: `/tasks/${id}`,
        channels: ["in_app", "telegram"],
        sourceType: "task",
        sourceId: id,
      }).catch(console.error);
    } catch (e) {
      console.error("[notifications] task_assigned dispatch failed:", e);
    }
  })();

  return NextResponse.json({ task });
}
