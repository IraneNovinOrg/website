/**
 * AI Project Context Aggregator
 * ─────────────────────────────
 * Single source of "what does the AI need to know about this project?".
 * Every AI call (analysis, chat, document generation, admin-chat) should
 * start with `buildProjectContext(ideaId)` so the model has a complete,
 * consistent view of the project state.
 *
 * DDD-ish: this is the read-model for AI consumption. It is derived from
 * the primary stores (ideas, comments, tasks, submissions, help_offers,
 * activity_log) and can be freely re-computed — never cached in DB.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getDb } from "../db/index";

export interface ProjectCommentSummary {
  author: string;
  body: string;
  createdAt: string;
  source: string;
  isAiReply: boolean;
  replyTo?: string | null;
}

export interface ProjectTaskSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeName: string | null;
  skillsNeeded: string[];
  timeEstimate: string;
  source: string;
}

export interface ProjectMemberSummary {
  name: string;
  skills: string[];
  message: string;
  role?: string;
}

export interface ProjectContext {
  /** Core project facts */
  idea: {
    id: string;
    title: string;
    body: string;
    category: string;
    status: string; // project_status
    voteCount: number;
    createdAt: string;
    source: string;
    discussionUrl?: string;
    repoUrl?: string;
    leads: string[];
  };

  /** The maintained living document for this project */
  document: string;

  /** Previous AI analysis (if any) */
  lastAnalysis: {
    summary: string;
    feasibility: string;
    keyInsights: string[];
    risks: string[];
    generatedAt: string;
  } | null;

  /** Full comment history on the project */
  comments: ProjectCommentSummary[];

  /** All tasks with their current state */
  tasks: ProjectTaskSummary[];

  /** Recent task notes (per-task conversations) */
  taskNotes: Array<{
    taskTitle: string;
    author: string;
    content: string;
    createdAt: string;
  }>;

  /** Accepted submissions — what's actually been produced */
  acceptedWork: Array<{
    taskTitle: string;
    content: string;
    submittedBy: string;
    acceptedAt: string;
  }>;

  /** Pending/reviewing submissions */
  pendingSubmissions: Array<{
    taskTitle: string;
    submittedBy: string;
    preview: string;
  }>;

  /** Community members who offered help */
  members: ProjectMemberSummary[];

  /** Project docs + resources attached by admins */
  docs: Array<{ title: string; url?: string; content?: string }>;
  resources: Array<{ title: string; url: string; kind?: string }>;

  /** Recent activity log (what's been happening) */
  activityLog: Array<{
    eventType: string;
    actor: string;
    details: string;
    createdAt: string;
  }>;

  /** Open questions previously flagged by AI */
  openQuestions: string[];

  /** Numeric aggregates for quick stats */
  stats: {
    totalComments: number;
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    acceptedSubmissions: number;
    members: number;
  };
}

/**
 * Build the full project context. Pure read — no side effects.
 * Cheap enough (~10-20ms for active projects) to call per AI request.
 */
export function buildProjectContext(ideaId: string): ProjectContext | null {
  const db = getDb();

  const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as any;
  if (!idea) return null;

  // Comments
  const commentsRows = db
    .prepare(
      "SELECT body, author_login, created_at, source, is_ai_reply, reply_to FROM idea_comments WHERE idea_id = ? ORDER BY created_at ASC"
    )
    .all(ideaId) as any[];
  const comments: ProjectCommentSummary[] = commentsRows.map((c) => ({
    author: c.author_login || "Anonymous",
    body: (c.body || "").slice(0, 2000),
    createdAt: c.created_at || "",
    source: c.source || "local",
    isAiReply: c.is_ai_reply === 1 || c.source === "ai",
    replyTo: c.reply_to || null,
  }));

  // Tasks
  const taskRows = db
    .prepare(
      "SELECT id, title, description, status, assignee_name, skills_needed, time_estimate, source FROM tasks WHERE idea_id = ?"
    )
    .all(ideaId) as any[];
  const tasks: ProjectTaskSummary[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title || "",
    description: (t.description || "").slice(0, 1500),
    status: t.status || "open",
    assigneeName: t.assignee_name || null,
    skillsNeeded: safeJsonArray(t.skills_needed),
    timeEstimate: t.time_estimate || "",
    source: t.source || "user",
  }));

  // Task notes (last 5 per task max)
  const taskIds = tasks.map((t) => t.id);
  let taskNotes: ProjectContext["taskNotes"] = [];
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => "?").join(",");
    const noteRows = db
      .prepare(
        `SELECT tn.task_id, tn.author_name, tn.content, tn.created_at, t.title as task_title
         FROM task_notes tn JOIN tasks t ON t.id = tn.task_id
         WHERE tn.task_id IN (${placeholders})
         ORDER BY tn.created_at DESC
         LIMIT 40`
      )
      .all(...taskIds) as any[];
    taskNotes = noteRows.map((n) => ({
      taskTitle: n.task_title || "",
      author: n.author_name || "Anonymous",
      content: (n.content || "").slice(0, 500),
      createdAt: n.created_at || "",
    }));
  }

  // Submissions: accepted + pending
  const acceptedWork: ProjectContext["acceptedWork"] = [];
  const pendingSubmissions: ProjectContext["pendingSubmissions"] = [];
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => "?").join(",");
    const subRows = db
      .prepare(
        `SELECT s.*, t.title as task_title
         FROM submissions s JOIN tasks t ON t.id = s.task_id
         WHERE s.task_id IN (${placeholders})
         ORDER BY s.created_at DESC`
      )
      .all(...taskIds) as any[];
    for (const s of subRows) {
      if (s.status === "accepted") {
        acceptedWork.push({
          taskTitle: s.task_title || "",
          content: (s.content || "").slice(0, 2000),
          submittedBy: s.submitted_by_name || "Anonymous",
          acceptedAt: s.reviewed_at || s.created_at || "",
        });
      } else if (s.status === "submitted" || s.status === "reviewing") {
        pendingSubmissions.push({
          taskTitle: s.task_title || "",
          submittedBy: s.submitted_by_name || "Anonymous",
          preview: (s.content || "").slice(0, 400),
        });
      }
    }
  }

  // Help offers (members)
  const offerRows = db
    .prepare(
      "SELECT name, skills, message FROM help_offers WHERE idea_id = ? ORDER BY created_at DESC"
    )
    .all(ideaId) as any[];
  const members: ProjectMemberSummary[] = offerRows.map((o) => ({
    name: o.name || "Anonymous",
    skills: safeJsonArray(o.skills),
    message: (o.message || "").slice(0, 300),
  }));

  // Docs & resources (JSON arrays on the idea row)
  const docs = safeJsonArray<any>(idea.project_docs).map((d) => ({
    title: d.title || "",
    url: d.url || undefined,
    content: d.content ? String(d.content).slice(0, 1500) : undefined,
  }));
  const resources = safeJsonArray<any>(idea.project_resources).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    kind: r.kind || undefined,
  }));

  // Activity log (last 25 events)
  const activityRows = db
    .prepare(
      "SELECT event_type, actor_name, details, created_at FROM activity_log WHERE idea_id = ? ORDER BY created_at DESC LIMIT 25"
    )
    .all(ideaId) as any[];
  const activityLog = activityRows.map((a) => ({
    eventType: a.event_type || "",
    actor: a.actor_name || "System",
    details: (a.details || "").slice(0, 300),
    createdAt: a.created_at || "",
  }));

  // Previous AI analysis
  const analysisRow = db
    .prepare("SELECT * FROM ai_analyses WHERE idea_id = ? ORDER BY generated_at DESC LIMIT 1")
    .get(ideaId) as any;
  let lastAnalysis: ProjectContext["lastAnalysis"] = null;
  if (analysisRow) {
    let full: any = null;
    try { full = analysisRow.full_analysis ? JSON.parse(analysisRow.full_analysis) : null; } catch { /* ignore */ }
    lastAnalysis = {
      summary: analysisRow.summary || full?.summary || "",
      feasibility: analysisRow.feasibility || full?.feasibility || "",
      keyInsights: Array.isArray(full?.keyInsights) ? full.keyInsights : [],
      risks: Array.isArray(full?.risks) ? full.risks : [],
      generatedAt: analysisRow.generated_at || "",
    };
  }

  const openQuestions = safeJsonArray<string>(idea.ai_open_questions);

  const stats = {
    totalComments: comments.length,
    totalTasks: tasks.length,
    openTasks: tasks.filter((t) => t.status === "open" || t.status === "claimed" || t.status === "in-progress").length,
    completedTasks: tasks.filter((t) => t.status === "accepted" || t.status === "completed").length,
    acceptedSubmissions: acceptedWork.length,
    members: members.length,
  };

  return {
    idea: {
      id: idea.id,
      title: idea.title || "",
      body: idea.body || "",
      category: idea.category || "General",
      status: idea.project_status || "idea",
      voteCount: Number(idea.github_vote_count) || 0,
      createdAt: idea.created_at || "",
      source: idea.source || "local",
      discussionUrl: idea.discussion_url || idea.github_discussion_url || undefined,
      repoUrl: idea.github_repo_url || undefined,
      leads: safeJsonArray<string>(idea.project_leads),
    },
    document: idea.project_content || "",
    lastAnalysis,
    comments,
    tasks,
    taskNotes,
    acceptedWork,
    pendingSubmissions,
    members,
    docs,
    resources,
    activityLog,
    openQuestions,
    stats,
  };
}

/**
 * Render the project context as a token-budgeted prompt string for AI consumption.
 * Use `maxChars` to cap size (default 10k chars ≈ ~2500 tokens).
 */
export function renderContextAsPrompt(
  ctx: ProjectContext,
  opts: { maxChars?: number; include?: Array<keyof ProjectContext> } = {}
): string {
  const maxChars = opts.maxChars || 10000;
  const parts: string[] = [];

  parts.push(`# PROJECT: ${ctx.idea.title}`);
  parts.push(`Category: ${ctx.idea.category}    Status: ${ctx.idea.status}    Votes: ${ctx.idea.voteCount}`);
  if (ctx.idea.leads.length > 0) parts.push(`Leads: ${ctx.idea.leads.join(", ")}`);
  parts.push("");
  parts.push("## IDEA DESCRIPTION");
  parts.push(ctx.idea.body.slice(0, 3000));
  parts.push("");

  if (ctx.lastAnalysis) {
    parts.push("## PREVIOUS AI ANALYSIS");
    parts.push(`Summary: ${ctx.lastAnalysis.summary}`);
    parts.push(`Feasibility: ${ctx.lastAnalysis.feasibility}`);
    if (ctx.lastAnalysis.keyInsights.length) parts.push(`Key insights: ${ctx.lastAnalysis.keyInsights.join(" | ")}`);
    if (ctx.lastAnalysis.risks.length) parts.push(`Risks: ${ctx.lastAnalysis.risks.join(" | ")}`);
    parts.push("");
  }

  if (ctx.document) {
    parts.push("## PROJECT DOCUMENT (current)");
    parts.push(ctx.document.slice(0, 3000));
    parts.push("");
  }

  parts.push(`## STATS`);
  parts.push(`${ctx.stats.totalTasks} tasks (${ctx.stats.openTasks} open, ${ctx.stats.completedTasks} done) · ${ctx.stats.totalComments} comments · ${ctx.stats.members} members · ${ctx.stats.acceptedSubmissions} accepted submissions`);
  parts.push("");

  if (ctx.tasks.length > 0) {
    parts.push("## TASKS");
    for (const t of ctx.tasks.slice(0, 20)) {
      parts.push(`- [${t.status}] ${t.title}${t.assigneeName ? ` (assignee: ${t.assigneeName})` : ""}${t.timeEstimate ? ` — ${t.timeEstimate}` : ""}`);
    }
    parts.push("");
  }

  if (ctx.members.length > 0) {
    parts.push("## MEMBERS");
    for (const m of ctx.members.slice(0, 15)) {
      parts.push(`- ${m.name}${m.skills.length ? ` [${m.skills.join(", ")}]` : ""}`);
    }
    parts.push("");
  }

  if (ctx.comments.length > 0) {
    parts.push(`## COMMUNITY DISCUSSION (${ctx.comments.length} comments)`);
    // Include first 10 and last 10 to keep context fresh but not miss early framing
    const early = ctx.comments.slice(0, 10);
    const late = ctx.comments.length > 20 ? ctx.comments.slice(-10) : [];
    for (const c of early) {
      parts.push(`- ${c.author}${c.isAiReply ? " [AI]" : ""}: ${c.body.slice(0, 400)}`);
    }
    if (late.length) parts.push("...");
    for (const c of late) {
      parts.push(`- ${c.author}${c.isAiReply ? " [AI]" : ""}: ${c.body.slice(0, 400)}`);
    }
    parts.push("");
  }

  if (ctx.acceptedWork.length > 0) {
    parts.push("## ACCEPTED WORK");
    for (const w of ctx.acceptedWork.slice(0, 10)) {
      parts.push(`### ${w.taskTitle} — by ${w.submittedBy}`);
      parts.push(w.content.slice(0, 800));
    }
    parts.push("");
  }

  if (ctx.pendingSubmissions.length > 0) {
    parts.push("## PENDING SUBMISSIONS");
    for (const s of ctx.pendingSubmissions.slice(0, 5)) {
      parts.push(`- ${s.taskTitle} by ${s.submittedBy}: ${s.preview}`);
    }
    parts.push("");
  }

  if (ctx.openQuestions.length > 0) {
    parts.push("## OPEN QUESTIONS");
    for (const q of ctx.openQuestions) parts.push(`- ${q}`);
    parts.push("");
  }

  if (ctx.docs.length > 0 || ctx.resources.length > 0) {
    parts.push("## DOCS & RESOURCES");
    for (const d of ctx.docs) parts.push(`- Doc: ${d.title}${d.url ? ` (${d.url})` : ""}`);
    for (const r of ctx.resources) parts.push(`- Resource: ${r.title} — ${r.url}`);
    parts.push("");
  }

  const joined = parts.join("\n");
  return joined.length > maxChars ? joined.slice(0, maxChars) + "\n…[truncated]" : joined;
}

function safeJsonArray<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
