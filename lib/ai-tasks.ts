/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import type { AIReview } from "./ai";
import { getDb } from "./db/index";

const KNOWLEDGE_DIR = path.join(process.cwd(), "_data", "project-knowledge");

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskPriority = "urgent" | "high" | "medium" | "low";

export interface Task {
  id: string;
  ideaId: string;
  title: string;
  description: string;
  skillsNeeded: string[];
  timeEstimate: string;
  outputType: "document" | "code" | "design" | "data" | "analysis";
  status: "open" | "claimed" | "in-progress" | "submitted" | "accepted" | "changes-requested";
  assigneeId: string | null;
  assigneeName: string | null;
  claimedAt: string | null;
  dueDate: string | null;
  source: "ai" | "user" | "lead";
  parentTaskId: string | null;
  order: number;
  notes: TaskNote[];
  createdAt: string;
  // Workspace V2 additions (optional — legacy callers ignore these)
  priority?: TaskPriority;
  labels?: string[];
  richDescription?: unknown;
  sprintId?: string | null;
  storyPoints?: number | null;
  startDate?: string | null;
}

export interface TaskNote {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  replyTo?: string | null;
  editedAt?: string | null;
}

export interface SubmissionAttachment {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface Submission {
  id: string;
  taskId: string;
  ideaId: string;
  authorId: string;
  authorName: string;
  type: "link" | "document" | "inline";
  content: string;
  attachments?: SubmissionAttachment[];
  aiReview: AIReview | null;
  aiDecision?: string | null;
  aiConfidence?: string | null;
  leadReview: LeadReview | null;
  status: "pending-review" | "accepted" | "changes-requested";
  createdAt: string;
}

export interface LeadReview {
  decision: "accepted" | "changes-requested";
  note: string | null;
  reviewedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function rowToTask(row: any, preloadedNotes?: TaskNote[]): Task {
  const notes =
    preloadedNotes ??
    (getDb()
      .prepare("SELECT id, author_id, author_name, content, created_at, reply_to, edited_at FROM task_notes WHERE task_id = ? ORDER BY created_at ASC")
      .all(row.id) as any[])
      .map((n: any) => ({
        id: n.id,
        authorId: n.author_id,
        authorName: n.author_name,
        content: n.content,
        createdAt: n.created_at,
        replyTo: n.reply_to || null,
        editedAt: n.edited_at || null,
      }));

  let labels: string[] = [];
  try {
    if (row.labels) {
      const parsed = JSON.parse(row.labels);
      if (Array.isArray(parsed)) labels = parsed.filter((l) => typeof l === "string");
    }
  } catch {
    labels = [];
  }

  let richDescription: unknown = null;
  if (row.rich_description) {
    try {
      richDescription = JSON.parse(row.rich_description);
    } catch {
      richDescription = null;
    }
  }

  return {
    id: row.id,
    ideaId: row.idea_id,
    title: row.title,
    description: row.description,
    skillsNeeded: JSON.parse(row.skills_needed || "[]"),
    timeEstimate: row.time_estimate || "",
    outputType: row.output_type || "document",
    status: row.status || "open",
    assigneeId: row.assignee_id || null,
    assigneeName: row.assignee_name || null,
    claimedAt: row.claimed_at || null,
    dueDate: row.due_date || null,
    source: row.source || "ai",
    parentTaskId: row.parent_task_id || null,
    order: row.task_order ?? 0,
    notes,
    createdAt: row.created_at,
    priority: (row.priority as TaskPriority) || "medium",
    labels,
    richDescription,
    sprintId: row.sprint_id || null,
    storyPoints: row.story_points ?? null,
    startDate: row.start_date || null,
  };
}

function rowToSubmission(row: any): Submission {
  let attachments: SubmissionAttachment[] = [];
  if (row.attachments) {
    try {
      const parsed = JSON.parse(row.attachments);
      if (Array.isArray(parsed)) attachments = parsed;
    } catch {
      attachments = [];
    }
  }
  return {
    id: row.id,
    taskId: row.task_id,
    ideaId: row.idea_id,
    authorId: row.author_id,
    authorName: row.author_name || "",
    type: row.type || "inline",
    content: row.content,
    attachments,
    aiReview: row.ai_review ? JSON.parse(row.ai_review) : null,
    aiDecision: row.ai_decision || null,
    aiConfidence: row.ai_confidence || null,
    leadReview: row.accepted_by
      ? { decision: row.status === "accepted" ? "accepted" : "changes-requested", note: null, reviewedAt: "" }
      : null,
    status: row.status === "pending" ? "pending-review" : row.status || "pending-review",
    createdAt: row.created_at,
  };
}

// ─── Task CRUD (SQLite) ─────────────────────────────────────────────────────

export function getTasksForIdea(ideaId: string): Task[] {
  const rows = getDb()
    .prepare("SELECT * FROM tasks WHERE idea_id = ? ORDER BY task_order ASC, created_at ASC")
    .all(ideaId) as any[];
  if (rows.length === 0) return [];

  // Batch-load all notes for these tasks in one query to avoid N+1
  const taskIds = rows.map((r) => r.id);
  const placeholders = taskIds.map(() => "?").join(",");
  const allNotes = getDb()
    .prepare(
      `SELECT id, task_id, author_id, author_name, content, created_at, reply_to, edited_at
       FROM task_notes
       WHERE task_id IN (${placeholders})
       ORDER BY created_at ASC`
    )
    .all(...taskIds) as any[];

  const notesByTask = new Map<string, TaskNote[]>();
  for (const n of allNotes) {
    const arr = notesByTask.get(n.task_id) || [];
    arr.push({
      id: n.id,
      authorId: n.author_id,
      authorName: n.author_name,
      content: n.content,
      createdAt: n.created_at,
      replyTo: n.reply_to || null,
      editedAt: n.edited_at || null,
    });
    notesByTask.set(n.task_id, arr);
  }

  return rows.map((row) => rowToTask(row, notesByTask.get(row.id) || []));
}

export function getTaskById(taskId: string): Task | null {
  const row = getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
  return row ? rowToTask(row) : null;
}

export function createTask(params: {
  ideaId: string;
  title: string;
  description: string;
  skillsNeeded: string[];
  timeEstimate: string;
  outputType: Task["outputType"];
  source: Task["source"];
  parentTaskId?: string;
  order?: number;
}): Task {
  const db = getDb();
  const id = genId("task");
  const order = params.order ?? (db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE idea_id = ?"
  ).get(params.ideaId) as any).c;

  db.prepare(`
    INSERT INTO tasks (id, idea_id, title, description, skills_needed, time_estimate,
      output_type, status, source, parent_task_id, task_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, datetime('now'))
  `).run(
    id, params.ideaId, params.title, params.description,
    JSON.stringify(params.skillsNeeded), params.timeEstimate,
    params.outputType, params.source, params.parentTaskId || null, order
  );

  return getTaskById(id)!;
}

export function claimTask(
  taskId: string,
  userId: string,
  userName: string
): Task | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as any;
  if (!row || (row.status !== "open" && row.status !== "proposed")) return null;

  const hours = parseInt((row.time_estimate || "").replace(/[^0-9]/g, "")) || 20;
  const days = Math.ceil(hours / 3) + 7;
  const due = new Date();
  due.setDate(due.getDate() + days);

  db.prepare(`
    UPDATE tasks SET status = 'claimed', assignee_id = ?, assignee_name = ?,
      claimed_at = datetime('now'), due_date = ?
    WHERE id = ?
  `).run(userId, userName, due.toISOString(), taskId);

  return getTaskById(taskId);
}

export function updateTaskStatus(
  taskId: string,
  status: Task["status"]
): Task | null {
  const db = getDb();
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, taskId);
  return getTaskById(taskId);
}

/**
 * Workspace V2: partial update of a task using only the provided keys.
 * Builds a dynamic UPDATE SQL so legacy `updateTaskStatus` / `claimTask`
 * signatures are unaffected.
 */
export function updateTaskFields(
  taskId: string,
  patch: Partial<
    Pick<
      Task,
      | "title"
      | "description"
      | "status"
      | "priority"
      | "labels"
      | "richDescription"
      | "sprintId"
      | "storyPoints"
      | "startDate"
      | "dueDate"
      | "assigneeId"
      | "assigneeName"
      | "order"
      | "parentTaskId"
    >
  >
): Task | null {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  const map: Record<string, string> = {
    title: "title",
    description: "description",
    status: "status",
    priority: "priority",
    sprintId: "sprint_id",
    storyPoints: "story_points",
    startDate: "start_date",
    dueDate: "due_date",
    assigneeId: "assignee_id",
    assigneeName: "assignee_name",
    order: "task_order",
    parentTaskId: "parent_task_id",
  };

  for (const [key, col] of Object.entries(map)) {
    if (key in patch) {
      const v = (patch as Record<string, unknown>)[key];
      sets.push(`${col} = ?`);
      values.push(v ?? null);
    }
  }

  if ("labels" in patch) {
    sets.push("labels = ?");
    values.push(JSON.stringify(patch.labels || []));
  }

  if ("richDescription" in patch) {
    sets.push("rich_description = ?");
    values.push(
      patch.richDescription == null ? null : JSON.stringify(patch.richDescription)
    );
  }

  if (sets.length === 0) return getTaskById(taskId);

  const sql = `UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...values, taskId);
  return getTaskById(taskId);
}

export function addTaskNote(
  taskId: string,
  authorId: string,
  authorName: string,
  content: string,
  replyTo?: string | null
): Task | null {
  const db = getDb();
  const noteId = genId("note");
  db.prepare(`
    INSERT INTO task_notes (id, task_id, author_id, author_name, content, reply_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(noteId, taskId, authorId, authorName, content, replyTo || null);
  return getTaskById(taskId);
}

export function updateTaskNote(
  noteId: string,
  authorId: string,
  content: string
): { ok: boolean; taskId?: string } {
  const db = getDb();
  const row = db.prepare("SELECT task_id, author_id FROM task_notes WHERE id = ?").get(noteId) as
    | { task_id: string; author_id: string }
    | undefined;
  if (!row) return { ok: false };
  if (row.author_id !== authorId) return { ok: false };
  db.prepare("UPDATE task_notes SET content = ?, edited_at = datetime('now') WHERE id = ?").run(content, noteId);
  return { ok: true, taskId: row.task_id };
}

export function deleteTaskNote(
  noteId: string,
  authorId: string,
  isAdmin: boolean
): { ok: boolean; taskId?: string } {
  const db = getDb();
  const row = db.prepare("SELECT task_id, author_id FROM task_notes WHERE id = ?").get(noteId) as
    | { task_id: string; author_id: string }
    | undefined;
  if (!row) return { ok: false };
  if (!isAdmin && row.author_id !== authorId) return { ok: false };
  db.prepare("DELETE FROM task_note_reactions WHERE note_id = ?").run(noteId);
  db.prepare("DELETE FROM task_notes WHERE id = ?").run(noteId);
  return { ok: true, taskId: row.task_id };
}

// ─── Batch reads ────────────────────────────────────────────────────────────

export function getAllTasksGrouped(): Map<string, Task[]> {
  const rows = getDb()
    .prepare("SELECT * FROM tasks ORDER BY task_order ASC, created_at ASC")
    .all();

  // Batch-load all notes
  const allNotes = getDb()
    .prepare("SELECT * FROM task_notes ORDER BY created_at ASC")
    .all() as any[];
  const noteMap = new Map<string, TaskNote[]>();
  for (const n of allNotes) {
    const arr = noteMap.get(n.task_id) || [];
    arr.push({
      id: n.id,
      authorId: n.author_id,
      authorName: n.author_name,
      content: n.content,
      createdAt: n.created_at,
      replyTo: n.reply_to || null,
      editedAt: n.edited_at || null,
    });
    noteMap.set(n.task_id, arr);
  }

  const grouped = new Map<string, Task[]>();
  for (const row of rows as any[]) {
    const task = rowToTask(row, noteMap.get(row.id) || []);
    const arr = grouped.get(task.ideaId) || [];
    arr.push(task);
    grouped.set(task.ideaId, arr);
  }
  return grouped;
}

export function getAllSubmissionsGrouped(): Map<string, Submission[]> {
  const rows = getDb()
    .prepare("SELECT * FROM submissions ORDER BY created_at ASC")
    .all() as any[];
  const grouped = new Map<string, Submission[]>();
  for (const row of rows) {
    const sub = rowToSubmission(row);
    const arr = grouped.get(sub.taskId) || [];
    arr.push(sub);
    grouped.set(sub.taskId, arr);
  }
  return grouped;
}

// ─── Submission CRUD (SQLite) ───────────────────────────────────────────────

export function getSubmissionsForTask(taskId: string): Submission[] {
  const rows = getDb()
    .prepare("SELECT * FROM submissions WHERE task_id = ? ORDER BY created_at ASC")
    .all(taskId);
  return rows.map(rowToSubmission);
}

export function getSubmissionById(submissionId: string): Submission | null {
  const row = getDb().prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
  return row ? rowToSubmission(row) : null;
}

export function createSubmission(params: {
  taskId: string;
  ideaId: string;
  authorId: string;
  authorName: string;
  type: Submission["type"];
  content: string;
  attachments?: SubmissionAttachment[];
}): Submission {
  const db = getDb();
  const id = genId("sub");
  const attachmentsJson = JSON.stringify(params.attachments || []);

  db.prepare(`
    INSERT INTO submissions (id, task_id, idea_id, author_id, author_name, type, content, attachments, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(id, params.taskId, params.ideaId, params.authorId, params.authorName, params.type, params.content, attachmentsJson);

  // Update task status
  db.prepare("UPDATE tasks SET status = 'submitted' WHERE id = ?").run(params.taskId);

  return getSubmissionById(id)!;
}

export function setAIReview(submissionId: string, review: AIReview): Submission | null {
  const db = getDb();
  db.prepare("UPDATE submissions SET ai_review = ? WHERE id = ?")
    .run(JSON.stringify(review), submissionId);
  return getSubmissionById(submissionId);
}

export function setLeadReview(
  submissionId: string,
  decision: "accepted" | "changes-requested",
  note: string | null
): Submission | null {
  const db = getDb();
  const status = decision === "accepted" ? "accepted" : "changes-requested";
  db.prepare("UPDATE submissions SET status = ?, accepted_by = ? WHERE id = ?")
    .run(status, note, submissionId);

  const sub = getSubmissionById(submissionId);
  if (sub && decision === "accepted") {
    storeAcceptedWork(sub);
  }
  return sub;
}

// ─── Project Knowledge ──────────────────────────────────────────────────────

function storeAcceptedWork(submission: Submission) {
  const dir = path.join(KNOWLEDGE_DIR, submission.ideaId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, "accepted-work.json");
  let works: any[] = [];
  if (fs.existsSync(filePath)) {
    try { works = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { works = []; }
  }

  works.push({
    submissionId: submission.id,
    taskId: submission.taskId,
    authorId: submission.authorId,
    authorName: submission.authorName,
    type: submission.type,
    content: submission.content,
    acceptedAt: new Date().toISOString(),
  });

  fs.writeFileSync(filePath, JSON.stringify(works, null, 2));
}

export function getAcceptedWork(
  ideaId: string
): { submissionId: string; taskId: string; authorName: string; type: string; content: string; acceptedAt: string }[] {
  const filePath = path.join(KNOWLEDGE_DIR, ideaId, "accepted-work.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}
