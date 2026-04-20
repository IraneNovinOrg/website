/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, getUserById } from "@/lib/db/index";

function genId(prefix = "end"): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to endorse", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const endorserId = (session.user as any).id || session.user.email || "";
  if (!endorserId) {
    return NextResponse.json(
      { error: "Missing user id", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  if (endorserId === userId) {
    return NextResponse.json(
      { error: "Self-endorsement is not allowed", code: "SELF_ENDORSE" },
      { status: 400 }
    );
  }

  // Parse body
  let skill = "";
  try {
    const body = await request.json();
    skill = String(body?.skill ?? "").trim();
  } catch {
    // ignore
  }

  if (!skill) {
    return NextResponse.json(
      { error: "Skill is required", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  if (skill.length > 100) {
    return NextResponse.json(
      { error: "Skill name too long", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // Verify target user exists and actually has this skill listed
  const target = getUserById(userId);
  if (!target) {
    return NextResponse.json(
      { error: "User not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!Array.isArray(target.skills) || !target.skills.includes(skill)) {
    return NextResponse.json(
      { error: "User does not list this skill", code: "SKILL_NOT_LISTED" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Insert (unique constraint prevents duplicates)
  try {
    db.prepare(
      `INSERT INTO skill_endorsements (id, user_id, endorser_id, skill)
       VALUES (?, ?, ?, ?)`
    ).run(genId(), userId, endorserId, skill);
  } catch (e: any) {
    // Swallow UNIQUE violations — treat as idempotent success
    if (!String(e?.message || "").includes("UNIQUE")) {
      console.error("endorse insert error:", e);
      return NextResponse.json(
        { error: "Failed to endorse", code: "DB_ERROR" },
        { status: 500 }
      );
    }
  }

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM skill_endorsements WHERE user_id = ? AND skill = ?`
    )
    .get(userId, skill) as { c: number } | undefined;

  return NextResponse.json({
    ok: true,
    skill,
    count: countRow?.c ?? 0,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT skill, COUNT(*) as count
       FROM skill_endorsements
       WHERE user_id = ?
       GROUP BY skill`
    )
    .all(userId) as { skill: string; count: number }[];

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.skill] = r.count;

  return NextResponse.json({ endorsements: counts });
}
