/**
 * Reusable agent cycle — used by both the CLI script and the
 * Next.js instrumentation background timer.
 *
 * CRITICAL: This runs on the main Node.js thread alongside HTTP request handling.
 * Every operation must yield to the event loop (via `yieldToEventLoop()`) so that
 * HTTP requests are never blocked. AI calls are inherently async (network I/O)
 * so they don't block, but we add explicit yields between DB operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Yield to the event loop so HTTP requests can be processed */
function yieldToEventLoop() {
  return new Promise((r) => setImmediate(r));
}

export async function runAgentCycle() {
  const { logInfo } = await import("../logger");

  function log(msg: string) {
    logInfo(msg, "agent-cycle");
  }

  log("=== Agent cycle starting ===");

  // Load agent config
  let maxAnalyses = 2;
  let maxReviews = 3;
  let autoActivateMinVotes = 5;
  let analyzeMinVotes = 0;
  try {
    const { existsSync, readFileSync } = await import("fs");
    const { join } = await import("path");
    const configPath = join(process.cwd(), "_config", "agent.json");
    if (existsSync(configPath)) {
      const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
      maxAnalyses = Math.min(parsed.maxAnalysesPerCycle ?? 2, 5);
      maxReviews = Math.min(parsed.maxReviewsPerCycle ?? 3, 10);
      autoActivateMinVotes = parsed.autoActivateMinVotes ?? 5;
      analyzeMinVotes = parsed.analyzeMinVotes ?? 0;
    }
  } catch { /* use defaults */ }

  await yieldToEventLoop();

  // ── 1. GitHub sync ─────────────────────────────────────────────────────
  try {
    const { runFullSync } = await import("../sync/index");
    await runFullSync();
    log("GitHub sync complete");
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Sync failed: ${e}`, "agent-cycle");
  }

  await yieldToEventLoop();

  const { getDb } = await import("../db/index");
  const db = getDb();

  // ── 2. Auto-activate ideas with 5+ votes ──────────────────────────────
  try {
    const eligible = db.prepare(`
      SELECT i.id, i.title,
        (i.github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0)) as total_votes
      FROM ideas i
      WHERE (i.project_status = 'idea' OR i.project_status IS NULL)
        AND (i.github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0)) >= ${autoActivateMinVotes}
    `).all() as any[];

    for (const idea of eligible) {
      db.prepare("UPDATE ideas SET project_status = 'active' WHERE id = ?").run(idea.id);
      log(`  Activated: "${idea.title}" (${idea.total_votes} votes)`);

      // Channel post: milestone reached (fire-and-forget)
      import("../telegram/channel").then(({ postIdeaMilestone }) => {
        postIdeaMilestone({
          id: String(idea.id),
          title: idea.title,
          voteCount: idea.total_votes || autoActivateMinVotes,
          milestone: 'Activated — enough community support to become a project!',
        }).catch(console.error);
      }).catch(() => {});
    }
    if (eligible.length) log(`Activated ${eligible.length} ideas`);
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Auto-activation failed: ${e}`, "agent-cycle");
  }

  await yieldToEventLoop();

  // ── 3. Analyze unanalyzed ideas (max per cycle, yield between each) ───
  try {
    const { handleProjectEvent } = await import("../ai-trigger");
    const unanalyzed = db.prepare(`
      SELECT i.id, i.title, i.category,
        (i.github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0)) as total_votes
      FROM ideas i WHERE i.ai_analyzed_at IS NULL
        AND (i.github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0)) >= ${analyzeMinVotes}
      ORDER BY total_votes DESC LIMIT ?
    `).all(maxAnalyses + 2) as any[]; // fetch a few extra in case some fail

    let analyzed = 0;
    for (const idea of unanalyzed) {
      if (analyzed >= maxAnalyses) break;
      log(`  Analyzing: "${idea.title}" [${idea.category || "General"}]`);
      try {
        await handleProjectEvent(idea.id, "admin_request");
        analyzed++;
        log(`  ✓ Done: ${idea.id}`);
      } catch (e) {
        log(`  ✗ Failed: ${idea.id}: ${e}`);
      }
      // Yield between analyses so HTTP requests can flow
      await yieldToEventLoop();
      await sleep(3000);
    }

    const remaining = (db.prepare("SELECT COUNT(*) as c FROM ideas WHERE ai_analyzed_at IS NULL").get() as any).c;
    log(`Analyzed ${analyzed}. ${remaining} remaining.`);
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Analysis failed: ${e}`, "agent-cycle");
  }

  await yieldToEventLoop();

  // ── 3b. Auto-generate project documents for active analyzed ideas ────
  // Generates the project document for projects that have an analysis but
  // no doc yet, or whose doc is older than 7 days. Skips otherwise.
  try {
    const docsNeeded = db.prepare(`
      SELECT i.id, i.title, i.project_content, i.last_ai_document_at
      FROM ideas i
      INNER JOIN ai_analyses a ON a.idea_id = i.id
      WHERE i.project_status = 'active'
        AND (
          i.project_content IS NULL
          OR i.project_content = ''
          OR i.last_ai_document_at IS NULL
          OR julianday('now') - julianday(i.last_ai_document_at) > 7
        )
      ORDER BY COALESCE(i.last_ai_document_at, '1970') ASC
      LIMIT 2
    `).all() as any[];

    if (docsNeeded.length) {
      const { updateDocument } = await import("../ai/skills");
      for (const idea of docsNeeded) {
        log(`  Auto-generating doc: "${idea.title}"`);
        try {
          const ok = await updateDocument(idea.id);
          log(`  ${ok ? "✓" : "✗"} Doc for ${idea.id}`);
        } catch (e) {
          log(`  ✗ Doc failed for ${idea.id}: ${e}`);
        }
        await yieldToEventLoop();
        await sleep(3000);
      }
    }
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Auto-doc generation failed: ${e}`, "agent-cycle");
  }

  await yieldToEventLoop();

  // ── 4. Review pending submissions ─────────────────────────────────────
  try {
    const subs = db.prepare(
      "SELECT id, task_id as taskId, status, content, type FROM submissions WHERE status = 'pending' AND ai_review IS NULL LIMIT ?"
    ).all(maxReviews) as any[];

    if (subs.length) {
      const { reviewSubmission } = await import("../ai");
      const { getTaskById, setAIReview } = await import("../ai-tasks");

      for (const sub of subs) {
        const task = getTaskById(sub.taskId);
        if (!task) continue;
        try {
          const review = await reviewSubmission(
            { title: task.title, description: task.description, outputType: task.outputType },
            { content: sub.content, type: sub.type }
          );
          setAIReview(sub.id, review);
          log(`  ✓ Reviewed: ${sub.id}`);
        } catch (e) {
          log(`  ✗ Review failed: ${sub.id}: ${e}`);
        }
        await yieldToEventLoop();
      }
    }
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Submission review failed: ${e}`, "agent-cycle");
  }

  // Skip expert matching for now — it's low priority and adds latency

  await yieldToEventLoop();

  // ── 5. Suggest improvements for stale active projects ──────────────────
  try {
    const stale = db.prepare(`
      SELECT i.id, i.title
      FROM ideas i
      WHERE i.project_status = 'active'
        AND (
          i.last_ai_suggestion_at IS NULL
          OR julianday('now') - julianday(i.last_ai_suggestion_at) > 3
        )
        AND (
          SELECT MAX(created_at) FROM activity_log a WHERE a.idea_id = i.id
        ) IS NOT NULL
        AND julianday('now') - julianday(
          (SELECT MAX(created_at) FROM activity_log a WHERE a.idea_id = i.id)
        ) > 7
      ORDER BY COALESCE(i.last_ai_suggestion_at, '1970') ASC
      LIMIT 2
    `).all() as any[];

    if (stale.length) {
      const { suggestImprovements } = await import("../ai/skills");
      for (const idea of stale) {
        log(`  Suggesting improvements: "${idea.title}"`);
        try {
          const ok = await suggestImprovements(idea.id);
          log(`  ${ok ? "✓" : "✗"} Suggestions for ${idea.id}`);
        } catch (e) {
          log(`  ✗ Suggest failed for ${idea.id}: ${e}`);
        }
        await yieldToEventLoop();
        await sleep(2000);
      }
    }
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Suggest improvements failed: ${e}`, "agent-cycle");
  }

  await yieldToEventLoop();

  // ── 6. Weekly digest (Saturdays only, once per 6 days) ────────────────
  try {
    const isSaturday = new Date().getDay() === 6;
    if (isSaturday) {
      const recent = db.prepare(`
        SELECT created_at FROM activity_log
        WHERE event_type = 'weekly_digest'
        ORDER BY created_at DESC LIMIT 1
      `).get() as { created_at?: string } | undefined;

      const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const recentMs = recent?.created_at ? new Date(recent.created_at).getTime() : 0;

      if (recentMs < sixDaysAgo) {
        log("  Generating weekly digest...");
        const { generateWeeklyDigest } = await import("../ai/skills");
        const digest = await generateWeeklyDigest();
        if (digest) {
          const { logActivity: la } = await import("../db/index");
          la({
            eventType: "weekly_digest",
            actorName: "AI Assistant",
            details: JSON.stringify({
              summary: digest.summary,
              content: digest.content,
              generatedAt: new Date().toISOString(),
            }),
          });
          log(`  ✓ Weekly digest generated (${digest.content.length} chars)`);

          // Channel post: weekly digest (fire-and-forget)
          // Gather stats from DB for the Telegram digest
          try {
            const totalIdeas = (db.prepare("SELECT COUNT(*) as c FROM ideas").get() as any)?.c || 0;
            const newIdeas = (db.prepare("SELECT COUNT(*) as c FROM ideas WHERE created_at > datetime('now', '-7 days')").get() as any)?.c || 0;
            const activeProjects = (db.prepare("SELECT COUNT(*) as c FROM ideas WHERE project_status = 'active'").get() as any)?.c || 0;
            const tasksCompleted = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'accepted' AND created_at > datetime('now', '-7 days')").get() as any)?.c || 0;
            const newContributors = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now', '-7 days')").get() as any)?.c || 0;

            import("../telegram/channel").then(({ postWeeklyDigest: postDigest }) => {
              postDigest({
                totalIdeas,
                newIdeas,
                activeProjects,
                tasksCompleted,
                newContributors,
              }).catch(console.error);
            }).catch(() => {});
          } catch (statsErr) {
            log(`  ✗ Failed to gather digest stats for Telegram: ${statsErr}`);
          }
        } else {
          log("  ✗ Weekly digest generation returned null");
        }
      } else {
        log("  Weekly digest already generated within last 6 days — skipping");
      }
    }
  } catch (e) {
    const { logError: le } = await import("../logger");
    le(`Weekly digest failed: ${e}`, "agent-cycle");
  }

  log("=== Agent cycle complete ===");
}
