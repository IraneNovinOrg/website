/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { handleProjectEvent } from "@/lib/ai-trigger";
import { logInfo, logError } from "@/lib/logger";

// Fire-and-forget helper: never awaits, never throws back to the caller.
function fireAndForget(label: string, fn: () => Promise<unknown>): void {
  Promise.resolve()
    .then(fn)
    .catch((e) => {
      logError(`${label}: ${(e as Error)?.message || String(e)}`, "admin-ai-action");
    });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { action, ideaId, taskId, data } = await request.json();

  switch (action) {
    case "sync": {
      const { runAgentCycle } = await import("@/lib/agent/cycle");
      // Run in background, don't block the response
      runAgentCycle().catch(console.error);
      return NextResponse.json({ success: true, message: "Sync cycle triggered in background" });
    }
    case "analyze": {
      if (ideaId === "__test__" || ideaId === "__sync_only__") {
        return NextResponse.json({ success: true, message: "Test OK" });
      }
      if (!ideaId) {
        return NextResponse.json({ error: "ideaId required" }, { status: 400 });
      }
      const { getDb } = await import("@/lib/db/index");
      const exists = getDb().prepare("SELECT id FROM ideas WHERE id = ?").get(ideaId);
      if (!exists) {
        return NextResponse.json({ error: "Idea not found" }, { status: 404 });
      }
      logInfo(`Admin ${session.user.email} triggered analysis for ${ideaId}`, "admin-ai-action");
      // Fire-and-forget: analysis can take ~30s, don't block the response.
      fireAndForget(`Analysis for ${ideaId}`, () => handleProjectEvent(ideaId, "admin_request"));
      return NextResponse.json({ success: true, message: "Analysis triggered in background" });
    }
    case "activate": {
      if (!ideaId) {
        return NextResponse.json({ error: "ideaId required" }, { status: 400 });
      }
      const { getDb, logActivity } = await import("@/lib/db/index");
      const db = getDb();
      const idea = db.prepare("SELECT id FROM ideas WHERE id = ?").get(ideaId);
      if (!idea) {
        return NextResponse.json({ error: "Idea not found" }, { status: 404 });
      }
      db.prepare("UPDATE ideas SET project_status = 'active' WHERE id = ?").run(ideaId);
      logActivity({
        ideaId,
        eventType: "project_activated",
        actorName: session.user.name || session.user.email || "",
      });
      logInfo(`Admin ${session.user.email} activated project ${ideaId}`, "admin-ai-action");
      // Fire-and-forget: handleProjectEvent("project_activated") runs analysis
      // AND auto-generates the project document (see runFullAnalysis in
      // lib/ai-trigger.ts which calls generateProjectDocument on success).
      fireAndForget(`Activation pipeline for ${ideaId}`, () =>
        handleProjectEvent(ideaId, "project_activated")
      );
      return NextResponse.json({
        success: true,
        message: "Project activated. AI analysis and document generation running in background.",
      });
    }
    case "delete-task": {
      const { getDb } = await import("@/lib/db/index");
      const db = getDb();
      db.prepare("DELETE FROM task_notes WHERE task_id = ?").run(taskId);
      db.prepare("DELETE FROM submissions WHERE task_id = ?").run(taskId);
      db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
      return NextResponse.json({ success: true });
    }
    case "complete-task": {
      const { updateTaskStatus } = await import("@/lib/ai-tasks");
      updateTaskStatus(taskId, "accepted");
      return NextResponse.json({ success: true });
    }
    case "edit-task": {
      const { getDb } = await import("@/lib/db/index");
      const db = getDb();
      const sets: string[] = [];
      const vals: any[] = [];
      if (data.title) { sets.push("title = ?"); vals.push(data.title); }
      if (data.description) { sets.push("description = ?"); vals.push(data.description); }
      if (data.status) { sets.push("status = ?"); vals.push(data.status); }
      if (data.timeEstimate) { sets.push("time_estimate = ?"); vals.push(data.timeEstimate); }
      if (sets.length > 0) {
        vals.push(taskId);
        db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      }
      return NextResponse.json({ success: true });
    }
    case "create-repo": {
      try {
        const { getDb } = await import("@/lib/db/index");
        const { getTasksForIdea } = await import("@/lib/ai-tasks");
        const { createProjectRepo } = await import("@/lib/github-repos");
        const db = getDb();
        const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as any;
        if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

        const tasks = getTasksForIdea(ideaId);
        const result = await createProjectRepo({
          ideaId,
          title: idea.title,
          description: (idea.body || "").slice(0, 500),
          tasks: tasks.map((t: any) => ({
            title: t.title,
            status: t.status,
            description: t.description,
            skills: t.skills,
          })),
          category: idea.category || "General",
          project_content: idea.project_content || undefined,
          project_docs: idea.project_docs || undefined,
          project_resources: idea.project_resources || undefined,
          project_leads: idea.project_leads || undefined,
          slug: idea.slug || undefined,
          discussionUrl: idea.discussion_url || idea.github_discussion_url || undefined,
          website: idea.website || undefined,
          status: idea.project_status || undefined,
        });

        if (result) {
          db.prepare("UPDATE ideas SET github_repo_url = ? WHERE id = ?").run(result.repoUrl, ideaId);
          return NextResponse.json({ success: true, repoUrl: result.repoUrl });
        }
        return NextResponse.json({ error: "Failed to create repo — check server logs" }, { status: 500 });
      } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
      }
    }
    case "set-trust-level": {
      const { getDb } = await import("@/lib/db/index");
      const db = getDb();
      const { userId: targetUserId, trustLevel } = data || {};
      if (!targetUserId || !trustLevel || trustLevel < 1 || trustLevel > 4) {
        return NextResponse.json({ error: "Invalid userId or trustLevel (1-4)" }, { status: 400 });
      }
      db.prepare("UPDATE users SET trust_level = ? WHERE id = ?").run(trustLevel, targetUserId);
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
