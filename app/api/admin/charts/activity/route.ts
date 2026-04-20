/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";

/**
 * GET /api/admin/charts/activity
 * Returns [{ date: "YYYY-MM-DD", comments, votes, tasks }] for last 30 days.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = getDb();

  const comments = safeQuery(
    db,
    `SELECT date(created_at) as date, COUNT(*) as n
     FROM idea_comments
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY date(created_at)`
  );
  const votes = safeQuery(
    db,
    `SELECT date(created_at) as date, COUNT(*) as n
     FROM votes
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY date(created_at)`
  );
  const tasks = safeQuery(
    db,
    `SELECT date(created_at) as date, COUNT(*) as n
     FROM tasks
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY date(created_at)`
  );

  // Build map of date → counts
  const map: Record<string, { comments: number; votes: number; tasks: number }> = {};
  const ensure = (d: string) =>
    (map[d] = map[d] || { comments: 0, votes: 0, tasks: 0 });

  for (const r of comments) ensure(r.date).comments = r.n;
  for (const r of votes) ensure(r.date).votes = r.n;
  for (const r of tasks) ensure(r.date).tasks = r.n;

  // Fill all 30 days (including zero days)
  const result: Array<{ date: string; comments: number; votes: number; tasks: number }> = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = map[key] || { comments: 0, votes: 0, tasks: 0 };
    result.push({ date: key, ...entry });
  }

  return NextResponse.json(result);
}

function safeQuery(db: any, sql: string): Array<{ date: string; n: number }> {
  try {
    return db.prepare(sql).all() as Array<{ date: string; n: number }>;
  } catch {
    return [];
  }
}
