/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getTaskById,
  updateTaskFields,
  type Task,
  type TaskPriority,
} from "@/lib/ai-tasks";
import { isAdmin } from "@/lib/admin";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/workspace/tasks/constants";

/**
 * Workspace V2 per-task endpoint.
 *
 * GET:   single task with subtasks hydrated
 * PATCH: inline edit a whitelisted subset of fields. Auth: task assignee,
 *        admin, or idea author (checked at the idea level).
 */

type AllowedField =
  | "title"
  | "description"
  | "status"
  | "priority"
  | "labels"
  | "dueDate"
  | "startDate"
  | "storyPoints"
  | "assigneeId"
  | "assigneeName"
  | "parentTaskId"
  | "sprintId";

const ALLOWED_FIELDS: AllowedField[] = [
  "title",
  "description",
  "status",
  "priority",
  "labels",
  "dueDate",
  "startDate",
  "storyPoints",
  "assigneeId",
  "assigneeName",
  "parentTaskId",
  "sprintId",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = getTaskById(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({ task });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const userEmail = session.user.email;
  const userId = (session.user as any).id || userEmail;

  const existing = getTaskById(id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Permission: admin OR current assignee can update the task.
  const admin = isAdmin(userEmail);
  const ownsTask = existing.assigneeId === userId;
  if (!admin && !ownsTask) {
    return NextResponse.json(
      { error: "Only the assignee or an admin can edit this task" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<
    Pick<
      Task,
      | "title"
      | "description"
      | "status"
      | "priority"
      | "labels"
      | "dueDate"
      | "startDate"
      | "storyPoints"
      | "assigneeId"
      | "assigneeName"
      | "parentTaskId"
      | "sprintId"
    >
  > = {};

  for (const field of ALLOWED_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];

    switch (field) {
      case "status":
        if (typeof value !== "string" || !TASK_STATUSES.includes(value as any)) {
          return NextResponse.json(
            { error: `Invalid status: ${String(value)}` },
            { status: 400 }
          );
        }
        patch.status = value as Task["status"];
        break;
      case "priority":
        if (
          value !== null &&
          (typeof value !== "string" || !TASK_PRIORITIES.includes(value as any))
        ) {
          return NextResponse.json(
            { error: `Invalid priority: ${String(value)}` },
            { status: 400 }
          );
        }
        patch.priority = (value ?? "medium") as TaskPriority;
        break;
      case "labels":
        if (value != null && !Array.isArray(value)) {
          return NextResponse.json(
            { error: "labels must be an array of strings" },
            { status: 400 }
          );
        }
        patch.labels = Array.isArray(value)
          ? value.filter((x): x is string => typeof x === "string")
          : [];
        break;
      case "storyPoints":
        if (value != null && typeof value !== "number") {
          return NextResponse.json(
            { error: "storyPoints must be a number or null" },
            { status: 400 }
          );
        }
        patch.storyPoints = (value as number | null) ?? null;
        break;
      case "title":
      case "description":
        if (typeof value !== "string") continue;
        if (field === "title") patch.title = value;
        else patch.description = value;
        break;
      case "dueDate":
      case "startDate":
      case "assigneeId":
      case "assigneeName":
      case "parentTaskId":
      case "sprintId":
        if (value != null && typeof value !== "string") continue;
        (patch as any)[field] = (value as string | null) ?? null;
        break;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const updated = updateTaskFields(id, patch);
  return NextResponse.json({ task: updated });
}
