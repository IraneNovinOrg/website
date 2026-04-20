/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";

/**
 * GET /api/admin/charts/categories
 * Top 10 categories by total votes.
 * Returns [{ category, votes, ideas }]
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = getDb();

  try {
    const rows = db
      .prepare(
        `SELECT
           COALESCE(NULLIF(TRIM(i.category), ''), 'Uncategorized') as category,
           COUNT(i.id) as ideas,
           COALESCE(SUM(i.github_vote_count), 0) +
             COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0) as votes
         FROM ideas i
         GROUP BY COALESCE(NULLIF(TRIM(i.category), ''), 'Uncategorized')
         ORDER BY votes DESC, ideas DESC
         LIMIT 10`
      )
      .all() as Array<{ category: string; votes: number; ideas: number }>;

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
