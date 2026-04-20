/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project notification fanout.
 * Given an ideaId + event, dispatches notifications to every user who:
 *  - Subscribed explicitly via `project_subscriptions`, OR
 *  - Is a member via `help_offers`, OR
 *  - Is a lead (listed in `project_leads`)
 *
 * Deduplicates by user_id. Always fire-and-forget from callers.
 */

import { getDb } from "../db/index";
import { sendNotification } from "./dispatcher";

export interface ProjectNotifyParams {
  ideaId: string;
  type: string;         // e.g. "project_update", "comment_added", "task_created"
  title: string;
  body?: string;
  linkUrl?: string;
  sourceType?: string;
  sourceId?: string;
  excludeUserId?: string | null; // typically the actor — don't notify them about their own action
  /** If true, also notify every platform admin (from adminEmails in config). */
  includeAdmins?: boolean;
}

function uniqueStrings(xs: Array<string | null | undefined>): string[] {
  return Array.from(new Set(xs.filter(Boolean) as string[]));
}

export async function notifyProject(params: ProjectNotifyParams): Promise<number> {
  const db = getDb();

  // 1. Explicit subscribers
  const subs = db
    .prepare("SELECT user_id FROM project_subscriptions WHERE idea_id = ?")
    .all(params.ideaId) as Array<{ user_id: string }>;
  const subUserIds = subs.map((s) => s.user_id);

  // 2. Members via help_offers (match user_id if set, else fallback by name/email)
  const offerRows = db
    .prepare("SELECT user_id FROM help_offers WHERE idea_id = ? AND user_id IS NOT NULL")
    .all(params.ideaId) as Array<{ user_id: string }>;
  const memberIds = offerRows.map((o) => o.user_id);

  // 3. Leads — look up users by the project_leads JSON array (names/emails/logins)
  const ideaRow = db
    .prepare("SELECT project_leads FROM ideas WHERE id = ?")
    .get(params.ideaId) as { project_leads?: string } | undefined;
  let leadIds: string[] = [];
  if (ideaRow?.project_leads) {
    try {
      const leads: unknown[] = JSON.parse(ideaRow.project_leads);
      const names = leads
        .map((x: unknown) => typeof x === "string" ? x : (x as any)?.name || (x as any)?.login || "")
        .filter(Boolean);
      if (names.length > 0) {
        const placeholders = names.map(() => "?").join(",");
        const rows = db
          .prepare(
            `SELECT id FROM users WHERE name IN (${placeholders}) OR email IN (${placeholders}) OR github_login IN (${placeholders})`
          )
          .all(...names, ...names, ...names) as Array<{ id: string }>;
        leadIds = rows.map((r) => r.id);
      }
    } catch { /* ignore */ }
  }

  // Platform admins (lookup by adminEmails → users)
  let adminIds: string[] = [];
  if (params.includeAdmins) {
    try {
      const { listAdmins } = await import("../admin");
      const adminEmails = listAdmins();
      if (adminEmails.length > 0) {
        const placeholders = adminEmails.map(() => "?").join(",");
        const rows = db
          .prepare(`SELECT id FROM users WHERE LOWER(email) IN (${placeholders})`)
          .all(...adminEmails.map((e) => e.toLowerCase())) as Array<{ id: string }>;
        adminIds = rows.map((r) => r.id);
      }
    } catch { /* ignore */ }
  }

  const targets = uniqueStrings([...subUserIds, ...memberIds, ...leadIds, ...adminIds])
    .filter((uid) => uid !== params.excludeUserId);

  let count = 0;
  for (const userId of targets) {
    try {
      await sendNotification({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl,
        channels: ["in_app", "telegram"],
        sourceType: params.sourceType,
        sourceId: params.sourceId,
      });
      count++;
    } catch {
      /* swallow — one failed dispatch shouldn't block others */
    }
  }
  return count;
}
