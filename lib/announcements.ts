/**
 * Site-wide announcements.
 *
 * Admins compose entries in `site_announcements`. The top-of-page banner
 * reads the latest active row for every visitor, and each publish event
 * fans out notifications to every user who opted in (rows in
 * `site_subscriptions` + fallback to all users when `fanoutAll` is set).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb } from "./db/index";
import { logError, logInfo } from "./logger";

export type AnnouncementSeverity = "info" | "success" | "warning";

export interface SiteAnnouncement {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  severity: AnnouncementSeverity;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

function rowToAnnouncement(row: any): SiteAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    linkUrl: row.link_url || null,
    linkLabel: row.link_label || null,
    severity: (row.severity as AnnouncementSeverity) || "info",
    active: !!row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

/** The latest currently-visible announcement, or null. */
export function getActiveAnnouncement(): SiteAnnouncement | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM site_announcements
       WHERE active = 1
         AND (starts_at IS NULL OR starts_at <= datetime('now'))
         AND (ends_at IS NULL OR ends_at > datetime('now'))
       ORDER BY starts_at DESC, created_at DESC
       LIMIT 1`
    )
    .get() as any;
  return row ? rowToAnnouncement(row) : null;
}

/** Full history, newest first. Used by the admin panel. */
export function listAnnouncements(limit = 50): SiteAnnouncement[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM site_announcements ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as any[];
  return rows.map(rowToAnnouncement);
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  severity?: AnnouncementSeverity;
  startsAt?: string | null; // ISO — defaults to now
  endsAt?: string | null;   // ISO — optional auto-deactivate time
  createdBy?: string | null;
  fanoutAll?: boolean;      // true = notify every user, false = only opt-ins
}

function genId(): string {
  return (
    "ann-" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

export function createAnnouncement(input: CreateAnnouncementInput): SiteAnnouncement {
  const id = genId();
  const severity: AnnouncementSeverity = input.severity || "info";

  const db = getDb();

  // New announcements supersede older ones in the banner — we keep them
  // `active=1` so the UI shows the most recent, but a single banner slot is
  // enforced by `ORDER BY starts_at DESC LIMIT 1` on read. We deliberately
  // don't auto-deactivate older ones so the history stays browsable.
  db.prepare(
    `INSERT INTO site_announcements
       (id, title, body, link_url, link_label, severity, active, starts_at, ends_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, COALESCE(?, datetime('now')), ?, ?, datetime('now'))`
  ).run(
    id,
    input.title.trim(),
    input.body.trim(),
    input.linkUrl?.trim() || null,
    input.linkLabel?.trim() || null,
    severity,
    input.startsAt || null,
    input.endsAt || null,
    input.createdBy || null
  );

  const row = db
    .prepare("SELECT * FROM site_announcements WHERE id = ?")
    .get(id) as any;
  return rowToAnnouncement(row);
}

export function deactivateAnnouncement(id: string): boolean {
  const info = getDb()
    .prepare("UPDATE site_announcements SET active = 0 WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

export function reactivateAnnouncement(id: string): boolean {
  const info = getDb()
    .prepare("UPDATE site_announcements SET active = 1 WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

export function deleteAnnouncement(id: string): boolean {
  const info = getDb()
    .prepare("DELETE FROM site_announcements WHERE id = ?")
    .run(id);
  return info.changes > 0;
}

/**
 * Notify every subscriber (or every user, if fanoutAll) that a new
 * announcement was published. Best-effort — partial failures are logged
 * per-user, the caller never sees a throw.
 */
export async function fanoutAnnouncement(
  announcement: SiteAnnouncement,
  opts: { fanoutAll?: boolean } = {}
): Promise<{ recipients: number }> {
  const db = getDb();

  // Recipients: opt-ins from site_subscriptions, or every user if fanoutAll.
  const rows = opts.fanoutAll
    ? (db.prepare("SELECT id FROM users").all() as Array<{ id: string }>)
    : (db
        .prepare("SELECT user_id AS id FROM site_subscriptions")
        .all() as Array<{ id: string }>);

  if (rows.length === 0) {
    logInfo(
      `[announcements] no recipients for ${announcement.id} (fanoutAll=${!!opts.fanoutAll})`,
      "announcements"
    );
    return { recipients: 0 };
  }

  const { sendNotification } = await import("./notifications/dispatcher");
  const linkUrl = announcement.linkUrl || "/";

  // Fan out sequentially with a tiny yield between each — sendNotification
  // writes SQLite + fires Telegram/email per-user, so batching in one tick
  // can stall the event loop on large announcement runs.
  let delivered = 0;
  for (const r of rows) {
    try {
      await sendNotification({
        userId: r.id,
        type: "site_announcement",
        title: announcement.title,
        body: announcement.body,
        linkUrl,
        channels: ["in_app", "telegram", "email"],
        sourceType: "announcement",
        sourceId: announcement.id,
      });
      delivered++;
    } catch (e) {
      logError(
        `[announcements] fanout to ${r.id} failed: ${(e as Error).message}`,
        "announcements"
      );
    }
    // Yield every 25 recipients so HTTP handlers keep responding.
    if (delivered % 25 === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  logInfo(
    `[announcements] fanned out ${announcement.id} to ${delivered}/${rows.length} recipients`,
    "announcements"
  );
  return { recipients: delivered };
}
