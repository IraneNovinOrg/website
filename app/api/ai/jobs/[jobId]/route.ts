import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/ai-jobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Parse result JSON if completed
  let result = null;
  if (job.status === "completed" && job.result) {
    try {
      result = JSON.parse(job.result);
    } catch {
      result = job.result;
    }
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    result,
    error: job.error,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  });
}
