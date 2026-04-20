/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";
import { logActivity } from "@/lib/db/index";
import { logInfo, logError } from "@/lib/logger";

/**
 * GET /api/admin/users
 * Query params: search, limit (default 100, max 500), sort=created|name|email|trust|active
 * Returns { users: [...], totalCount }
 *
 * PATCH /api/admin/users
 * Body: { userId, trust_level }   — update a user's trust level (1-4)
 */

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const sort = searchParams.get("sort") || "created";

  const db = getDb();

  const orderBy: Record<string, string> = {
    created: "u.created_at DESC",
    name: "LOWER(COALESCE(u.name, '')) ASC",
    email: "LOWER(u.email) ASC",
    trust: "COALESCE(u.trust_level, 1) DESC, u.created_at DESC",
    active: "last_active_at DESC",
  };
  const order = orderBy[sort] || orderBy.created;

  const where: string[] = [];
  const params: any[] = [];
  if (search) {
    where.push(
      `(LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.name, '')) LIKE ? OR LOWER(COALESCE(u.github_login, '')) LIKE ?)`
    );
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const users = db
      .prepare(
        `SELECT
           u.id, u.email, u.name, u.avatar_url, u.github_login,
           u.provider, u.reputation_score,
           COALESCE(u.trust_level, 1) as trust_level,
           u.created_at,
           (SELECT MAX(created_at) FROM activity_log a WHERE a.actor_id = u.id) as last_active_at
         FROM users u
         ${whereSql}
         ORDER BY ${order}
         LIMIT ?`
      )
      .all(...params, limit);

    const totalRow = db
      .prepare(`SELECT COUNT(*) as c FROM users u ${whereSql}`)
      .get(...params) as { c: number };

    return NextResponse.json({ users, totalCount: totalRow.c });
  } catch (e) {
    logError(`Admin users list failed: ${(e as Error).message}`, "admin-users");
    return NextResponse.json({ users: [], totalCount: 0 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, trust_level } = body || {};

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const level = Number(trust_level);
  if (!Number.isInteger(level) || level < 1 || level > 4) {
    return NextResponse.json(
      { error: "trust_level must be 1-4" },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    db.prepare("UPDATE users SET trust_level = ? WHERE id = ?").run(level, userId);

    logActivity({
      eventType: "trust_level_updated",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email || "admin",
      details: JSON.stringify({ userId, newLevel: level }),
    });
    logInfo(`Admin updated trust_level for ${userId} → ${level}`, "admin-users");

    return NextResponse.json({ success: true, userId, trust_level: level });
  } catch (e) {
    logError(`Trust level update failed: ${(e as Error).message}`, "admin-users");
    return NextResponse.json(
      { error: (e as Error).message || "Update failed" },
      { status: 500 }
    );
  }
}
