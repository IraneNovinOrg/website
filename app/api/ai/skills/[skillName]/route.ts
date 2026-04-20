/**
 * Admin endpoint to manually trigger a named AI skill.
 * POST /api/ai/skills/<skill-name>
 * Body: { ideaId?, commentId?, noteId?, submissionId? }
 *
 * Auth: admin-only. Returns { success, result?, error? }.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

const KNOWN_SKILLS = [
  "reply-to-comment",
  "reply-to-task-note",
  "review-submission",
  "match-experts",
  "suggest-improvements",
  "generate-weekly-digest",
  "update-document",
] as const;
const KNOWN_SKILL_SET: ReadonlySet<string> = new Set(KNOWN_SKILLS);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ skillName: string }> }
) {
  const { skillName } = await params;

  // Auth: admin only
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json(
      { success: false, error: "Admin only" },
      { status: 403 }
    );
  }

  if (!KNOWN_SKILL_SET.has(skillName)) {
    return NextResponse.json(
      { success: false, error: `Unknown skill: ${skillName}` },
      { status: 404 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body
  }

  const { ideaId, commentId, noteId, submissionId } = body || {};

  const skills = await import("@/lib/ai/skills");

  try {
    switch (skillName) {
      case "reply-to-comment": {
        if (!commentId) {
          return NextResponse.json(
            { success: false, error: "commentId required" },
            { status: 400 }
          );
        }
        const ok = await skills.replyToComment(commentId);
        return NextResponse.json({ success: ok, result: { replied: ok } });
      }

      case "reply-to-task-note": {
        if (!noteId) {
          return NextResponse.json(
            { success: false, error: "noteId required" },
            { status: 400 }
          );
        }
        const ok = await skills.replyToTaskNote(noteId);
        return NextResponse.json({ success: ok, result: { replied: ok } });
      }

      case "review-submission": {
        if (!submissionId) {
          return NextResponse.json(
            { success: false, error: "submissionId required" },
            { status: 400 }
          );
        }
        const ok = await skills.reviewSubmission(submissionId);
        return NextResponse.json({ success: ok, result: { reviewed: ok } });
      }

      case "match-experts": {
        if (!ideaId) {
          return NextResponse.json(
            { success: false, error: "ideaId required" },
            { status: 400 }
          );
        }
        const result = await skills.matchExperts(ideaId);
        return NextResponse.json({
          success: result !== null,
          result: result || undefined,
          error: result === null ? "Skill execution failed" : undefined,
        });
      }

      case "suggest-improvements": {
        if (!ideaId) {
          return NextResponse.json(
            { success: false, error: "ideaId required" },
            { status: 400 }
          );
        }
        const ok = await skills.suggestImprovements(ideaId);
        return NextResponse.json({ success: ok, result: { suggested: ok } });
      }

      case "generate-weekly-digest": {
        const result = await skills.generateWeeklyDigest();
        return NextResponse.json({
          success: result !== null,
          result: result || undefined,
          error: result === null ? "Skill execution failed" : undefined,
        });
      }

      case "update-document": {
        if (!ideaId) {
          return NextResponse.json(
            { success: false, error: "ideaId required" },
            { status: 400 }
          );
        }
        const ok = await skills.updateDocument(ideaId);
        return NextResponse.json({ success: ok, result: { updated: ok } });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unhandled skill: ${skillName}` },
          { status: 500 }
        );
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    skills: [...KNOWN_SKILLS],
    usage: "POST with { ideaId?, commentId?, noteId?, submissionId? }",
  });
}
