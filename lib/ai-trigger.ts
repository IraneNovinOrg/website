import { getDb, logActivity } from "./db";
import { analyzeIdea, suggestNextTasks } from "./ai";
import { createTask, getTasksForIdea, getAcceptedWork } from "./ai-tasks";

type TriggerEvent =
  | "project_activated"
  | "task_completed"
  | "new_comment"
  | "help_offered"
  | "task_proposed"
  | "task_submitted"
  | "task_note_added"
  | "admin_request";

interface TriggerExtra {
  commentId?: string;
  noteId?: string;
  submissionId?: string;
}

// Fire-and-forget helper: delays `fn` by `ms` and catches any error.
function schedule(ms: number, fn: () => Promise<unknown>): void {
  setTimeout(() => {
    fn().catch((e) => console.error("[ai-trigger] scheduled skill failed:", e));
  }, ms);
}

export async function handleProjectEvent(
  ideaId: string,
  event: TriggerEvent,
  extra?: TriggerExtra
): Promise<void> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as any;
  if (!idea) return;

  console.log(`[AI Trigger] Handling ${event} for ${ideaId}`);

  // ─── Skill dispatch (non-blocking, independent of analysis cooldown) ──
  // These use their own per-entity 30-min cooldown inside lib/ai/skills.
  switch (event) {
    case "new_comment": {
      if (extra?.commentId) {
        schedule(5000, async () => {
          const { replyToComment } = await import("./ai/skills");
          await replyToComment(extra.commentId!);
        });
      }
      break;
    }
    case "task_note_added": {
      if (extra?.noteId) {
        schedule(5000, async () => {
          const { replyToTaskNote } = await import("./ai/skills");
          await replyToTaskNote(extra.noteId!);
        });
      }
      break;
    }
    case "task_submitted": {
      if (extra?.submissionId) {
        schedule(0, async () => {
          const { reviewSubmission } = await import("./ai/skills");
          await reviewSubmission(extra.submissionId!);
        });
      }
      break;
    }
    case "project_activated": {
      schedule(0, async () => {
        const { matchExperts } = await import("./ai/skills");
        const result = await matchExperts(ideaId);
        if (result && result.matches.length > 0) {
          const { logActivity: la } = await import("./db/index");
          la({
            ideaId,
            eventType: "ai_expert_matches",
            actorName: "AI Assistant",
            details: JSON.stringify(result.matches).slice(0, 4000),
          });
        }
      });
      // Auto-generate the project document after the heavy analysis has had
      // time to finish (analysis writes ai_analyses which the doc skill reads).
      schedule(60_000, async () => {
        try {
          const { updateDocument } = await import("./ai/skills");
          const ok = await updateDocument(ideaId);
          if (ok) {
            try {
              const db2 = getDb();
              db2
                .prepare("UPDATE ideas SET last_ai_document_at = datetime('now') WHERE id = ?")
                .run(ideaId);
            } catch { /* column may not exist */ }
            console.log(`[AI Trigger] Auto-doc generated for ${ideaId} after activation`);
          }
        } catch (e) {
          try {
            const { logError } = await import("./logger");
            logError(`Auto-doc generation failed for ${ideaId}: ${(e as Error).message}`, "ai-trigger");
          } catch { /* logger not available */ }
        }
      });
      break;
    }
    case "task_completed": {
      schedule(0, async () => {
        const { updateDocument } = await import("./ai/skills");
        await updateDocument(ideaId);
      });
      break;
    }
  }

  // Don't re-analyze (heavy task) if we analyzed less than 1 hour ago.
  // Skill dispatch above still happens.
  if (idea.ai_analyzed_at) {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (new Date(idea.ai_analyzed_at).getTime() > hourAgo) {
      console.log(`[AI Trigger] Skipping heavy analysis for ${event} on ${ideaId} — analyzed recently`);
      return;
    }
  }

  // ─── Heavy analysis paths ─────────────────────────────────────────────
  switch (event) {
    case "project_activated":
    case "admin_request":
      await runFullAnalysis(ideaId, idea);
      break;

    case "task_completed":
      await suggestFollowUpTasks(ideaId, idea);
      break;

    case "new_comment": {
      // Only re-analyze if 3+ new comments since last analysis
      const commentCount = countCommentsSinceAnalysis(ideaId, idea.ai_analyzed_at);
      if (commentCount >= 3) {
        console.log(`[AI Trigger] ${commentCount} new comments since last analysis — re-analyzing`);
        await runFullAnalysis(ideaId, idea);
      } else {
        console.log(`[AI Trigger] Only ${commentCount} new comments — not enough to re-analyze`);
      }
      break;
    }

    case "help_offered":
      console.log(`[AI Trigger] Help offered on ${ideaId} — logged`);
      break;

    case "task_proposed":
      console.log(`[AI Trigger] Task proposed on ${ideaId} — logged`);
      break;

    case "task_submitted":
    case "task_note_added":
      // Already dispatched above.
      break;
  }
}

async function runFullAnalysis(ideaId: string, idea: Record<string, unknown>): Promise<void> {
  try {
    const db = getDb();

    // Get comments for context
    const comments = db.prepare(
      "SELECT body, author_login FROM idea_comments WHERE idea_id = ? ORDER BY created_at ASC"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).all(ideaId) as any[];
    const commentBodies = comments.map((c) => c.body);

    // Get vote count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voteRow = db.prepare(
      "SELECT total_votes FROM vote_counts WHERE idea_id = ?"
    ).get(ideaId) as { total_votes: number } | undefined;

    // Detect first-time analysis for intensive mode
    const isFirstAnalysis = !idea.ai_analyzed_at;
    if (isFirstAnalysis) {
      console.log(`[AI Trigger] First-time analysis for ${ideaId} — using comprehensive mode`);
    }

    const analysis = await analyzeIdea({
      id: ideaId,
      title: idea.title as string,
      body: idea.body as string,
      category: (idea.category as string) || "General",
      voteCount: voteRow?.total_votes || (idea.github_vote_count as number) || 0,
      commentBodies,
    });

    // Create tasks from suggested tasks. Cap at 8 total unfinished AI tasks
    // to keep the board manageable; users can still add their own manually.
    const MAX_OPEN_AI_TASKS = 8;
    const existingTasks = getTasksForIdea(ideaId);
    const openAiCount = existingTasks.filter(
      (t) => (t.source === "ai") && (t.status === "open" || t.status === "claimed" || t.status === "in-progress")
    ).length;
    let slotsAvailable = Math.max(0, MAX_OPEN_AI_TASKS - openAiCount);
    if (slotsAvailable === 0) {
      console.log(`[AI Trigger] Skipping task creation — already ${openAiCount} open AI tasks (cap: ${MAX_OPEN_AI_TASKS})`);
    } else {
      for (const suggested of analysis.suggestedTasks) {
        if (slotsAvailable <= 0) break;
        if (existingTasks.some((t) => t.title === suggested.title)) continue;
        createTask({
          ideaId,
          title: suggested.title,
          description: suggested.description,
          skillsNeeded: suggested.skillsNeeded,
          timeEstimate: suggested.timeEstimate,
          outputType: suggested.outputType,
          source: "ai",
          order: suggested.order,
        });
        slotsAvailable--;
      }
    }

    // Store open questions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((analysis as any).openQuestions) {
      try {
        db.prepare("UPDATE ideas SET ai_open_questions = ? WHERE id = ?")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .run(JSON.stringify((analysis as any).openQuestions), ideaId);
      } catch {
        // Column might not exist yet
      }
    }

    // Update analyzed timestamp
    try {
      db.prepare("UPDATE ideas SET ai_analyzed_at = datetime('now') WHERE id = ?")
        .run(ideaId);
    } catch {
      // Column might not exist yet
    }

    // Also store in ai_analyses table
    db.prepare(`
      INSERT INTO ai_analyses (idea_id, feasibility, feasibility_explanation, summary, full_analysis, model_used)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(idea_id) DO UPDATE SET
        feasibility = excluded.feasibility,
        feasibility_explanation = excluded.feasibility_explanation,
        summary = excluded.summary,
        full_analysis = excluded.full_analysis,
        model_used = excluded.model_used,
        generated_at = datetime('now')
    `).run(
      ideaId,
      analysis.feasibility,
      analysis.feasibilityExplanation,
      analysis.summary,
      JSON.stringify(analysis),
      analysis.modelUsed
    );

    logActivity({
      ideaId,
      eventType: "ai_analysis_completed",
      details: `Feasibility: ${analysis.feasibility}, ${analysis.suggestedTasks.length} tasks generated`,
    });

    console.log(`[AI Trigger] Analysis complete for ${ideaId}: ${analysis.feasibility}, ${analysis.suggestedTasks.length} tasks`);

    // After storing analysis, generate project document
    try {
      const { generateProjectDocument } = await import("./ai");
      const doc = await generateProjectDocument({
        id: ideaId,
        title: idea.title as string,
        body: idea.body as string,
        category: (idea.category as string) || "General",
        status: (idea.project_status as string) || "idea",
        analysis,
        comments: comments.map(c => ({ body: c.body, author: c.author_login || "Unknown" })),
        tasks: getTasksForIdea(ideaId).map(t => ({ title: t.title, status: t.status, description: t.description })),
        completedWork: getAcceptedWork(ideaId).map(w => ({ taskTitle: w.taskId, content: w.content })),
      });

      // Store the generated document
      db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(doc, ideaId);
      console.log(`[AI Trigger] Project document generated for ${ideaId}`);

      // Sync to Google Docs if configured
      try {
        const { isGoogleDocsConfigured, createProjectDoc, writeToDoc } = await import("./google-docs");
        if (isGoogleDocsConfigured()) {
          const existingDocUrl = idea.google_doc_url as string | null;
          if (existingDocUrl) {
            const docId = existingDocUrl.match(/\/d\/([\w-]+)/)?.[1];
            if (docId) await writeToDoc({ docId, content: doc });
          } else {
            const result = await createProjectDoc({
              title: idea.title as string,
              ideaId,
              initialContent: doc,
            });
            if (result) {
              db.prepare("UPDATE ideas SET google_doc_url = ? WHERE id = ?").run(result.docUrl, ideaId);
              console.log(`[AI Trigger] Google Doc created for ${ideaId}: ${result.docUrl}`);
            }
          }
        }
      } catch (e) {
        console.error(`[AI Trigger] Google Docs sync failed for ${ideaId}:`, e);
        try {
          const { logError } = await import("./logger");
          logError(`Google Docs sync failed for ${ideaId}: ${e}`, "ai-trigger");
        } catch { /* logger not available */ }
      }
    } catch (e) {
      console.error(`[AI Trigger] Doc generation failed for ${ideaId}:`, e);
      try {
        const { logError } = await import("./logger");
        logError(`Doc generation failed for ${ideaId}: ${e}`, "ai-trigger");
      } catch { /* logger not available */ }
    }
  } catch (e) {
    console.error(`[AI Trigger] Analysis failed for ${ideaId}:`, e);
    try {
      const { logError } = await import("./logger");
      logError(`Analysis failed for ${ideaId}: ${e}`, "ai-trigger");
    } catch { /* logger not available */ }
  }
}

async function suggestFollowUpTasks(ideaId: string, idea: Record<string, unknown>): Promise<void> {
  try {
    const existingTasks = getTasksForIdea(ideaId);
    const openTasks = existingTasks.filter((t) => t.status === "open");

    // Don't add more if there are already 5+ open tasks
    if (openTasks.length >= 5) {
      console.log(`[AI Trigger] ${openTasks.length} open tasks — skipping follow-up suggestions`);
      return;
    }

    const acceptedWork = getAcceptedWork(ideaId);
    if (acceptedWork.length === 0) {
      console.log(`[AI Trigger] No accepted work — skipping follow-up suggestions`);
      return;
    }

    const completedTasks = acceptedWork.map((w) => ({
      title: existingTasks.find((t) => t.id === w.taskId)?.title || "Unknown",
      submissionSummary: w.content.slice(0, 500),
    }));

    const newTasks = await suggestNextTasks(
      { title: idea.title as string, body: idea.body as string },
      completedTasks
    );

    for (const suggested of newTasks) {
      if (existingTasks.some((t) => t.title === suggested.title)) continue;
      createTask({
        ideaId,
        title: suggested.title,
        description: suggested.description,
        skillsNeeded: suggested.skillsNeeded,
        timeEstimate: suggested.timeEstimate,
        outputType: suggested.outputType,
        source: "ai",
        order: suggested.order,
      });
    }

    // Update analyzed timestamp
    const db = getDb();
    try {
      db.prepare("UPDATE ideas SET ai_analyzed_at = datetime('now') WHERE id = ?")
        .run(ideaId);
    } catch {
      // Column might not exist yet
    }

    console.log(`[AI Trigger] Generated ${newTasks.length} follow-up tasks for ${ideaId}`);
  } catch (e) {
    console.error(`[AI Trigger] Follow-up suggestion failed for ${ideaId}:`, e);
    try {
      const { logError } = await import("./logger");
      logError(`Follow-up suggestion failed for ${ideaId}: ${e}`, "ai-trigger");
    } catch { /* logger not available */ }
  }
}

function countCommentsSinceAnalysis(ideaId: string, analyzedAt: string | null): number {
  if (!analyzedAt) return 999; // Never analyzed → always enough
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM idea_comments WHERE idea_id = ? AND created_at > ?"
  ).get(ideaId, analyzedAt) as { count: number };
  return row.count;
}
