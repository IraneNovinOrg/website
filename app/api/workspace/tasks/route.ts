/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getTasksForIdea, type Task } from "@/lib/ai-tasks";

/**
 * Workspace V2 read-only tasks aggregator.
 *
 * GET /api/workspace/tasks?projectId=<ideaId>
 *
 * Returns the project's tasks enriched with the extended workspace fields
 * (priority, labels, dueDate, sprintId, storyPoints). Writes still flow
 * through the canonical endpoints:
 *   - POST  /api/projects/[id]/tasks           (create)
 *   - POST  /api/tasks/[id]/claim              (claim)
 *   - POST  /api/tasks/[id]/submit             (submit work)
 *   - PATCH /api/workspace/tasks/[id]          (inline edit)
 *   - POST  /api/workspace/tasks/reorder       (drag/drop)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const tasks = getTasksForIdea(projectId);
  return NextResponse.json({
    tasks: tasks.map(serializeTask),
  });
}

function serializeTask(t: Task) {
  return {
    id: t.id,
    ideaId: t.ideaId,
    title: t.title,
    description: t.description,
    skillsNeeded: t.skillsNeeded,
    timeEstimate: t.timeEstimate,
    outputType: t.outputType,
    status: t.status,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    claimedAt: t.claimedAt,
    dueDate: t.dueDate,
    source: t.source,
    parentTaskId: t.parentTaskId,
    order: t.order,
    createdAt: t.createdAt,
    priority: t.priority ?? "medium",
    labels: t.labels ?? [],
    sprintId: t.sprintId ?? null,
    storyPoints: t.storyPoints ?? null,
    startDate: t.startDate ?? null,
    noteCount: Array.isArray(t.notes) ? t.notes.length : 0,
  };
}
