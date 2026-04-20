import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTasksForIdea, createTask } from "@/lib/ai-tasks";
import { limitOrRespond } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get("ideaId");
  if (!ideaId) {
    return NextResponse.json({ error: "ideaId required" }, { status: 400 });
  }
  const tasks = getTasksForIdea(ideaId);
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 20,
    windowMs: 60 * 60 * 1000,
    bucket: "tasks",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { ideaId, title, description, skillsNeeded, timeEstimate, outputType } = body;

    if (!ideaId || !title || !description) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const task = createTask({
      ideaId,
      title,
      description,
      skillsNeeded: skillsNeeded || [],
      timeEstimate: timeEstimate || "~10 hours",
      outputType: outputType || "document",
      source: "user",
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    console.error("POST /api/tasks error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
