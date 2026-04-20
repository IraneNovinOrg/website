/**
 * AI Skills System
 * ----------------
 * Generic skill runner + typed skill functions that operationalize the
 * markdown playbooks in `_config/ai-skills/`. Every public function is
 * fire-and-forget (catches its own errors, never throws). Callers should
 * treat a `false` / `null` return as a no-op.
 *
 * Pattern mirrors `lib/ai/agent.ts::analyzeIdeaForAgent` and uses the
 * existing `callAI()` router from `lib/ai/router.ts`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { callAI } from "./router";
import { loadSkill, loadSystemPrompt } from "./playbooks";
import { logError, logInfo, logWarn } from "../logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillResult<T = unknown> {
  raw: string;
  parsed?: T;
  model: string;
}

export interface RunSkillOptions {
  skillName: string;
  contextPrompt: string;
  systemAppend?: string;
  ideaId?: string;
  taskType?: string;
  maxTokens?: number;
  expectJson?: boolean;
}

export interface ExpertMatch {
  userId: string;
  score: number;
  matchedSkills?: string[];
  reason: string;
}

// ─── ID / Cooldown helpers ──────────────────────────────────────────────────

function genId(prefix = ""): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * In-memory cooldown map — keyed by `skill:entityId`.
 * Prevents re-running the same skill for the same entity too often.
 */
const cooldownMap = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

function isCoolingDown(key: string, ms = DEFAULT_COOLDOWN_MS): boolean {
  const last = cooldownMap.get(key);
  if (!last) return false;
  return Date.now() - last < ms;
}

function markRun(key: string): void {
  cooldownMap.set(key, Date.now());
  // Keep the map small — clean entries older than 2× cooldown
  if (cooldownMap.size > 5000) {
    const cutoff = Date.now() - DEFAULT_COOLDOWN_MS * 2;
    for (const [k, t] of cooldownMap) if (t < cutoff) cooldownMap.delete(k);
  }
}

export function checkCooldown(skill: string, entityId: string, ms?: number): boolean {
  return !isCoolingDown(`${skill}:${entityId}`, ms);
}

// ─── JSON extraction ────────────────────────────────────────────────────────

/** Known playbook template placeholder strings that indicate the JSON is a template, not real data. */
const TEMPLATE_MARKERS = [
  "green|yellow|orange|red",
  "A 2-3 sentence executive summary",
  "Explain specifically why",
  "Non-obvious insight about this idea",
  "A 3-5 sentence description",
  "Concise task title (5-10 words)",
  "DETAILED task brief (150-250 words)",
  "Related project name if any",
  "builds-on|complements|requires",
  "Specific risk with explanation",
  "Specific question that the community",
];

/** Returns true if the parsed JSON looks like a playbook template rather than real AI output. */
function isTemplateJson(parsed: unknown): boolean {
  const str = JSON.stringify(parsed);
  return TEMPLATE_MARKERS.some((marker) => str.includes(marker));
}

/**
 * Scan from position `start` (at an opening delimiter) and return the
 * end position (inclusive) of the matching closing delimiter, honoring
 * JSON string quoting/escapes. Returns -1 if no match.
 */
function findMatchingClose(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      // skip string literal
      i++;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === '"') { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Strip known trailing Codex artifacts like "tokens used\nN,NNN" that follow JSON. */
function stripTrailingArtifacts(text: string): string {
  // Common trailing noise Codex prints after the actual response
  return text
    .replace(/\n*tokens used\s*\n?\s*[\d,]+\s*$/i, "")
    .replace(/\n*codex\s*$/i, "")
    .trim();
}

export function extractJson<T = unknown>(raw: string): T | undefined {
  if (!raw) return undefined;

  const trimmed = stripTrailingArtifacts(raw.trim());

  // Helper: parse and reject templates
  const tryParse = (text: string): T | undefined => {
    try {
      const parsed = JSON.parse(text) as T;
      if (isTemplateJson(parsed)) return undefined; // reject playbook template
      return parsed;
    } catch { return undefined; }
  };

  // First, try to parse the whole trimmed string.
  const whole = tryParse(trimmed);
  if (whole !== undefined) return whole;

  // Try fenced code block ```json ... ```
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const fenced = tryParse(fence[1].trim());
    if (fenced !== undefined) return fenced;
  }

  // Scan each opening `{` in order — for each, find its matching `}`
  // using a string-aware scanner, then try to parse the slice.
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== "{") continue;
    const end = findMatchingClose(trimmed, i, "{", "}");
    if (end === -1) continue;
    const candidate = trimmed.slice(i, end + 1);
    const parsed = tryParse(candidate);
    if (parsed !== undefined) return parsed;
  }

  // Same for arrays
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== "[") continue;
    const end = findMatchingClose(trimmed, i, "[", "]");
    if (end === -1) continue;
    const candidate = trimmed.slice(i, end + 1);
    const parsed = tryParse(candidate);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

// ─── Generic skill runner ──────────────────────────────────────────────────

/**
 * Run a named skill end-to-end: load the playbook + skill markdown, call
 * the AI router, optionally parse JSON. Never throws — returns `null` on
 * failure and logs via the shared logger.
 */
export async function runSkill<T = unknown>(
  opts: RunSkillOptions
): Promise<SkillResult<T> | null> {
  const {
    skillName,
    contextPrompt,
    systemAppend,
    ideaId,
    taskType = "chat",
    maxTokens = 1200,
    expectJson = false,
  } = opts;

  let systemPrompt: string;
  let skillBody: string;

  try {
    systemPrompt = loadSystemPrompt();
  } catch (e) {
    logError(
      `[skills] failed to load system prompt: ${(e as Error).message}`,
      "ai-skills"
    );
    return null;
  }

  try {
    skillBody = loadSkill(skillName);
  } catch (e) {
    logError(
      `[skills] skill not found: ${skillName}: ${(e as Error).message}`,
      "ai-skills"
    );
    return null;
  }

  // Strip YAML frontmatter from the skill file if present
  const fm = skillBody.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const cleanSkill = fm ? fm[2].trim() : skillBody;

  const combinedSystem =
    systemPrompt.trim() +
    "\n\n---\n\n" +
    cleanSkill +
    (systemAppend ? "\n\n---\n\n" + systemAppend : "");

  try {
    logInfo(
      `[skills] running ${skillName}${ideaId ? ` (idea ${ideaId})` : ""}`,
      "ai-skills"
    );
    const { text, model } = await callAI(
      taskType,
      combinedSystem,
      contextPrompt,
      { maxTokens }
    );

    const result: SkillResult<T> = { raw: text, model };
    if (expectJson) {
      const parsed = extractJson<T>(text);
      if (parsed === undefined) {
        logWarn(
          `[skills] ${skillName} returned unparseable JSON (len=${text.length}). Start: ${text.slice(0, 300)}`,
          "ai-skills"
        );
      }
      result.parsed = parsed;
    }
    return result;
  } catch (e) {
    logError(
      `[skills] ${skillName} AI call failed: ${(e as Error).message}`,
      "ai-skills"
    );
    return null;
  }
}

// ─── Typed skills ──────────────────────────────────────────────────────────

const AI_AUTHOR = "AI Assistant";
const AI_AUTHOR_LOGIN_ALT = "ai-assistant";

/** Reply to a comment on an idea. Fire-and-forget. */
export async function replyToComment(commentId: string): Promise<boolean> {
  try {
    if (!commentId) return false;
    const cooldownKey = `reply-to-comment:${commentId}`;
    if (isCoolingDown(cooldownKey)) {
      logInfo(`[skills] reply-to-comment ${commentId} cooling down`, "ai-skills");
      return false;
    }

    const { getDb } = await import("../db/index");
    const db = getDb();

    const comment = db
      .prepare("SELECT * FROM idea_comments WHERE id = ?")
      .get(commentId) as any;
    if (!comment) {
      logWarn(`[skills] comment ${commentId} not found`, "ai-skills");
      return false;
    }

    const body: string = comment.body || "";
    const source: string = comment.source || "";
    const author: string = comment.author_login || "";

    // Skip AI/system replies and very short comments
    if (body.length < 30) { logInfo(`[skills] reply-to-comment skipped: comment too short (${body.length} chars)`, "ai-skills"); return false; }
    if (source === "ai") { logInfo(`[skills] reply-to-comment skipped: AI-authored comment`, "ai-skills"); return false; }
    if (author === AI_AUTHOR || author.toLowerCase() === AI_AUTHOR_LOGIN_ALT) { logInfo(`[skills] reply-to-comment skipped: AI author`, "ai-skills"); return false; }

    const idea = db
      .prepare("SELECT title, body, project_status, category FROM ideas WHERE id = ?")
      .get(comment.idea_id) as any;
    if (!idea) {
      logWarn(`[skills] idea ${comment.idea_id} not found`, "ai-skills");
      return false;
    }

    const siblings = db
      .prepare(
        `SELECT body, author_login FROM idea_comments
         WHERE idea_id = ? AND id != ?
         ORDER BY created_at DESC LIMIT 3`
      )
      .all(comment.idea_id, commentId) as any[];

    const contextPrompt = [
      `Project: ${idea.title}`,
      `Category: ${idea.category || "General"}`,
      `Status: ${idea.project_status || "idea"}`,
      "",
      `Project description:`,
      (idea.body || "").slice(0, 1500),
      "",
      `Recent sibling comments:`,
      siblings
        .map((s) => `- ${s.author_login || "Anonymous"}: ${(s.body || "").slice(0, 200)}`)
        .join("\n") || "(none)",
      "",
      `New comment from ${author || "Anonymous"}:`,
      body.slice(0, 3000),
      "",
      `Write a helpful 2-3 sentence reply, or respond exactly "NULL" if no reply is warranted.`,
    ].join("\n");

    const result = await runSkill({
      skillName: "reply-to-comment",
      contextPrompt,
      ideaId: comment.idea_id,
      taskType: "chat",
      maxTokens: 400,
      expectJson: false,
    });
    if (!result) return false;

    const reply = result.raw.trim();
    if (!reply || reply === "NULL" || reply.length < 10) {
      logInfo(`[skills] reply-to-comment declined (NULL/short)`, "ai-skills");
      markRun(cooldownKey);
      return false;
    }

    const newId = genId();
    db.prepare(
      `INSERT INTO idea_comments (id, idea_id, body, author_login, source, reply_to, created_at)
       VALUES (?, ?, ?, ?, 'ai', ?, datetime('now'))`
    ).run(newId, comment.idea_id, reply, AI_AUTHOR, commentId);

    const { logActivity } = await import("../db/index");
    logActivity({
      ideaId: comment.idea_id,
      eventType: "ai_comment_reply",
      actorName: AI_AUTHOR,
      details: `Reply to comment ${commentId} (${result.model}, ${reply.length} chars)`,
    });

    // Fire-and-forget: notify the original commenter about the AI reply.
    (async () => {
      try {
        const origUser = db
          .prepare(
            "SELECT id FROM users WHERE name = ? OR email = ? OR github_login = ? LIMIT 1"
          )
          .get(author, author, author) as any;
        if (!origUser?.id) return;
        const { sendNotification } = await import("../notifications/dispatcher");
        const { getNotificationTemplate } = await import(
          "../notifications/templates"
        );
        const tpl = getNotificationTemplate("ai_reply", "en", {
          preview: reply.slice(0, 140),
        });
        sendNotification({
          userId: origUser.id,
          type: "ai_reply",
          title: tpl.title,
          body: tpl.body,
          linkUrl: `/ideas/${comment.idea_id}#comment-${newId}`,
          channels: ["in_app", "telegram"],
          sourceType: "comment",
          sourceId: newId,
        }).catch(() => {});
      } catch {
        /* ignore — notifications are best-effort */
      }
    })();

    markRun(cooldownKey);
    return true;
  } catch (e) {
    logError(`[skills] replyToComment failed: ${(e as Error).message}`, "ai-skills");
    return false;
  }
}

/** Reply to a task note. Fire-and-forget. */
export async function replyToTaskNote(noteId: string): Promise<boolean> {
  try {
    if (!noteId) return false;
    const cooldownKey = `reply-to-task-note:${noteId}`;
    if (isCoolingDown(cooldownKey)) return false;

    const { getDb } = await import("../db/index");
    const db = getDb();

    const note = db
      .prepare("SELECT * FROM task_notes WHERE id = ?")
      .get(noteId) as any;
    if (!note) {
      logWarn(`[skills] task_note ${noteId} not found`, "ai-skills");
      return false;
    }

    const content: string = note.content || "";
    if (content.length < 30) return false;
    const author: string = note.author_name || "";
    if (author === AI_AUTHOR) return false;
    if ((note.author_id || "").toLowerCase() === AI_AUTHOR_LOGIN_ALT) return false;
    if ((note.author_id || "") === "ai-agent") return false;

    const task = db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(note.task_id) as any;
    if (!task) return false;

    const idea = db
      .prepare("SELECT title, body FROM ideas WHERE id = ?")
      .get(task.idea_id) as any;
    if (!idea) return false;

    const previous = db
      .prepare(
        `SELECT author_name, content FROM task_notes
         WHERE task_id = ? AND id != ?
         ORDER BY created_at DESC LIMIT 5`
      )
      .all(task.id, noteId) as any[];

    const contextPrompt = [
      `Project: ${idea.title}`,
      (idea.body || "").slice(0, 800),
      "",
      `Task: ${task.title}`,
      `Description: ${(task.description || "").slice(0, 800)}`,
      `Status: ${task.status}`,
      `Assigned to: ${task.assignee_name || "Unassigned"}`,
      "",
      `Previous notes on this task:`,
      previous
        .map((n) => `- ${n.author_name || "Anon"}: ${(n.content || "").slice(0, 200)}`)
        .join("\n") || "(none)",
      "",
      `New note from ${author || "Anonymous"}:`,
      content.slice(0, 3000),
      "",
      `Write a helpful 2-3 sentence reply, or respond exactly "NULL" if none needed.`,
    ].join("\n");

    const result = await runSkill({
      skillName: "reply-to-task-note",
      contextPrompt,
      ideaId: task.idea_id,
      taskType: "chat",
      maxTokens: 400,
      expectJson: false,
    });
    if (!result) return false;

    const reply = result.raw.trim();
    if (!reply || reply === "NULL" || reply.length < 10) {
      markRun(cooldownKey);
      return false;
    }

    const { addTaskNote } = await import("../ai-tasks");
    addTaskNote(task.id, "ai-agent", AI_AUTHOR, reply, noteId);

    const { logActivity } = await import("../db/index");
    logActivity({
      ideaId: task.idea_id,
      eventType: "ai_task_note_reply",
      actorName: AI_AUTHOR,
      details: `Reply to note ${noteId} on task ${task.id}`,
    });

    markRun(cooldownKey);
    return true;
  } catch (e) {
    logError(`[skills] replyToTaskNote failed: ${(e as Error).message}`, "ai-skills");
    return false;
  }
}

/** Run AI review on a submission and persist the verdict. */
export async function reviewSubmission(submissionId: string): Promise<boolean> {
  try {
    if (!submissionId) return false;
    const cooldownKey = `review-submission:${submissionId}`;
    if (isCoolingDown(cooldownKey)) return false;

    const { getDb } = await import("../db/index");
    const db = getDb();

    const sub = db
      .prepare("SELECT * FROM submissions WHERE id = ?")
      .get(submissionId) as any;
    if (!sub) {
      logWarn(`[skills] submission ${submissionId} not found`, "ai-skills");
      return false;
    }

    const task = db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(sub.task_id) as any;
    if (!task) return false;

    const contextPrompt = [
      `Task: ${task.title}`,
      `Description: ${(task.description || "").slice(0, 2000)}`,
      `Expected output type: ${task.output_type || "document"}`,
      `Skills needed: ${task.skills_needed || "[]"}`,
      "",
      `Submission type: ${sub.type}`,
      `Submitted content:`,
      (sub.content || "").slice(0, 8000),
      "",
      `Evaluate the submission per the review-submission rubric.`,
      `Respond with JSON only.`,
    ].join("\n");

    interface ReviewJson {
      decision?: string;
      confidence?: string;
      summary?: string;
      coversRequirements?: boolean;
      qualityAssessment?: string;
      missingPoints?: string[];
      suggestedImprovements?: string[];
      strengths?: string[];
      improvements?: string[];
      nextSteps?: string[];
    }

    const result = await runSkill<ReviewJson>({
      skillName: "review-submission",
      contextPrompt,
      ideaId: sub.idea_id,
      taskType: "review",
      maxTokens: 1800,
      expectJson: true,
    });
    if (!result || !result.parsed) return false;

    const parsed = result.parsed;

    // Normalize decision/confidence — skill may return either schema
    let decision: "approve" | "request_changes" | "reject" | null = null;
    const rawDecision = (parsed.decision || "").toLowerCase();
    if (["approve", "accept", "accepted"].includes(rawDecision)) decision = "approve";
    else if (
      ["request_changes", "needs-improvement", "needs_improvement", "changes-requested", "changes_requested"].includes(
        rawDecision
      )
    )
      decision = "request_changes";
    else if (["reject", "rejected"].includes(rawDecision)) decision = "reject";
    else if (typeof parsed.coversRequirements === "boolean") {
      decision = parsed.coversRequirements ? "approve" : "request_changes";
    }

    const confidence = (parsed.confidence || "medium").toLowerCase();

    // Persist using the AIReview shape the rest of the app expects
    const aiReview = {
      summary: parsed.summary || "",
      coversRequirements: decision === "approve",
      qualityAssessment: parsed.qualityAssessment || "",
      missingPoints: parsed.missingPoints || parsed.improvements || [],
      suggestedImprovements: parsed.suggestedImprovements || parsed.nextSteps || [],
      strengths: parsed.strengths || [],
      decision,
      confidence,
      generatedAt: new Date().toISOString(),
    };

    db.prepare(
      `UPDATE submissions
       SET ai_review = ?, ai_decision = ?, ai_confidence = ?
       WHERE id = ?`
    ).run(JSON.stringify(aiReview), decision || "request_changes", confidence, submissionId);

    const { logActivity } = await import("../db/index");
    logActivity({
      ideaId: sub.idea_id,
      eventType: "ai_submission_reviewed",
      actorName: AI_AUTHOR,
      details: `Submission ${submissionId}: ${decision || "unknown"} (${confidence})`,
    });

    markRun(cooldownKey);
    return true;
  } catch (e) {
    logError(`[skills] reviewSubmission failed: ${(e as Error).message}`, "ai-skills");
    return false;
  }
}

/** Suggest experts to invite for a given idea. Returns matches, does not notify. */
export async function matchExperts(
  ideaId: string
): Promise<{ matches: ExpertMatch[] } | null> {
  try {
    if (!ideaId) return null;
    const cooldownKey = `match-experts:${ideaId}`;
    if (isCoolingDown(cooldownKey)) return null;

    const { getDb } = await import("../db/index");
    const db = getDb();

    const idea = db
      .prepare("SELECT * FROM ideas WHERE id = ?")
      .get(ideaId) as any;
    if (!idea) return null;

    const users = db
      .prepare(
        `SELECT id, name, skills, categories, hours_per_week, bio
         FROM users
         WHERE is_public_profile = 1 AND (profile_completed = 1 OR bio IS NOT NULL)
         LIMIT 30`
      )
      .all() as any[];

    if (users.length === 0) {
      logInfo(`[skills] match-experts: no public profiles available`, "ai-skills");
      return { matches: [] };
    }

    const userList = users
      .map((u) => {
        let skills: string[] = [];
        let categories: string[] = [];
        try { skills = JSON.parse(u.skills || "[]"); } catch { /* ignore */ }
        try { categories = JSON.parse(u.categories || "[]"); } catch { /* ignore */ }
        return `- userId=${u.id}; name="${u.name || "Anon"}"; skills=${JSON.stringify(skills.slice(0, 12))}; categories=${JSON.stringify(categories.slice(0, 6))}; hoursPerWeek=${u.hours_per_week || "?"}`;
      })
      .join("\n");

    const contextPrompt = [
      `Project: ${idea.title}`,
      `Category: ${idea.category || "General"}`,
      `Status: ${idea.project_status || "idea"}`,
      "",
      `Description:`,
      (idea.body || "").slice(0, 2500),
      "",
      `Candidate experts (${users.length}):`,
      userList,
      "",
      `Return JSON: { "matches": [{"userId": "...", "score": 0.0-1.0, "matchedSkills": [...], "reason": "..."}] }`,
      `Score 1.0 means perfect fit; 0.6 is the minimum worth returning. Limit to top 8.`,
    ].join("\n");

    interface MatchJson { matches?: ExpertMatch[] }
    const result = await runSkill<MatchJson>({
      skillName: "match-experts",
      contextPrompt,
      systemAppend:
        "You are matching volunteer experts from the IranENovin diaspora to a project. " +
        "Only suggest users whose listed skills/categories materially overlap with the project needs.",
      ideaId,
      taskType: "analysis",
      maxTokens: 1500,
      expectJson: true,
    });
    if (!result || !result.parsed) return null;

    const raw = Array.isArray(result.parsed.matches) ? result.parsed.matches : [];
    const matches = raw
      .filter((m) => m && typeof m.userId === "string" && typeof m.score === "number")
      .filter((m) => m.score >= 0.6)
      .map((m) => ({
        userId: m.userId,
        score: m.score,
        matchedSkills: Array.isArray(m.matchedSkills) ? m.matchedSkills : [],
        reason: typeof m.reason === "string" ? m.reason : "",
      }));

    markRun(cooldownKey);
    return { matches };
  } catch (e) {
    logError(`[skills] matchExperts failed: ${(e as Error).message}`, "ai-skills");
    return null;
  }
}

/** Suggest improvements for a stale project and log them to activity_log. */
export async function suggestImprovements(ideaId: string): Promise<boolean> {
  try {
    if (!ideaId) return false;
    const cooldownKey = `suggest-improvements:${ideaId}`;
    if (isCoolingDown(cooldownKey)) return false;

    const { getDb } = await import("../db/index");
    const db = getDb();

    const idea = db
      .prepare("SELECT * FROM ideas WHERE id = ?")
      .get(ideaId) as any;
    if (!idea) return false;

    const tasks = db
      .prepare(
        `SELECT id, title, status, description, claimed_at, created_at,
            (julianday('now') - julianday(COALESCE(claimed_at, created_at))) as days_since
         FROM tasks WHERE idea_id = ?
         ORDER BY created_at DESC LIMIT 30`
      )
      .all(ideaId) as any[];

    const staleTasks = tasks.filter(
      (t) => (t.status === "claimed" || t.status === "in-progress") && t.days_since >= 7
    );

    const recentActivity = db
      .prepare(
        `SELECT event_type, actor_name, details, created_at FROM activity_log
         WHERE idea_id = ? ORDER BY created_at DESC LIMIT 10`
      )
      .all(ideaId) as any[];

    const recentComments = db
      .prepare(
        `SELECT body, author_login FROM idea_comments
         WHERE idea_id = ? ORDER BY created_at DESC LIMIT 5`
      )
      .all(ideaId) as any[];

    // Days since last activity
    const lastActivityRow = recentActivity[0];
    const daysSinceActivity = lastActivityRow?.created_at
      ? Math.round(
          (Date.now() - new Date(lastActivityRow.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 999;

    const contextPrompt = [
      `Project: ${idea.title}`,
      `Category: ${idea.category || "General"}`,
      `Status: ${idea.project_status || "idea"}`,
      `Days since last activity: ${daysSinceActivity}`,
      "",
      `Description:`,
      (idea.body || "").slice(0, 2000),
      "",
      `Tasks (${tasks.length} total, ${staleTasks.length} stale):`,
      tasks
        .slice(0, 15)
        .map(
          (t) => `- [${t.status}] ${t.title} (${Math.round(t.days_since)}d since update)`
        )
        .join("\n") || "(no tasks)",
      "",
      `Stale items:`,
      staleTasks
        .map((t) => `- ${t.id}: ${t.title} (claimed ${Math.round(t.days_since)}d ago)`)
        .join("\n") || "(none)",
      "",
      `Recent activity:`,
      recentActivity
        .map((a) => `- ${a.event_type} by ${a.actor_name || "?"}: ${(a.details || "").slice(0, 100)}`)
        .join("\n") || "(none)",
      "",
      `Recent comments:`,
      recentComments
        .map((c) => `- ${c.author_login || "?"}: ${(c.body || "").slice(0, 200)}`)
        .join("\n") || "(none)",
      "",
      `Return JSON: { "healthScore": "healthy|needs-attention|stale", "staleItems": [...], "suggestedTasks": [...], "recommendations": [...] }`,
    ].join("\n");

    interface ImprovementJson {
      healthScore?: string;
      staleItems?: Array<{ taskId?: string; reason?: string }>;
      suggestedTasks?: Array<Record<string, unknown>>;
      recommendations?: string[];
      suggestions?: string[];
      blockers?: string[];
      summary?: string;
    }

    const result = await runSkill<ImprovementJson>({
      skillName: "suggest-improvements",
      contextPrompt,
      ideaId,
      taskType: "analysis",
      maxTokens: 2200,
      expectJson: true,
    });
    if (!result || !result.parsed) return false;

    const parsed = result.parsed;
    const { logActivity } = await import("../db/index");

    const summary =
      parsed.summary ||
      `health=${parsed.healthScore || "unknown"}, ${parsed.suggestedTasks?.length || 0} suggestions`;

    // Store the full suggestion payload once
    logActivity({
      ideaId,
      eventType: "ai_suggestion",
      actorName: AI_AUTHOR,
      details: JSON.stringify({
        healthScore: parsed.healthScore,
        summary,
        staleItems: parsed.staleItems || [],
        suggestedTasks: parsed.suggestedTasks || [],
        recommendations: parsed.recommendations || parsed.suggestions || [],
        blockers: parsed.blockers || [],
      }).slice(0, 4000),
    });

    // Best-effort: stamp last suggestion time if column exists
    try {
      db.prepare("UPDATE ideas SET last_ai_suggestion_at = datetime('now') WHERE id = ?").run(ideaId);
    } catch { /* column may not exist */ }

    markRun(cooldownKey);
    return true;
  } catch (e) {
    logError(`[skills] suggestImprovements failed: ${(e as Error).message}`, "ai-skills");
    return false;
  }
}

/** Generate the weekly community digest as Markdown. */
export async function generateWeeklyDigest(): Promise<
  { content: string; summary: string } | null
> {
  try {
    const cooldownKey = `generate-weekly-digest:global`;
    if (isCoolingDown(cooldownKey, 6 * 24 * 60 * 60 * 1000)) return null; // 6 days

    const { getDb } = await import("../db/index");
    const db = getDb();

    const since = "datetime('now', '-7 days')";
    const newIdeas = db
      .prepare(
        `SELECT id, title, category,
            (github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0)) as total_votes
         FROM ideas i
         WHERE created_at > ${since}
         ORDER BY total_votes DESC LIMIT 15`
      )
      .all() as any[];

    const activatedProjects = db
      .prepare(
        `SELECT DISTINCT i.id, i.title
         FROM ideas i
         JOIN activity_log a ON a.idea_id = i.id
         WHERE a.event_type = 'project_activated' AND a.created_at > ${since}`
      )
      .all() as any[];

    const completedTasks = db
      .prepare(
        `SELECT t.id, t.title, t.idea_id, i.title as idea_title, t.assignee_name
         FROM tasks t LEFT JOIN ideas i ON i.id = t.idea_id
         WHERE t.status = 'accepted' AND EXISTS (
           SELECT 1 FROM submissions s WHERE s.task_id = t.id AND s.created_at > ${since}
         )
         LIMIT 30`
      )
      .all() as any[];

    const topVoted = db
      .prepare(
        `SELECT i.id, i.title, i.category,
            (i.github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0)) as total_votes
         FROM ideas i
         WHERE (i.project_status IS NULL OR i.project_status = 'idea')
         ORDER BY total_votes DESC LIMIT 10`
      )
      .all() as any[];

    const newContributors = db
      .prepare(
        `SELECT id, name FROM users WHERE created_at > ${since} AND is_public_profile = 1 LIMIT 20`
      )
      .all() as any[];

    const contextPrompt = [
      `## Weekly digest (last 7 days)`,
      "",
      `New ideas (${newIdeas.length}):`,
      newIdeas.map((i) => `- ${i.title} [${i.category || "General"}] — ${i.total_votes} votes`).join("\n") ||
        "(none)",
      "",
      `Projects activated (${activatedProjects.length}):`,
      activatedProjects.map((p) => `- ${p.title}`).join("\n") || "(none)",
      "",
      `Completed tasks (${completedTasks.length}):`,
      completedTasks
        .map((t) => `- "${t.title}" on "${t.idea_title || "?"}" by ${t.assignee_name || "?"}`)
        .join("\n") || "(none)",
      "",
      `Top-voted open ideas:`,
      topVoted.map((i) => `- ${i.title} — ${i.total_votes} votes`).join("\n") || "(none)",
      "",
      `New contributors (${newContributors.length}):`,
      newContributors.map((u) => `- ${u.name || "Anonymous"}`).join("\n") || "(none)",
      "",
      `Produce a friendly Markdown community digest (600-900 words).`,
      `Include:  overview, highlights, projects to rally around, community thanks, CTA.`,
      `Write in English. Match the tone of IranENovin system prompt.`,
      `At the END, on a line starting with "SUMMARY:" put a single-sentence TL;DR under 140 chars.`,
    ].join("\n");

    const result = await runSkill({
      skillName: "generate-weekly-digest",
      contextPrompt,
      taskType: "summary",
      maxTokens: 4000,
      expectJson: false,
    });
    if (!result) return null;

    const raw = result.raw.trim();
    // Extract summary line
    const match = raw.match(/SUMMARY:\s*(.+)$/im);
    const summary = match
      ? match[1].trim().slice(0, 280)
      : raw.split("\n").filter(Boolean)[0]?.slice(0, 280) || "Weekly digest";
    const content = match ? raw.replace(/SUMMARY:\s*.+$/im, "").trim() : raw;

    markRun(cooldownKey);
    return { content, summary };
  } catch (e) {
    logError(`[skills] generateWeeklyDigest failed: ${(e as Error).message}`, "ai-skills");
    return null;
  }
}

/** Regenerate the project document from accepted work + completed tasks. */
export async function updateDocument(ideaId: string): Promise<boolean> {
  try {
    if (!ideaId) return false;
    const cooldownKey = `update-document:${ideaId}`;
    if (isCoolingDown(cooldownKey)) return false;

    const { getDb } = await import("../db/index");
    const db = getDb();
    const { getTasksForIdea, getAcceptedWork } = await import("../ai-tasks");

    const idea = db
      .prepare("SELECT * FROM ideas WHERE id = ?")
      .get(ideaId) as any;
    if (!idea) return false;

    const tasks = getTasksForIdea(ideaId);
    const completedWork = getAcceptedWork(ideaId);

    const recentComments = db
      .prepare(
        `SELECT body, author_login FROM idea_comments
         WHERE idea_id = ? ORDER BY created_at DESC LIMIT 8`
      )
      .all(ideaId) as any[];

    const analysisRow = db
      .prepare("SELECT summary, feasibility, feasibility_explanation FROM ai_analyses WHERE idea_id = ?")
      .get(ideaId) as any;

    const contextPrompt = [
      `Project: ${idea.title}`,
      `Category: ${idea.category || "General"}`,
      `Status: ${idea.project_status || "idea"}`,
      "",
      `Original Idea:`,
      (idea.body || "").slice(0, 3000),
      "",
      `AI Analysis:`,
      analysisRow
        ? `Feasibility: ${analysisRow.feasibility}\n${analysisRow.feasibility_explanation || ""}\nSummary: ${analysisRow.summary || ""}`
        : "(no prior analysis)",
      "",
      `Community Discussion (last 8 comments):`,
      recentComments
        .map((c) => `- ${c.author_login || "?"}: ${(c.body || "").slice(0, 250)}`)
        .join("\n") || "(none)",
      "",
      `Tasks (${tasks.length}):`,
      tasks
        .slice(0, 20)
        .map((t) => `- [${t.status}] ${t.title}`)
        .join("\n") || "(none)",
      "",
      `Completed Work (${completedWork.length}):`,
      completedWork
        .slice(0, 10)
        .map((w, i) => `### ${i + 1}. ${w.taskId}\n${(w.content || "").slice(0, 800)}`)
        .join("\n\n") || "(none)",
      "",
      `Produce the full updated project document per the playbook. Output Markdown only — no code fences wrapping the whole response.`,
    ].join("\n");

    const result = await runSkill({
      skillName: "update-document",
      contextPrompt,
      ideaId,
      taskType: "summary",
      maxTokens: 4500,
      expectJson: false,
    });
    if (!result) return false;

    const doc = result.raw.trim();
    if (doc.length < 200) {
      logWarn(`[skills] update-document output too short (${doc.length})`, "ai-skills");
      return false;
    }

    db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(doc, ideaId);
    try {
      db.prepare("UPDATE ideas SET last_ai_document_at = datetime('now') WHERE id = ?").run(ideaId);
    } catch { /* column might not exist */ }

    const { logActivity } = await import("../db/index");
    logActivity({
      ideaId,
      eventType: "ai_document_updated",
      actorName: AI_AUTHOR,
      details: `Doc regenerated (${doc.length} chars, ${result.model})`,
    });

    markRun(cooldownKey);
    return true;
  } catch (e) {
    logError(`[skills] updateDocument failed: ${(e as Error).message}`, "ai-skills");
    return false;
  }
}
