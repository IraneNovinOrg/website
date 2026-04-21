/**
 * Unified members directory.
 *
 * Sources:
 *  1. Local `users` table — everyone who has signed up through IranENovin
 *     (email, GitHub, Google, Telegram).
 *  2. GitHub org membership — added via the bot when GitHub users sign in,
 *     but also includes core org members who may not yet have a site login.
 *
 * Dedup: matches local users to GitHub members via `users.github_login`.
 * When both sources have an entry, we prefer the local profile (richer
 * info: bio, skills, languages, reputation) and keep the GitHub avatar.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getOrgMembers } from "@/lib/github";
import { getDb } from "@/lib/db/index";
import type { Member } from "@/types";

export const dynamic = "force-dynamic";

interface LocalUserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  github_login: string | null;
  bio: string | null;
  skills: string | null;
  location: string | null;
  timezone: string | null;
  languages: string | null;
  hours_per_week: string | null;
  categories: string | null;
  telegram_handle: string | null;
  linkedin_url: string | null;
  profile_completed: 0 | 1;
  reputation_score: number | null;
  is_public_profile: 0 | 1;
  created_at: string;
}

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function displayHandle(u: LocalUserRow): string {
  // Pick a stable display identifier for the `login` field. In priority:
  // GitHub login, Telegram @handle, then the email local part, then id.
  if (u.github_login) return u.github_login;
  if (u.telegram_handle) return u.telegram_handle;
  // Hide synthetic Telegram-placeholder emails.
  if (u.email && !u.email.endsWith("@telegram.iranenovin.local")) {
    return u.email.split("@")[0];
  }
  return u.id;
}

function rowToMember(u: LocalUserRow, ideasCount = 0, projectsCount = 0): Member {
  return {
    login: displayHandle(u),
    name: u.name || undefined,
    avatarUrl: u.avatar_url || "",
    // Every local user is surfaced as a "member" in the public directory
    // — we never leak admin status here.
    role: "member",
    skills: parseJsonArray(u.skills),
    joinedAt: u.created_at,
    bio: u.bio || undefined,
    ideasCount,
    projectsCount,
    location: u.location,
    timezone: u.timezone,
    languages: parseJsonArray(u.languages),
    hoursPerWeek: u.hours_per_week,
    categories: parseJsonArray(u.categories),
    telegramHandle: u.telegram_handle,
    linkedInUrl: u.linkedin_url,
    profileCompleted: !!u.profile_completed,
    reputationScore: u.reputation_score ?? 0,
  };
}

export async function GET() {
  const db = getDb();

  // ── Local users (public profiles + any user who signed up) ────────────
  // We intentionally include profile_completed=0 users too — they've joined
  // the community, they just haven't filled in the form yet.
  const localRows = db
    .prepare(
      `SELECT id, email, name, avatar_url, github_login, bio, skills, location,
              timezone, languages, hours_per_week, categories, telegram_handle,
              linkedin_url, profile_completed, reputation_score, is_public_profile,
              created_at
       FROM users
       ORDER BY created_at DESC`
    )
    .all() as LocalUserRow[];

  // Engagement counts per user (ideas authored + projects they've joined via
  // help_offers or subscriptions). Done as batch group-bys, not N+1.
  const ideaCounts = new Map<string, number>();
  const projectCounts = new Map<string, number>();

  // Authored ideas — keyed by github login (that's what `ideas.author_login` stores).
  const ideaRows = db
    .prepare("SELECT author_login as login, COUNT(*) as c FROM ideas GROUP BY author_login")
    .all() as Array<{ login: string; c: number }>;
  for (const r of ideaRows) ideaCounts.set(r.login, r.c);

  // Projects "joined": distinct ideas they offered help on or subscribed to.
  try {
    const projRows = db
      .prepare(
        `SELECT user_id, COUNT(DISTINCT idea_id) as c
         FROM (
           SELECT email AS user_id, idea_id FROM help_offers WHERE email IS NOT NULL
           UNION
           SELECT user_id, idea_id FROM project_subscriptions
         )
         GROUP BY user_id`
      )
      .all() as Array<{ user_id: string; c: number }>;
    for (const r of projRows) projectCounts.set(r.user_id, r.c);
  } catch {
    /* project_subscriptions may not exist on a fresh DB — fine */
  }

  // ── GitHub org members ────────────────────────────────────────────────
  let ghMembers: Member[] = [];
  try {
    ghMembers = await getOrgMembers();
  } catch {
    // Org fetch is best-effort — a Github token hiccup shouldn't black out
    // the Members page entirely.
    ghMembers = [];
  }

  // ── Every participant across every project ────────────────────────────
  // Authors, commenters (local + github-synced), help offerers, task
  // claimers, submitters, voters. We collect distinct logins + their most
  // recent avatar / first seen date. Users without a local `users` row
  // (e.g. GitHub-only commenters on IranAzadAbad discussions) show up here.
  interface ParticipantRow {
    login: string;
    avatar: string | null;
    first_seen: string | null;
  }

  const participantRows = db
    .prepare(
      `SELECT login, avatar, MIN(first_seen) as first_seen FROM (
         -- Idea authors
         SELECT author_login AS login,
                author_avatar AS avatar,
                MIN(created_at) AS first_seen
         FROM ideas
         WHERE author_login IS NOT NULL AND author_login != ''
         GROUP BY author_login, author_avatar
         UNION ALL
         -- Commenters (local + github)
         SELECT author_login AS login,
                author_avatar AS avatar,
                MIN(created_at) AS first_seen
         FROM idea_comments
         WHERE author_login IS NOT NULL AND author_login != ''
         GROUP BY author_login, author_avatar
         UNION ALL
         -- Task assignees
         SELECT assignee_name AS login,
                NULL AS avatar,
                MIN(claimed_at) AS first_seen
         FROM tasks
         WHERE assignee_name IS NOT NULL AND assignee_name != ''
         GROUP BY assignee_name
         UNION ALL
         -- Submitters
         SELECT author_name AS login,
                NULL AS avatar,
                MIN(created_at) AS first_seen
         FROM submissions
         WHERE author_name IS NOT NULL AND author_name != ''
         GROUP BY author_name
         UNION ALL
         -- Help offerers
         SELECT name AS login,
                NULL AS avatar,
                MIN(created_at) AS first_seen
         FROM help_offers
         WHERE name IS NOT NULL AND name != ''
         GROUP BY name
       )
       GROUP BY login, avatar
       ORDER BY first_seen ASC`
    )
    .all() as ParticipantRow[];

  // Project counts per login across all of our sources. Used for the
  // "projects touched" badge on the Member card.
  const projectsPerLogin = new Map<string, Set<string>>();
  const accumulate = (login: string | null, ideaId: string | null) => {
    if (!login || !ideaId) return;
    const k = login.toLowerCase();
    if (!projectsPerLogin.has(k)) projectsPerLogin.set(k, new Set());
    projectsPerLogin.get(k)!.add(ideaId);
  };
  (db.prepare(
    "SELECT author_login as login, id as idea_id FROM ideas WHERE author_login IS NOT NULL"
  ).all() as Array<{ login: string; idea_id: string }>).forEach((r) =>
    accumulate(r.login, r.idea_id)
  );
  (db.prepare(
    "SELECT author_login as login, idea_id FROM idea_comments WHERE author_login IS NOT NULL"
  ).all() as Array<{ login: string; idea_id: string }>).forEach((r) =>
    accumulate(r.login, r.idea_id)
  );
  (db.prepare(
    "SELECT assignee_name as login, idea_id FROM tasks WHERE assignee_name IS NOT NULL"
  ).all() as Array<{ login: string | null; idea_id: string }>).forEach((r) =>
    accumulate(r.login, r.idea_id)
  );
  (db.prepare(
    "SELECT name as login, idea_id FROM help_offers WHERE name IS NOT NULL"
  ).all() as Array<{ login: string | null; idea_id: string }>).forEach((r) =>
    accumulate(r.login, r.idea_id)
  );

  // ── Merge ──────────────────────────────────────────────────────────────
  const byLogin = new Map<string, Member>();
  // (localIds set was used by an earlier sort path — removed.)

  // Add all local users first (authoritative).
  for (const u of localRows) {
    const ideas = (u.github_login && ideaCounts.get(u.github_login)) || 0;
    // project_subscriptions uses user_id; help_offers uses email — count both.
    const projByEmail = projectCounts.get(u.email) || 0;
    const projById = projectCounts.get(u.id) || 0;
    const member = rowToMember(u, ideas, projByEmail + projById);
    byLogin.set(member.login.toLowerCase(), member);
  }

  // Layer in GitHub-org members that aren't already represented by a local user.
  for (const g of ghMembers) {
    const key = g.login.toLowerCase();
    if (byLogin.has(key)) {
      // Enrich existing local member with GH avatar if they didn't upload one.
      const existing = byLogin.get(key)!;
      if (!existing.avatarUrl && g.avatarUrl) existing.avatarUrl = g.avatarUrl;
      continue;
    }
    byLogin.set(key, {
      ...g,
      // Override `role` from getOrgMembers (which may report "admin" for
      // org owners) — the public directory treats everyone as equal.
      role: "member",
      ideasCount: ideaCounts.get(g.login) || 0,
    });
  }

  // Layer in participants (GitHub-synced commenters, anonymous help offers,
  // etc.) who aren't already represented. These are "drive-by contributors"
  // — people who interacted with a project without creating a local account.
  for (const p of participantRows) {
    const key = p.login.toLowerCase();
    if (byLogin.has(key)) {
      // Enrich an existing entry with an avatar if we now have one.
      const existing = byLogin.get(key)!;
      if (!existing.avatarUrl && p.avatar) existing.avatarUrl = p.avatar;
      continue;
    }
    byLogin.set(key, {
      login: p.login,
      name: p.login,
      avatarUrl: p.avatar || "",
      role: "contributor",
      skills: [],
      joinedAt: p.first_seen || new Date(0).toISOString(),
      ideasCount: ideaCounts.get(p.login) || 0,
      projectsCount: projectsPerLogin.get(key)?.size || 0,
      profileCompleted: false,
      reputationScore: 0,
    });
  }

  // Backfill projectsCount on every entry from the cross-source map.
  for (const [key, m] of byLogin) {
    const seen = projectsPerLogin.get(key)?.size || 0;
    if (seen > (m.projectsCount || 0)) m.projectsCount = seen;
  }

  // Sort: signed-up local users first (newest first), then everyone else
  // by engagement (projects touched), then alphabetically as a tiebreaker.
  const localLoginSet = new Set(localRows.map((u) => displayHandle(u).toLowerCase()));
  const members = [...byLogin.values()].sort((a, b) => {
    const aLocal = localLoginSet.has(a.login.toLowerCase());
    const bLocal = localLoginSet.has(b.login.toLowerCase());
    if (aLocal !== bLocal) return aLocal ? -1 : 1;
    if (aLocal && bLocal) {
      // Both local — most recent signup first.
      const aTime = Date.parse(a.joinedAt) || 0;
      const bTime = Date.parse(b.joinedAt) || 0;
      return bTime - aTime;
    }
    // Both external — rank by projects touched then by login for stability.
    const aProj = a.projectsCount || 0;
    const bProj = b.projectsCount || 0;
    if (aProj !== bProj) return bProj - aProj;
    return a.login.localeCompare(b.login);
  });

  return NextResponse.json(
    {
      members,
      stats: {
        total: members.length,
        local: localRows.length,
        github: ghMembers.length,
        participants: participantRows.length,
      },
    },
    {
      // 60s public cache (was 1 hr). New signups now appear within a minute.
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    }
  );
}
