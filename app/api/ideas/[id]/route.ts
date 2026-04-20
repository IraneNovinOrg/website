/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const voteExpr = `(i.github_vote_count + COALESCE(
    (SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id), 0
  ))`;

  const idea = db.prepare(`
    SELECT i.*,
      ${voteExpr} as total_votes,
      COALESCE((SELECT COUNT(*) FROM help_offers h WHERE h.idea_id = i.id), 0) as help_offers_count
    FROM ideas i WHERE i.id = ?
  `).get(id) as any;

  if (!idea) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const comments = db.prepare(
    "SELECT * FROM idea_comments WHERE idea_id = ? ORDER BY created_at ASC"
  ).all(id) as any[];

  // Also check for a linked project
  const project = db.prepare(
    "SELECT slug, title, status, lead_user_id FROM projects WHERE source_idea_id = ? LIMIT 1"
  ).get(id) as any;

  return NextResponse.json({
    idea: {
      id: idea.id,
      nativeId: idea.native_id,
      title: idea.title,
      body: idea.body,
      bodyPreview: idea.body_preview || "",
      category: idea.category || "General",
      categoryEmoji: idea.category_emoji || "",
      source: idea.source,
      sourceUrl: idea.source_url,
      author: {
        login: idea.author_login || "ghost",
        avatarUrl: idea.author_avatar || "",
        name: idea.author_name,
        profileUrl: idea.author_profile_url,
      },
      voteCount: idea.total_votes || 0,
      commentCount: comments.length,
      createdAt: idea.created_at,
      updatedAt: idea.updated_at,
      labels: [],
      stage: idea.stage || "submitted",
      helpOffersCount: idea.help_offers_count || 0,
      graduatedTo: idea.graduated_to,
      projectStatus: idea.project_status || "idea",
    },
    comments: {
      iab: comments.filter((c: any) => c.source === "github").map((c: any) => ({
        id: c.id,
        body: c.body,
        author: { login: c.author_login, avatarUrl: c.author_avatar, profileUrl: `https://github.com/${c.author_login}` },
        createdAt: c.created_at,
      })),
      iranenovin: comments.filter((c: any) => c.source === "local").map((c: any) => ({
        id: c.id,
        body: c.body,
        author: { login: c.author_login, avatarUrl: c.author_avatar },
        createdAt: c.created_at,
      })),
    },
    project: project ? { slug: project.slug, title: project.title, status: project.status } : null,
  });
}
