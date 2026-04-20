/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = getDb();

  const totalIdeas = (db.prepare("SELECT COUNT(*) as c FROM ideas").get() as any).c;
  const analyzedIdeas = (db.prepare("SELECT COUNT(*) as c FROM ideas WHERE ai_analyzed_at IS NOT NULL").get() as any).c;
  const unanalyzedIdeas = totalIdeas - analyzedIdeas;
  const activeProjects = (db.prepare("SELECT COUNT(*) as c FROM ideas WHERE project_status IN ('active','needs-contributors')").get() as any).c;

  const totalTasks = (db.prepare("SELECT COUNT(*) as c FROM tasks").get() as any).c;
  const openTasks = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'open'").get() as any).c;
  const claimedTasks = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status IN ('claimed','in-progress','submitted')").get() as any).c;
  const completedTasks = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'accepted'").get() as any).c;

  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  // Signup funnel — headline numbers for the admin dashboard.
  const usersToday = (db
    .prepare("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now', '-1 day')")
    .get() as any).c;
  const usersThisWeek = (db
    .prepare("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now', '-7 days')")
    .get() as any).c;
  const usersThisMonth = (db
    .prepare("SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now', '-30 days')")
    .get() as any).c;
  const completedProfiles = (db
    .prepare("SELECT COUNT(*) as c FROM users WHERE profile_completed = 1")
    .get() as any).c;

  // Signups broken out by provider so we can see channel mix at a glance.
  const byProviderRows = db
    .prepare("SELECT provider, COUNT(*) as c FROM users GROUP BY provider")
    .all() as Array<{ provider: string | null; c: number }>;
  const usersByProvider: Record<string, number> = {};
  for (const r of byProviderRows) usersByProvider[r.provider || "unknown"] = r.c;

  // Engagement splits — how many signups actually do anything.
  const contributingUsers = (db
    .prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM (
         SELECT user_id FROM votes
         UNION SELECT author_id AS user_id FROM idea_comments WHERE author_id IS NOT NULL
         UNION SELECT user_id FROM help_offers WHERE user_id IS NOT NULL
         UNION SELECT assignee_id AS user_id FROM tasks WHERE assignee_id IS NOT NULL
       )`
    )
    .get() as any).c;

  // Project membership: unique (user, idea) pairs from subs + help offers.
  let projectJoins = 0;
  try {
    projectJoins = (db
      .prepare(
        `SELECT COUNT(*) as c FROM (
           SELECT user_id, idea_id FROM project_subscriptions
           UNION
           SELECT email AS user_id, idea_id FROM help_offers WHERE email IS NOT NULL
         )`
      )
      .get() as any).c;
  } catch {
    /* project_subscriptions may not exist yet */
  }

  // 30-day daily signup timeseries for a sparkline on the admin overview.
  const signupSeries = db
    .prepare(
      `SELECT date(created_at) as day, COUNT(*) as c
       FROM users
       WHERE created_at > datetime('now', '-30 days')
       GROUP BY day
       ORDER BY day ASC`
    )
    .all() as Array<{ day: string; c: number }>;

  const totalComments = (db.prepare("SELECT COUNT(*) as c FROM idea_comments").get() as any).c;
  const githubComments = (db.prepare("SELECT COUNT(*) as c FROM idea_comments WHERE source = 'github'").get() as any).c;
  const localComments = totalComments - githubComments;

  const totalSubmissions = (db.prepare("SELECT COUNT(*) as c FROM submissions").get() as any).c;
  const totalHelpOffers = (db.prepare("SELECT COUNT(*) as c FROM help_offers").get() as any).c;
  const totalAnalyses = (db.prepare("SELECT COUNT(*) as c FROM ai_analyses").get() as any).c;

  // Table row counts for data management
  const tables = [
    "ideas", "idea_comments", "users", "votes", "vote_counts",
    "tasks", "task_notes", "submissions", "help_offers",
    "ai_analyses", "ai_chat_messages", "activity_log",
    "notifications", "projects", "project_roles",
  ];
  const tableCounts: Record<string, number> = {};
  for (const t of tables) {
    try {
      tableCounts[t] = (db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as any).c;
    } catch {
      tableCounts[t] = -1; // table doesn't exist
    }
  }

  // Last sync and analysis times
  const lastSync = (db.prepare("SELECT MAX(synced_at) as t FROM ideas").get() as any)?.t || null;
  const lastAnalysis = (db.prepare("SELECT MAX(ai_analyzed_at) as t FROM ideas WHERE ai_analyzed_at IS NOT NULL").get() as any)?.t || null;

  return NextResponse.json({
    totalIdeas, analyzedIdeas, unanalyzedIdeas, activeProjects,
    totalTasks, openTasks, claimedTasks, completedTasks,
    totalUsers, totalComments, githubComments, localComments,
    totalSubmissions, totalHelpOffers, totalAnalyses,
    // Signup funnel
    usersToday, usersThisWeek, usersThisMonth, completedProfiles,
    usersByProvider, contributingUsers, projectJoins, signupSeries,
    tableCounts, lastSync, lastAnalysis,
  });
}
