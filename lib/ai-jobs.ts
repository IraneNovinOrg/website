/**
 * AI Job Queue
 * ────────────
 * Provides async job management for AI operations so HTTP requests
 * return immediately (202) while AI work runs in the background.
 *
 * Jobs with a `payload` can be auto-retried by `processPendingAIJobs()` when
 * AI is transiently unavailable (rate limits, model outages, codex auth).
 */

import { getDb } from "./db/index";

export interface AIJob {
  id: string;
  idea_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  payload: string | null;
  last_error: string | null;
}

function genJobId(): string {
  return "job-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Create a new pending job. Returns the job ID. Pass an optional payload for retry. */
export function createJob(
  ideaId: string,
  jobType: string,
  payload?: Record<string, unknown>,
  opts?: { maxAttempts?: number }
): string {
  const id = genJobId();
  getDb()
    .prepare(
      "INSERT INTO ai_jobs (id, idea_id, job_type, status, max_attempts, payload) VALUES (?, ?, ?, 'pending', ?, ?)"
    )
    .run(
      id,
      ideaId,
      jobType,
      opts?.maxAttempts ?? 3,
      payload ? JSON.stringify(payload) : null
    );
  return id;
}

/** Update a job's status and optionally its result or error. */
export function updateJob(
  jobId: string,
  status: AIJob["status"],
  result?: string | null,
  error?: string | null
): void {
  const completedAt = status === "completed" || status === "failed"
    ? new Date().toISOString()
    : null;
  getDb()
    .prepare(
      `UPDATE ai_jobs SET status = ?, result = ?, error = ?, last_error = COALESCE(?, last_error), completed_at = ? WHERE id = ?`
    )
    .run(status, result ?? null, error ?? null, error ?? null, completedAt, jobId);
}

/** Schedule a retry: mark as pending with increased attempts and next_retry_at in the future. */
export function scheduleRetry(jobId: string, delayMs = 5 * 60 * 1000): void {
  const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
  getDb()
    .prepare(
      "UPDATE ai_jobs SET status = 'pending', attempts = attempts + 1, next_retry_at = ? WHERE id = ?"
    )
    .run(nextRetryAt, jobId);
}

/** Retrieve a job by ID. */
export function getJob(jobId: string): AIJob | null {
  return getDb()
    .prepare("SELECT * FROM ai_jobs WHERE id = ?")
    .get(jobId) as AIJob | null;
}

/** Count the number of pending/failed jobs with retries left. */
export function countRetryableJobs(): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) as n FROM ai_jobs WHERE (status = 'pending' OR status = 'failed') AND attempts < max_attempts AND payload IS NOT NULL"
    )
    .get() as { n: number };
  return row.n;
}

/**
 * Run an async function as a background job. Updates job status
 * from pending → running → completed/failed. If the function throws and
 * the job has a `payload`, marks as failed but keeps it retryable.
 */
export function runJobInBackground(
  jobId: string,
  fn: () => Promise<string | object>
): void {
  setImmediate(async () => {
    try {
      updateJob(jobId, "running");
      const result = await fn();
      const resultStr = typeof result === "string" ? result : JSON.stringify(result);
      updateJob(jobId, "completed", resultStr);
    } catch (e) {
      const message = (e as Error)?.message || String(e);
      console.error(`[AI Job ${jobId}] Failed:`, message);
      const job = getJob(jobId);
      const attempts = (job?.attempts || 0) + 1;
      const max = job?.max_attempts ?? 3;
      if (job?.payload && attempts < max && isRetryableError(message)) {
        // Mark as failed but schedule retry with exponential backoff
        const delay = Math.min(30 * 60 * 1000, 60 * 1000 * Math.pow(2, attempts)); // 2, 4, 8, 16, 30 min cap
        getDb()
          .prepare(
            "UPDATE ai_jobs SET status = 'failed', attempts = ?, last_error = ?, next_retry_at = ?, completed_at = datetime('now') WHERE id = ?"
          )
          .run(attempts, message.slice(0, 1000), new Date(Date.now() + delay).toISOString(), jobId);
        console.log(`[AI Job ${jobId}] Scheduled retry in ${Math.round(delay / 1000)}s (attempt ${attempts}/${max})`);
      } else {
        updateJob(jobId, "failed", null, message.slice(0, 1000));
      }
    }
  });
}

/** Returns true if the error is a transient AI/network failure we should retry. */
function isRetryableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /rate limit|timeout|etimedout|econnreset|503|502|500|fetch failed|network/.test(m) ||
    /codex cli auth|token expired|unauthorized/.test(m) ||
    /all.*model/.test(m) ||
    /empty response/.test(m)
  );
}

/**
 * Process pending retryable jobs. Called periodically from instrumentation.ts.
 * Only runs jobs whose next_retry_at has passed (or is null) and have a payload.
 */
export async function processPendingAIJobs(): Promise<number> {
  const db = getDb();
  // Pick up to 3 jobs at a time
  const jobs = db
    .prepare(
      `SELECT * FROM ai_jobs
       WHERE (status = 'failed' OR (status = 'pending' AND attempts > 0))
         AND attempts < max_attempts
         AND payload IS NOT NULL
         AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
       ORDER BY attempts ASC, created_at ASC
       LIMIT 3`
    )
    .all() as AIJob[];

  if (jobs.length === 0) return 0;

  let processed = 0;
  for (const job of jobs) {
    try {
      console.log(`[AI Job] Retrying ${job.id} (${job.job_type}, attempt ${job.attempts + 1}/${job.max_attempts})`);
      await retryJob(job);
      processed++;
    } catch (e) {
      console.error(`[AI Job] Retry failed for ${job.id}:`, e);
    }
  }
  return processed;
}

/** Execute a retry for a job based on its type + payload. */
async function retryJob(job: AIJob): Promise<void> {
  let payload: Record<string, unknown> = {};
  try { payload = job.payload ? JSON.parse(job.payload) : {}; } catch { /* ignore */ }

  // Mark running
  getDb().prepare("UPDATE ai_jobs SET status = 'running' WHERE id = ?").run(job.id);

  try {
    switch (job.job_type) {
      case "analysis": {
        const { analyzeIdea } = await import("./ai");
        const { createTask, getTasksForIdea } = await import("./ai-tasks");
        const analysis = await analyzeIdea({
          id: job.idea_id,
          title: payload.title as string,
          body: payload.body as string,
          category: (payload.category as string) || "General",
          voteCount: (payload.voteCount as number) || 0,
          commentBodies: (payload.commentBodies as string[]) || [],
        });
        // Apply cap of 8 open AI tasks on retry too
        const existing = getTasksForIdea(job.idea_id);
        const openAi = existing.filter((t) => t.source === "ai" && ["open", "claimed", "in-progress"].includes(t.status)).length;
        let slots = Math.max(0, 8 - openAi);
        for (const s of analysis.suggestedTasks) {
          if (slots <= 0) break;
          if (existing.some((t) => t.title === s.title)) continue;
          createTask({
            ideaId: job.idea_id,
            title: s.title,
            description: s.description,
            skillsNeeded: s.skillsNeeded,
            timeEstimate: s.timeEstimate,
            outputType: s.outputType,
            source: "ai",
            order: s.order,
          });
          slots--;
        }
        updateJob(job.id, "completed", JSON.stringify({ feasibility: analysis.feasibility }));
        break;
      }
      case "review-doc-suggestion": {
        const { reviewDocSuggestion } = await import("./ai/review-doc-suggestion");
        const projectTitle = payload.projectTitle as string;
        const original = payload.original as string;
        const suggested = payload.suggested as string;
        const suggestionId = payload.suggestionId as string;
        const verdict = await reviewDocSuggestion(projectTitle, original, suggested);

        const db2 = getDb();
        db2.prepare(
          "UPDATE document_suggestions SET ai_verdict = ?, ai_reason = ?, ai_reviewed_at = datetime('now') WHERE id = ?"
        ).run(verdict.verdict, verdict.reason, suggestionId);

        if (verdict.verdict === "approve") {
          db2.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(suggested, job.idea_id);
          db2.prepare(
            "UPDATE document_suggestions SET status = 'approved', reviewed_by = 'AI (auto)', reviewed_at = datetime('now') WHERE id = ?"
          ).run(suggestionId);
        }
        updateJob(job.id, "completed", JSON.stringify(verdict));
        break;
      }
      default:
        updateJob(job.id, "failed", null, `Unknown job_type for retry: ${job.job_type}`);
        return;
    }
  } catch (e) {
    const message = (e as Error)?.message || String(e);
    const attempts = (job.attempts || 0) + 1;
    if (attempts < job.max_attempts && isRetryableError(message)) {
      const delay = Math.min(30 * 60 * 1000, 60 * 1000 * Math.pow(2, attempts));
      getDb()
        .prepare(
          "UPDATE ai_jobs SET status = 'failed', attempts = ?, last_error = ?, next_retry_at = ? WHERE id = ?"
        )
        .run(attempts, message.slice(0, 1000), new Date(Date.now() + delay).toISOString(), job.id);
    } else {
      getDb()
        .prepare(
          "UPDATE ai_jobs SET status = 'failed', attempts = ?, last_error = ?, completed_at = datetime('now') WHERE id = ?"
        )
        .run(attempts, message.slice(0, 1000), job.id);
    }
    throw e;
  }
}
