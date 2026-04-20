/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTask, getTasksForIdea, updateTaskStatus } from "@/lib/ai-tasks";
import { limitOrRespond } from "@/lib/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = getTasksForIdea(id);
  return NextResponse.json({ tasks });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = (session.user as any).id || session.user.email || "unknown";

  const limited = limitOrRespond(request, userId, {
    max: 20,
    windowMs: 60 * 60 * 1000,
    bucket: "project-tasks",
  });
  if (limited) return limited;
  const { getUserTrustLevel, canProposeTask } = await import("@/lib/permissions");
  const trustLevel = getUserTrustLevel(userId);
  if (!canProposeTask(trustLevel)) {
    return NextResponse.json({ error: "You need Contributor status (Trust Level 2) to propose tasks. Keep commenting and participating!" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, timeEstimate, skillType } = body;

  if (!title || !description || description.length < 50) {
    return NextResponse.json(
      { error: "Title required, description must be at least 50 characters" },
      { status: 400 }
    );
  }

  const task = createTask({
    ideaId: id,
    title,
    description,
    skillsNeeded: [skillType || "research"],
    timeEstimate: timeEstimate || "~2 hours",
    outputType: "document",
    source: "user",
  });

  // Set status to 'proposed' for user-created tasks
  updateTaskStatus(task.id, "proposed" as any);

  // Trigger AI
  import("@/lib/ai-trigger").then(({ handleProjectEvent }) => {
    handleProjectEvent(id, "task_proposed").catch(console.error);
  });

  return NextResponse.json({ task: { ...task, status: "proposed" } });
}
