/**
 * Project-level permission checks.
 *
 * Admin = global platform admin (config-driven via _config/ai.json → adminEmails).
 * Lead  = user listed in `ideas.project_leads` (JSON array of display names or emails).
 *
 * Use `canManageProject(session, ideaId)` for any action that modifies
 * the project: removing contributors, editing leads list, closing tasks, etc.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { isAdmin } from "../admin";
import { getDb } from "../db/index";

export interface SessionLike {
  user?: {
    id?: string | null;
    email?: string | null;
    name?: string | null;
    githubLogin?: string | null;
  } | null;
}

function normalize(v: string | null | undefined): string {
  return (v || "").toLowerCase().trim();
}

/** Parse project_leads JSON array (legacy storage formats: strings or objects). */
export function parseLeads(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => typeof x === "string" ? x : (x?.name || x?.login || "")).filter(Boolean);
  }
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x: unknown) => typeof x === "string" ? x : ((x as { name?: string; login?: string })?.name || (x as { login?: string })?.login || "")).filter(Boolean)
      : [];
  } catch { return []; }
}

/** Returns true if the given session user is a lead of the project. */
export function isProjectLead(session: SessionLike | null | undefined, ideaId: string): boolean {
  if (!session?.user) return false;
  const db = getDb();
  const row = db.prepare("SELECT project_leads FROM ideas WHERE id = ?").get(ideaId) as { project_leads?: string } | undefined;
  if (!row) return false;
  const leads = parseLeads(row.project_leads).map(normalize);
  if (leads.length === 0) return false;

  const candidates = [
    session.user.name,
    session.user.email,
    (session.user as { githubLogin?: string | null }).githubLogin,
  ].filter(Boolean).map((v) => normalize(v as string));

  return candidates.some((c) => leads.includes(c));
}

/**
 * Returns true if the user can manage this project:
 * either a platform admin OR a lead on this specific project.
 */
export function canManageProject(session: SessionLike | null | undefined, ideaId: string): boolean {
  if (!session?.user) return false;
  if (isAdmin(session.user.email)) return true;
  return isProjectLead(session, ideaId);
}
