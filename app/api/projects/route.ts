/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getAllTasksGrouped } from "@/lib/ai-tasks";

export async function GET() {
  const db = getDb();

  const ideas = db.prepare(`
    SELECT * FROM ideas
    WHERE project_status IN ('active', 'completed', 'needs-contributors')
    ORDER BY updated_at DESC
  `).all() as any[];

  // Batch lookups — ONE read each, not per-project
  const taskMap = getAllTasksGrouped();

  const feasRows = db.prepare("SELECT idea_id, feasibility FROM ai_analyses").all() as any[];
  const feasMap = new Map(feasRows.map((a: any) => [a.idea_id, a.feasibility]));

  const helpRows = db.prepare("SELECT idea_id, COUNT(*) as c FROM help_offers GROUP BY idea_id").all() as any[];
  const helpMap = new Map(helpRows.map((h: any) => [h.idea_id, h.c as number]));

  const result = ideas.map((idea: any) => {
    const tasks = taskMap.get(idea.id) || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === "accepted").length;
    const openTasks = tasks.filter((t: any) => t.status === "open").length;
    const claimedTasks = tasks.filter((t: any) => ["claimed", "in-progress", "submitted"].includes(t.status)).length;

    return {
      id: idea.id,
      slug: idea.id,
      title: idea.title,
      type: idea.category || "community",
      status: idea.project_status || "active",
      sourceIdeaId: idea.id,
      sourceIdeaTitle: idea.title,
      leadName: idea.author_login || "Community",
      leadAvatar: idea.author_avatar || "",
      memberCount: (helpMap.get(idea.id) || 0) + claimedTasks,
      openRoleCount: openTasks,
      completedTaskCount: completedTasks,
      totalTaskCount: totalTasks,
      githubRepoUrl: idea.source_url,
      lastActivityAt: idea.updated_at,
      createdAt: idea.created_at,
      category: idea.category,
      categoryEmoji: idea.category_emoji,
      feasibility: feasMap.get(idea.id) || null,
      bodyPreview: idea.body_preview || (idea.body ? idea.body.slice(0, 150) : ""),
    };
  });

  return NextResponse.json(
    { projects: result },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
  );
}
