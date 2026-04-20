/**
 * Admin endpoint for the "join the project on IranENovin" CTA posted back
 * onto the original GitHub discussion.
 *
 *   GET    /api/admin/github-invite                → list status per idea
 *   POST   /api/admin/github-invite { ideaId }     → post for one idea
 *   POST   /api/admin/github-invite { bulk: true, filter: {...} }
 *                                                  → post for all matching
 *   GET    /api/admin/github-invite/template       → current template
 *   PUT    /api/admin/github-invite/template       → update template
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";
import {
  postInviteForIdea,
  postInviteBulk,
  type BulkInviteFilter,
} from "@/lib/github-invite";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, source, source_url, project_status, github_vote_count,
              github_invite_posted_at, github_invite_comment_url
       FROM ideas
       WHERE source_url IS NOT NULL
       ORDER BY github_vote_count DESC, updated_at DESC
       LIMIT 500`
    )
    .all() as any[];

  const totals = {
    total: rows.length,
    posted: rows.filter((r) => !!r.github_invite_posted_at).length,
    pending: rows.filter((r) => !r.github_invite_posted_at).length,
  };

  return NextResponse.json({ totals, ideas: rows });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    ideaId?: string;
    bulk?: boolean;
    force?: boolean;
    filter?: BulkInviteFilter;
  };

  if (body.bulk) {
    const summary = await postInviteBulk({
      ...(body.filter || {}),
      force: body.force,
    });
    return NextResponse.json(summary);
  }

  if (!body.ideaId) {
    return NextResponse.json({ error: "ideaId required" }, { status: 400 });
  }
  const res = await postInviteForIdea(body.ideaId, { force: body.force });
  if (!res.ok && !res.skipped) {
    return NextResponse.json(res, { status: 500 });
  }
  return NextResponse.json(res);
}
