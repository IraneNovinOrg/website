/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";

/**
 * GET /api/admin/ai-operations
 * Query params:
 *   - model: string           (filter by model_used)
 *   - operation_type: string  (filter by operation_type)
 *   - success: "1" | "0"      (filter by success)
 *   - range: "24h" | "7d" | "30d" (time range, default 7d)
 *   - limit: number           (max 200, default 50)
 *
 * Returns: { operations, totalCount, totalTokens, estimatedCost }
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const model = searchParams.get("model");
  const opType = searchParams.get("operation_type");
  const successFilter = searchParams.get("success");
  const range = searchParams.get("range") || "7d";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  // Time range mapping
  const rangeMap: Record<string, string> = {
    "24h": "-1 day",
    "7d": "-7 days",
    "30d": "-30 days",
  };
  const sinceModifier = rangeMap[range] || "-7 days";

  const db = getDb();

  const where: string[] = [`created_at >= datetime('now', ?)`];
  const params: any[] = [sinceModifier];

  if (model) {
    where.push("model_used = ?");
    params.push(model);
  }
  if (opType) {
    where.push("operation_type = ?");
    params.push(opType);
  }
  if (successFilter === "1" || successFilter === "0") {
    where.push("success = ?");
    params.push(parseInt(successFilter));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let operations: any[] = [];
  let totalCount = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;

  try {
    operations = db
      .prepare(
        `SELECT id, operation_type, idea_id, model_used, tokens_input, tokens_output,
                latency_ms, success, error_message, created_at
         FROM ai_operations
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(...params, limit);

    const agg = db
      .prepare(
        `SELECT COUNT(*) as total,
                COALESCE(SUM(tokens_input), 0) as ti,
                COALESCE(SUM(tokens_output), 0) as to_
         FROM ai_operations
         ${whereSql}`
      )
      .get(...params) as { total: number; ti: number; to_: number };

    totalCount = agg.total;
    totalTokensInput = agg.ti;
    totalTokensOutput = agg.to_;
  } catch {
    // Table may not exist yet on very old DBs
  }

  // Rough cost estimate: output tokens at $0.00003/token
  const estimatedCost = totalTokensOutput * 0.00003;

  return NextResponse.json({
    operations,
    totalCount,
    totalTokensInput,
    totalTokensOutput,
    estimatedCost,
    range,
  });
}
