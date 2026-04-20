import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reviewSubmission } from "@/lib/ai";
import { getTaskById, getSubmissionById, setAIReview } from "@/lib/ai-tasks";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { submissionId } = body;

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId required" }, { status: 400 });
    }

    const submission = getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const task = getTaskById(submission.taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const review = await reviewSubmission(
      { title: task.title, description: task.description, outputType: task.outputType },
      { content: submission.content, type: submission.type }
    );

    const updated = setAIReview(submissionId, review);

    return NextResponse.json({ review, submission: updated });
  } catch (e) {
    console.error("POST /api/ai/review error:", e);
    return NextResponse.json(
      { error: String(e), code: "AI_ERROR" },
      { status: 500 }
    );
  }
}
