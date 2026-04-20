/**
 * Workspace V2 — Phase 4: Mention CRUD helpers.
 *
 * Backs the @mention detection used by task descriptions and doc pages. A
 * mention is a row per (source_type, source_id, mentioned_user_id) tuple —
 * if the same user is mentioned more than once in the same source only a
 * single row exists. Uniqueness is enforced at the application layer
 * (see `syncMentions` in `lib/workspace/mentions.ts`).
 */
import { getDb } from "./index";

export interface Mention {
  id: string;
  sourceType: string;
  sourceId: string;
  mentionedUserId: string;
  authorId: string | null;
  createdAt: string;
}

interface MentionRow {
  id: string;
  source_type: string;
  source_id: string;
  mentioned_user_id: string;
  author_id: string | null;
  created_at: string;
}

function rowToMention(row: MentionRow | undefined): Mention | null {
  if (!row) return null;
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    mentionedUserId: row.mentioned_user_id,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

function genId(prefix = "men"): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${prefix}-${id}`;
}

export interface CreateMentionParams {
  sourceType: string;
  sourceId: string;
  mentionedUserId: string;
  authorId: string | null;
}

export function createMention(params: CreateMentionParams): Mention {
  const db = getDb();
  const id = genId();
  db.prepare(
    `INSERT INTO mentions
       (id, source_type, source_id, mentioned_user_id, author_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    params.sourceType,
    params.sourceId,
    params.mentionedUserId,
    params.authorId
  );
  const row = db
    .prepare("SELECT * FROM mentions WHERE id = ?")
    .get(id) as MentionRow | undefined;
  return rowToMention(row)!;
}

export function listForUser(
  mentionedUserId: string,
  limit = 50
): Mention[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM mentions
        WHERE mentioned_user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`
    )
    .all(mentionedUserId, limit) as MentionRow[];
  return rows.map((r) => rowToMention(r)!).filter(Boolean);
}

export function listForSource(
  sourceType: string,
  sourceId: string
): Mention[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM mentions
        WHERE source_type = ? AND source_id = ?
        ORDER BY created_at ASC`
    )
    .all(sourceType, sourceId) as MentionRow[];
  return rows.map((r) => rowToMention(r)!).filter(Boolean);
}

export function deleteMention(id: string): void {
  getDb().prepare("DELETE FROM mentions WHERE id = ?").run(id);
}
