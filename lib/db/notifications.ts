/**
 * Workspace V2 — Phase 4: Notification CRUD helpers.
 *
 * Backs the notification bell + list in the top bar. The notifications table
 * has legacy columns (`user_id`, `is_read`, `title`, `link_url`) from the v1
 * platform AND new columns added in Phase 0 (`source_type`, `source_id`,
 * `url`, `read_at`). This module writes/reads the new columns and uses
 * `read_at IS NULL` to mean "unread" — but we also keep `is_read` in sync so
 * legacy code paths don't break.
 */
import { getDb } from "./index";

export type NotificationType =
  | "mention"
  | "task_assigned"
  | "task_submitted"
  | "comment_reply"
  | "project_update"
  | string;

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  sourceType: string | null;
  sourceId: string | null;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  source_type: string | null;
  source_id: string | null;
  title: string;
  body: string | null;
  url: string | null;
  link_url: string | null;
  read_at: string | null;
  is_read: number | null;
  created_at: string;
}

function rowToNotification(row: NotificationRow | undefined): Notification | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    body: row.body,
    url: row.url ?? row.link_url ?? null,
    readAt: row.read_at ?? (row.is_read ? row.created_at : null),
    createdAt: row.created_at,
  };
}

function genId(prefix = "notif"): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${prefix}-${id}`;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  sourceType?: string | null;
  sourceId?: string | null;
  title: string;
  body?: string | null;
  url?: string | null;
}

export function createNotification(
  params: CreateNotificationParams
): Notification {
  const db = getDb();
  const id = genId();
  db.prepare(
    `INSERT INTO notifications
       (id, user_id, type, source_type, source_id, title, body, url, link_url, is_read, read_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`
  ).run(
    id,
    params.userId,
    params.type,
    params.sourceType ?? null,
    params.sourceId ?? null,
    params.title,
    params.body ?? null,
    params.url ?? null,
    params.url ?? null
  );

  const row = db
    .prepare("SELECT * FROM notifications WHERE id = ?")
    .get(id) as NotificationRow | undefined;
  return rowToNotification(row)!;
}

export function listForUser(
  userId: string,
  limit = 20,
  onlyUnread = false
): Notification[] {
  const db = getDb();
  const sql = onlyUnread
    ? `SELECT * FROM notifications
        WHERE user_id = ?
          AND read_at IS NULL
          AND COALESCE(is_read, 0) = 0
        ORDER BY created_at DESC
        LIMIT ?`
    : `SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`;
  const rows = db.prepare(sql).all(userId, limit) as NotificationRow[];
  return rows.map((r) => rowToNotification(r)!).filter(Boolean);
}

export function markRead(id: string, userId: string): { ok: boolean } {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE notifications
          SET read_at = datetime('now'), is_read = 1
        WHERE id = ? AND user_id = ?`
    )
    .run(id, userId);
  return { ok: result.changes > 0 };
}

export function markAllRead(userId: string): { count: number } {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE notifications
          SET read_at = datetime('now'), is_read = 1
        WHERE user_id = ?
          AND read_at IS NULL
          AND COALESCE(is_read, 0) = 0`
    )
    .run(userId);
  return { count: result.changes };
}

export function countUnread(userId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM notifications
        WHERE user_id = ?
          AND read_at IS NULL
          AND COALESCE(is_read, 0) = 0`
    )
    .get(userId) as { c: number } | undefined;
  return row?.c ?? 0;
}
