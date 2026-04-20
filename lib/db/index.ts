import Database from "better-sqlite3";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";

const DB_PATH = join(process.cwd(), "_data", "iranenovin.db");
const SCHEMA_PATH = join(process.cwd(), "lib", "db", "schema.sql");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch { /* ok */ }
    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    db.exec(schema);

    // Migrations: add columns that may not exist yet
    const migrations = [
      "ALTER TABLE help_offers ADD COLUMN hours_per_week TEXT",
      "ALTER TABLE help_offers ADD COLUMN want_notifications INTEGER DEFAULT 1",
      "ALTER TABLE ideas ADD COLUMN project_content TEXT DEFAULT ''",
      "ALTER TABLE ideas ADD COLUMN project_status TEXT DEFAULT 'idea'",
      "ALTER TABLE ideas ADD COLUMN ai_open_questions TEXT DEFAULT '[]'",
      "ALTER TABLE ideas ADD COLUMN ai_analyzed_at TEXT",
      "CREATE INDEX IF NOT EXISTS idx_ideas_project_status ON ideas(project_status)",
      "ALTER TABLE ideas ADD COLUMN project_docs TEXT DEFAULT '[]'",
      "ALTER TABLE ideas ADD COLUMN project_resources TEXT DEFAULT '[]'",
      "ALTER TABLE idea_comments ADD COLUMN reply_to TEXT",
      "ALTER TABLE ideas ADD COLUMN project_doc_meta TEXT DEFAULT '{}'",
      "ALTER TABLE ideas ADD COLUMN google_doc_url TEXT",
      "ALTER TABLE ideas ADD COLUMN teaser_image_url TEXT",
      "ALTER TABLE ideas ADD COLUMN project_leads TEXT DEFAULT '[]'",
      "ALTER TABLE tasks ADD COLUMN depends_on TEXT DEFAULT '[]'",
      "ALTER TABLE idea_comments ADD COLUMN author_id TEXT",
      "ALTER TABLE idea_comments ADD COLUMN edited_at TEXT",
      "ALTER TABLE ideas ADD COLUMN github_repo_url TEXT",
      "ALTER TABLE users ADD COLUMN trust_level INTEGER DEFAULT 1",
      "ALTER TABLE votes ADD COLUMN vote_reason TEXT",
      "ALTER TABLE ideas ADD COLUMN rejection_reason TEXT",
      "ALTER TABLE ideas ADD COLUMN similar_idea_id TEXT",
      "ALTER TABLE ideas ADD COLUMN replies_count INTEGER DEFAULT 0",
      "ALTER TABLE idea_comments ADD COLUMN github_vote_count INTEGER DEFAULT 0",
      // Task submissions: multi-file attachments (TasksTab Problem A)
      "ALTER TABLE submissions ADD COLUMN attachments TEXT DEFAULT '[]'",
      // Task notes chat features: threading + edit timestamp (TasksTab Problem B)
      "ALTER TABLE task_notes ADD COLUMN reply_to TEXT",
      "ALTER TABLE task_notes ADD COLUMN edited_at TEXT",
      // Task note reactions table (mirrors comment_reactions pattern)
      `CREATE TABLE IF NOT EXISTS task_note_reactions (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reaction_type TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(note_id, user_id, reaction_type)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_task_note_reactions_note ON task_note_reactions(note_id)",

      // ─── Workspace V2 (Phase 0 scaffolding) ────────────────────────────
      // Tasks: kanban metadata, rich description, sprint/point support
      "ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'",
      "ALTER TABLE tasks ADD COLUMN labels TEXT DEFAULT '[]'",
      "ALTER TABLE tasks ADD COLUMN rich_description TEXT",
      "ALTER TABLE tasks ADD COLUMN sprint_id TEXT",
      "ALTER TABLE tasks ADD COLUMN story_points INTEGER",
      "ALTER TABLE tasks ADD COLUMN start_date TEXT",
      // Ideas: rich doc content for the project overview
      "ALTER TABLE ideas ADD COLUMN rich_content TEXT",
      // Users: per-user opt-in to Workspace V2
      "ALTER TABLE users ADD COLUMN workspace_v2_enabled INTEGER DEFAULT 0",
      // Notifications: new Workspace V2 fields (existing table keeps legacy cols)
      "ALTER TABLE notifications ADD COLUMN source_type TEXT",
      "ALTER TABLE notifications ADD COLUMN source_id TEXT",
      "ALTER TABLE notifications ADD COLUMN url TEXT",
      "ALTER TABLE notifications ADD COLUMN read_at TEXT",
      // Sprints
      `CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        name TEXT NOT NULL,
        goal TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'planned',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Doc pages (TipTap content tree per project)
      `CREATE TABLE IF NOT EXISTS doc_pages (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        parent_id TEXT,
        title TEXT NOT NULL,
        content_json TEXT,
        content_plain TEXT,
        author_id TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      // Mentions (user-tagging across sources)
      `CREATE TABLE IF NOT EXISTS mentions (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        mentioned_user_id TEXT NOT NULL,
        author_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Task label definitions (per project)
      `CREATE TABLE IF NOT EXISTS task_label_defs (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6B7280',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Indexes for Workspace V2 tables
      "CREATE INDEX IF NOT EXISTS idx_sprints_idea ON sprints(idea_id)",
      "CREATE INDEX IF NOT EXISTS idx_doc_pages_idea ON doc_pages(idea_id)",
      "CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON doc_pages(parent_id)",
      "CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at ON notifications(user_id, read_at)",
      "CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id)",
      "CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id)",

      // ─── AI Skills system (Phase 7) ────────────────────────────────────
      // Track when each skill last ran per entity (used by background cycle)
      "ALTER TABLE ideas ADD COLUMN last_ai_suggestion_at TEXT",
      "ALTER TABLE ideas ADD COLUMN last_ai_document_at TEXT",
      // Submission AI decision + confidence (skills.reviewSubmission)
      "ALTER TABLE submissions ADD COLUMN ai_confidence TEXT",
      "ALTER TABLE submissions ADD COLUMN ai_decision TEXT",
      "CREATE INDEX IF NOT EXISTS idx_activity_log_event ON activity_log(event_type, created_at)",

      // ─── AI Operations log (admin observability) ──────────────────────
      `CREATE TABLE IF NOT EXISTS ai_operations (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        idea_id TEXT,
        model_used TEXT,
        tokens_input INTEGER DEFAULT 0,
        tokens_output INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      "CREATE INDEX IF NOT EXISTS idx_ai_ops_created ON ai_operations(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_ai_ops_type ON ai_operations(operation_type)",
      "CREATE INDEX IF NOT EXISTS idx_ai_ops_model ON ai_operations(model_used)",

      // ─── Skill endorsements (community peer endorsements) ─────────────
      `CREATE TABLE IF NOT EXISTS skill_endorsements (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        endorser_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, endorser_id, skill)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_skill_endorsements_user_skill ON skill_endorsements(user_id, skill)",

      // ─── Feedback attachments ──────────────────────────────────────
      "ALTER TABLE feedback ADD COLUMN attachments TEXT DEFAULT '[]'",

      // ─── AI Jobs (async AI operations) ────────────────────────────
      `CREATE TABLE IF NOT EXISTS ai_jobs (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_ai_jobs_idea ON ai_jobs(idea_id)",

      // ─── Agent: is_ai_reply column for idea_comments ──────────────
      "ALTER TABLE idea_comments ADD COLUMN is_ai_reply INTEGER DEFAULT 0",

      // ─── Document suggestions (user edit proposals) ────────────────
      `CREATE TABLE IF NOT EXISTS document_suggestions (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        original_content TEXT NOT NULL,
        suggested_content TEXT NOT NULL,
        diff_summary TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      "CREATE INDEX IF NOT EXISTS idx_doc_suggestions_idea ON document_suggestions(idea_id, status)",

      // ─── Project chat (per-project group chat channel) ────────────
      `CREATE TABLE IF NOT EXISTS project_chat_messages (
        id TEXT PRIMARY KEY,
        idea_id TEXT NOT NULL,
        author_id TEXT,
        author_name TEXT,
        author_avatar TEXT,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        edited_at TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS idx_project_chat_idea ON project_chat_messages(idea_id, created_at DESC)",

      // ─── Project & site subscriptions (notification opt-ins) ──────
      `CREATE TABLE IF NOT EXISTS project_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        idea_id TEXT NOT NULL,
        channels TEXT NOT NULL DEFAULT '["in_app"]',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, idea_id)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_project_subs_user ON project_subscriptions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_project_subs_idea ON project_subscriptions(idea_id)",

      `CREATE TABLE IF NOT EXISTS site_subscriptions (
        user_id TEXT PRIMARY KEY,
        channels TEXT NOT NULL DEFAULT '["in_app"]',
        created_at TEXT DEFAULT (datetime('now'))
      )`,

      // ─── AI review fields on document_suggestions ──────────────────
      "ALTER TABLE document_suggestions ADD COLUMN ai_verdict TEXT",
      "ALTER TABLE document_suggestions ADD COLUMN ai_reason TEXT",
      "ALTER TABLE document_suggestions ADD COLUMN ai_reviewed_at TEXT",

      // ─── AI job retry support ──────────────────────────────────────
      "ALTER TABLE ai_jobs ADD COLUMN attempts INTEGER DEFAULT 0",
      "ALTER TABLE ai_jobs ADD COLUMN max_attempts INTEGER DEFAULT 3",
      "ALTER TABLE ai_jobs ADD COLUMN next_retry_at TEXT",
      "ALTER TABLE ai_jobs ADD COLUMN payload TEXT",
      "ALTER TABLE ai_jobs ADD COLUMN last_error TEXT",
      "CREATE INDEX IF NOT EXISTS idx_ai_jobs_retry ON ai_jobs(status, next_retry_at)",

      // ─── GitHub "join us" invitation CTA ───────────────────────────────
      // When an admin posts the recruitment message on the original GitHub
      // discussion, we stamp this column so bulk re-posts skip it. The
      // comment node id is stored so admins can jump to the posted comment.
      "ALTER TABLE ideas ADD COLUMN github_invite_posted_at TEXT",
      "ALTER TABLE ideas ADD COLUMN github_invite_comment_id TEXT",
      "ALTER TABLE ideas ADD COLUMN github_invite_comment_url TEXT",
      "CREATE INDEX IF NOT EXISTS idx_ideas_github_invite ON ideas(github_invite_posted_at)",

      // ─── Site-wide announcements ───────────────────────────────────────
      // Admins compose a message here; it persists so the banner can show
      // the currently-active one to every visitor, and so we have history.
      // `severity` drives the banner color (`info` | `success` | `warning`).
      // ─── Telegram deep-link sign-in sessions ────────────────────────
      // One row per attempt. The token is shown to the user via QR / link,
      // the bot confirms it via /start login_<token>, then the frontend
      // polls the status and calls signIn once it flips to 'confirmed'.
      `CREATE TABLE IF NOT EXISTS telegram_login_sessions (
        token TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        tg_chat_id TEXT,
        tg_username TEXT,
        tg_first_name TEXT,
        tg_last_name TEXT,
        tg_photo_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        confirmed_at TEXT,
        consumed_at TEXT,
        expires_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS idx_tg_login_status ON telegram_login_sessions(status, expires_at)",

      `CREATE TABLE IF NOT EXISTS site_announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link_url TEXT,
        link_label TEXT,
        severity TEXT DEFAULT 'info',
        active INTEGER DEFAULT 1,
        starts_at TEXT DEFAULT (datetime('now')),
        ends_at TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      "CREATE INDEX IF NOT EXISTS idx_site_announcements_active ON site_announcements(active, starts_at DESC)",
    ];
    for (const sql of migrations) {
      try { db.exec(sql); } catch { /* column/index already exists */ }
    }

    // One-time migration: import AI analyses from JSON files into SQLite
    try {
      const analysesDir = join(process.cwd(), "_data", "ai-analyses");
      if (existsSync(analysesDir)) {
        const files = readdirSync(analysesDir) as string[];
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const ideaId = file.replace(".json", "");
          const existing = db.prepare("SELECT idea_id FROM ai_analyses WHERE idea_id = ?").get(ideaId);
          if (existing) continue;
          try {
            const data = JSON.parse(readFileSync(join(analysesDir, file), "utf-8"));
            db.prepare(`
              INSERT OR IGNORE INTO ai_analyses (idea_id, feasibility, feasibility_explanation, summary, full_analysis, model_used, generated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(ideaId, data.feasibility, data.feasibilityExplanation, data.summary, JSON.stringify(data), data.modelUsed, data.generatedAt);
          } catch { /* skip bad files */ }
        }
      }
    } catch (e) {
      console.error("[Migration] AI analysis import error:", e);
    }

    // One-time migration: import tasks from JSON into SQLite
    try {
      const taskCount = (db.prepare("SELECT COUNT(*) as c FROM tasks").get() as { c: number }).c;
      if (taskCount === 0) {
        const tasksPath = join(process.cwd(), "_data", "tasks.json");
        if (existsSync(tasksPath)) {
          const tasks = JSON.parse(readFileSync(tasksPath, "utf-8"));
          if (Array.isArray(tasks) && tasks.length > 0) {
            const insert = db.prepare(`
              INSERT OR IGNORE INTO tasks (id, idea_id, title, description, skills_needed, time_estimate,
                output_type, status, assignee_id, assignee_name, claimed_at, due_date,
                source, parent_task_id, task_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insertNote = db.prepare(`
              INSERT OR IGNORE INTO task_notes (id, task_id, author_id, author_name, content, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            db.transaction(() => {
              for (const t of tasks) {
                insert.run(
                  t.id, t.ideaId, t.title, t.description,
                  JSON.stringify(t.skillsNeeded || []), t.timeEstimate || "",
                  t.outputType || "document", t.status || "open",
                  t.assigneeId || null, t.assigneeName || null,
                  t.claimedAt || null, t.dueDate || null,
                  t.source || "ai", t.parentTaskId || null,
                  t.order ?? 0, t.createdAt || new Date().toISOString()
                );
                // Migrate notes
                if (Array.isArray(t.notes)) {
                  for (const n of t.notes) {
                    const noteId = t.id + "-n-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
                    insertNote.run(noteId, t.id, n.authorId, n.authorName, n.content, n.createdAt);
                  }
                }
              }
            })();
            console.log(`[Migration] Imported ${tasks.length} tasks from JSON to SQLite`);
          }
        }
      }
    } catch (e) {
      console.error("[Migration] Task import error:", e);
    }
  }
  return db;
}

function genId(prefix = ""): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}-${id}` : id;
}

// ─── User types ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  github_login: string | null;
  telegram_chat_id: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  timezone: string | null;
  languages: string[];
  hours_per_week: string | null;
  categories: string[];
  telegram_handle: string | null;
  linkedin_url: string | null;
  is_public_profile: boolean;
  profile_completed: boolean;
  reputation_score: number;
  provider: string;
  password_hash: string | null;
  notification_prefs: Record<string, boolean>;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): UserProfile | null {
  if (!row) return null;
  return {
    ...row,
    skills: JSON.parse(row.skills || "[]"),
    languages: JSON.parse(row.languages || "[]"),
    categories: JSON.parse(row.categories || "[]"),
    notification_prefs: JSON.parse(row.notification_prefs || "{}"),
    is_public_profile: !!row.is_public_profile,
    profile_completed: !!row.profile_completed,
  };
}

// ─── User CRUD ──────────────────────────────────────────────────────────────

export function getUserById(id: string): UserProfile | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return rowToUser(row);
}

export function getUserByEmail(email: string): UserProfile | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim());
  return rowToUser(row);
}

export function getUserCount(): number {
  const row = getDb().prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return row.count;
}

export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<UserProfile | null> {
  const existing = getUserByEmail(email);
  if (existing) return null;

  const hash = await bcrypt.hash(password, 10);
  const id = genId();

  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, provider)
       VALUES (?, ?, ?, ?, 'email')`
    )
    .run(id, email.toLowerCase().trim(), name || null, hash);

  return getUserById(id);
}

export async function verifyUser(
  email: string,
  password: string
): Promise<UserProfile | null> {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as { password_hash: string } | undefined;

  if (!row?.password_hash) return null;
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;
  return rowToUser(row);
}

export function upsertOAuthUser(params: {
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  github_login?: string | null;
  provider: "github" | "google";
}): UserProfile | null {
  const existing = getUserByEmail(params.email);

  if (existing) {
    const updates: string[] = [];
    const values: (string | null)[] = [];
    if (params.name) { updates.push("name = ?"); values.push(params.name); }
    if (params.avatar_url) { updates.push("avatar_url = ?"); values.push(params.avatar_url); }
    if (params.github_login) { updates.push("github_login = ?"); values.push(params.github_login); }
    if (updates.length > 0) {
      values.push(existing.id);
      getDb().prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }
    return getUserById(existing.id);
  }

  const id = genId();
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, github_login, provider)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.email.toLowerCase().trim(),
      params.name || null,
      params.avatar_url || null,
      params.github_login || null,
      params.provider
    );

  return getUserById(id);
}

/**
 * Upsert a user signing in via the Telegram Login Widget. Telegram doesn't
 * provide an email, so we synthesize a stable one on an internal subdomain —
 * it's never sent to end users and never used to send mail. The real
 * identity key for Telegram accounts is `telegram_chat_id`.
 */
export function upsertTelegramUser(params: {
  telegramId: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
}): UserProfile | null {
  const tgId = String(params.telegramId).trim();
  if (!tgId) return null;

  const db = getDb();

  // Already linked? (either via login or via /link bot flow)
  const existingById = db
    .prepare("SELECT id FROM users WHERE telegram_chat_id = ?")
    .get(tgId) as { id: string } | undefined;

  const displayName =
    [params.firstName, params.lastName].filter(Boolean).join(" ").trim() ||
    params.username ||
    null;

  if (existingById) {
    // Refresh avatar/name if Telegram provided new values.
    const updates: string[] = [];
    const values: (string | null)[] = [];
    if (displayName) {
      updates.push("name = COALESCE(NULLIF(name, ''), ?)");
      values.push(displayName);
    }
    if (params.photoUrl) {
      updates.push("avatar_url = COALESCE(NULLIF(avatar_url, ''), ?)");
      values.push(params.photoUrl);
    }
    if (params.username) {
      updates.push("telegram_handle = ?");
      values.push(params.username);
    }
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(existingById.id);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }
    return getUserById(existingById.id);
  }

  // New account. Synthesize an internal-only email that's guaranteed unique.
  const syntheticEmail = `tg-${tgId}@telegram.iranenovin.local`;
  const id = genId();

  db.prepare(
    `INSERT INTO users (id, email, name, avatar_url, telegram_chat_id,
       telegram_handle, provider)
     VALUES (?, ?, ?, ?, ?, ?, 'telegram')`
  ).run(
    id,
    syntheticEmail,
    displayName,
    params.photoUrl || null,
    tgId,
    params.username || null
  );

  return getUserById(id);
}

export function updateProfile(
  id: string,
  updates: Record<string, unknown>
): UserProfile | null {
  const jsonFields = ["skills", "languages", "categories", "notification_prefs"];
  const boolFields = ["is_public_profile", "profile_completed"];

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase(); // camelCase → snake_case
    if (jsonFields.includes(dbKey)) {
      setClauses.push(`${dbKey} = ?`);
      values.push(JSON.stringify(val));
    } else if (boolFields.includes(dbKey)) {
      setClauses.push(`${dbKey} = ?`);
      values.push(val ? 1 : 0);
    } else {
      setClauses.push(`${dbKey} = ?`);
      values.push(val);
    }
  }

  if (setClauses.length === 0) return getUserById(id);

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  getDb()
    .prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`)
    .run(...values);

  return getUserById(id);
}

// ─── Votes ──────────────────────────────────────────────────────────────────

/**
 * Toggle a user's vote on an idea. Second call removes it.
 * Returns `{ hasVoted, totalVotes }` reflecting the state AFTER the call.
 */
export function castVote(
  ideaId: string,
  userId: string
): { hasVoted: boolean; totalVotes: number } {
  const d = getDb();

  return d.transaction(() => {
    const existing = d
      .prepare("SELECT id FROM votes WHERE idea_id = ? AND user_id = ?")
      .get(ideaId, userId) as { id: string } | undefined;

    if (existing) {
      d.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
      d.prepare(
        `UPDATE vote_counts
           SET local_votes = MAX(local_votes - 1, 0),
               total_votes = github_votes + MAX(local_votes - 1, 0)
         WHERE idea_id = ?`
      ).run(ideaId);
      return { hasVoted: false, totalVotes: getVoteCount(ideaId) };
    }

    d.prepare("INSERT INTO votes (id, idea_id, user_id) VALUES (?, ?, ?)").run(
      genId(),
      ideaId,
      userId
    );

    d.prepare(
      `INSERT INTO vote_counts (idea_id, local_votes, total_votes)
       VALUES (?, 1, COALESCE((SELECT github_votes FROM vote_counts WHERE idea_id = ?), 0) + 1)
       ON CONFLICT(idea_id) DO UPDATE SET
         local_votes = local_votes + 1,
         total_votes = github_votes + local_votes + 1`
    ).run(ideaId, ideaId);

    return { hasVoted: true, totalVotes: getVoteCount(ideaId) };
  })();
}

/**
 * Return the set of idea IDs the given user has voted on. Used to decorate
 * list responses with `hasVoted` flags so the UI can render filled upvote
 * arrows without a per-card round-trip.
 */
export function getUserVotedIdeas(userId: string): Set<string> {
  const rows = getDb()
    .prepare("SELECT idea_id FROM votes WHERE user_id = ?")
    .all(userId) as Array<{ idea_id: string }>;
  return new Set(rows.map((r) => r.idea_id));
}

export function getVoteCount(ideaId: string): number {
  const db = getDb();
  // GitHub votes from the ideas table + local votes from the votes table
  const idea = db.prepare("SELECT github_vote_count FROM ideas WHERE id = ?").get(ideaId) as { github_vote_count: number } | undefined;
  const localVotes = (db.prepare("SELECT COUNT(*) as c FROM votes WHERE idea_id = ?").get(ideaId) as { c: number })?.c || 0;
  return (idea?.github_vote_count || 0) + localVotes;
}

// ─── Expert queries ─────────────────────────────────────────────────────────

export function findOptedInExperts(
  skills: string[],
  excludeUserId?: string
): UserProfile[] {
  const all = getDb().prepare("SELECT * FROM users").all();
  return all
    .map(rowToUser)
    .filter((u): u is UserProfile => {
      if (!u) return false;
      if (u.id === excludeUserId) return false;
      if (!u.notification_prefs?.expertReviews) return false;
      return skills.some((s) => u.skills.includes(s));
    });
}

export function findUsersBySkills(
  skills: string[],
  excludeUserId?: string
): UserProfile[] {
  const all = getDb()
    .prepare("SELECT * FROM users WHERE is_public_profile = 1")
    .all();
  return all
    .map(rowToUser)
    .filter((u): u is UserProfile => {
      if (!u) return false;
      if (u.id === excludeUserId) return false;
      return skills.some((s) => u.skills.includes(s));
    });
}

// ─── Notifications ──────────────────────────────────────────────────────────

export function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  linkUrl?: string
) {
  getDb()
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(genId("notif"), userId, type, title, body || null, linkUrl || null);
}

export function getUnreadNotifications(userId: string) {
  return getDb()
    .prepare(
      "SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 50"
    )
    .all(userId);
}

export function markNotificationRead(notificationId: string) {
  getDb()
    .prepare("UPDATE notifications SET is_read = 1 WHERE id = ?")
    .run(notificationId);
}

// ─── Activity Log ───────────────────────────────────────────────────────────

// ─── AI Operations ──────────────────────────────────────────────────────────

export function logAIOperation(params: {
  operationType: string;
  ideaId?: string | null;
  modelUsed?: string | null;
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  success?: boolean;
  errorMessage?: string | null;
}): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO ai_operations
         (id, operation_type, idea_id, model_used, tokens_input, tokens_output, latency_ms, success, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        genId("aiop"),
        params.operationType,
        params.ideaId || null,
        params.modelUsed || null,
        params.tokensInput ?? 0,
        params.tokensOutput ?? 0,
        params.latencyMs ?? 0,
        params.success === false ? 0 : 1,
        params.errorMessage || null
      );
  } catch {
    // Don't let logging errors break anything
  }
}

export function logActivity(params: {
  ideaId?: string;
  projectId?: string;
  eventType: string;
  actorId?: string;
  actorName?: string;
  details?: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO activity_log (id, idea_id, project_id, event_type, actor_id, actor_name, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      genId("act"),
      params.ideaId || null,
      params.projectId || null,
      params.eventType,
      params.actorId || null,
      params.actorName || null,
      params.details || null
    );
}
