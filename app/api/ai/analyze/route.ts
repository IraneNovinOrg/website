import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeIdea, getCachedAnalysis } from "@/lib/ai";
import { createTask, getTasksForIdea } from "@/lib/ai-tasks";
import { createJob, runJobInBackground } from "@/lib/ai-jobs";

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get("ideaId");
  if (!ideaId) {
    return NextResponse.json({ error: "ideaId required" }, { status: 400 });
  }

  const cached = getCachedAnalysis(ideaId);
  if (cached) {
    const tasks = getTasksForIdea(ideaId);
    return NextResponse.json({ analysis: cached, tasks });
  }

  return NextResponse.json({ analysis: null, tasks: [] });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isAdmin } = await import("@/lib/admin");
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { ideaId, title, ideaBody, category, voteCount, commentBodies } = body;

    if (!ideaId || !title || !ideaBody) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Check if already analyzed (return cached immediately)
    const existing = getCachedAnalysis(ideaId);
    if (existing && !body.force) {
      const tasks = getTasksForIdea(ideaId);
      return NextResponse.json({ analysis: existing, tasks });
    }

    // Create a background job and return 202 immediately
    const jobId = createJob(ideaId, "analysis");

    runJobInBackground(jobId, async () => {
      const analysis = await analyzeIdea({
        id: ideaId,
        title,
        body: ideaBody,
        category: category || "General",
        voteCount: voteCount || 0,
        commentBodies,
      });

      // Create tasks from suggested tasks
      const existingTasks = getTasksForIdea(ideaId);
      const newTasks = [];

      for (const suggested of analysis.suggestedTasks) {
        if (existingTasks.some((t) => t.title === suggested.title)) continue;
        const task = createTask({
          ideaId,
          title: suggested.title,
          description: suggested.description,
          skillsNeeded: suggested.skillsNeeded,
          timeEstimate: suggested.timeEstimate,
          outputType: suggested.outputType,
          source: "ai",
          order: suggested.order,
        });
        newTasks.push(task);
      }

      return { analysis, tasks: [...existingTasks, ...newTasks] };
    });

    return NextResponse.json(
      { jobId, status: "pending", message: "Analysis started in background" },
      { status: 202 }
    );
  } catch (e) {
    const message = (e as Error)?.message || String(e);
    console.error("POST /api/ai/analyze error:", e);

    const friendly = /api key|token|OPENAI|ANTHROPIC|All.*model|rate limit|timeout|authentication|No AI models/i.test(message)
      ? `AI analysis is temporarily unavailable. (${message.slice(0, 300)})`
      : `AI analysis failed: ${message.slice(0, 300)}`;

    return NextResponse.json(
      { error: friendly, code: "AI_ERROR" },
      { status: 503 }
    );
  }
}
