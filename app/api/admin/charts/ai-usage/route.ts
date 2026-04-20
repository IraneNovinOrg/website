/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";

/**
 * GET /api/admin/charts/ai-usage
 * AI operations count grouped by operation_type for last 7 days.
 * Returns [{ operation_type, count, success_rate, avg_latency }]
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
           operation_type,
           COUNT(*) as count,
           ROUND(AVG(success) * 100.0, 1) as success_rate,
           ROUND(AVG(latency_ms), 0) as avg_latency
         FROM ai_operations
         WHERE created_at >= datetime('now', '-7 days')
         GROUP BY operation_type
         ORDER BY count DESC
         LIMIT 15`
      )
      .all() as Array<{
        operation_type: string;
        count: number;
        success_rate: number;
        avg_latency: number;
      }>;

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
