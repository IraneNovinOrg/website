/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTasksForIdea, getAllSubmissionsGrouped, type Task, type Submission } from "@/lib/ai-tasks";
import { getCachedAnalysis } from "@/lib/ai";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // Get the idea (which IS the project)
  let idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as any;
  if (!idea) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // For IranAzadAbad-sourced ideas, fetch live stats and persist back to DB
  // so both detail and list views show fresh data without waiting for the
  // next scheduled sync cycle.
  if (idea.source === "iranazadabad" && idea.native_id) {
    try {
      const { getLiveIABIdea } = await import("@/lib/iranazadabad");
      const live = await getLiveIABIdea(idea.native_id);
      if (live?.idea) {
        const freshVotes = live.idea.voteCount ?? 0;
        const freshComments = live.idea.commentCount ?? 0;
        // `live.comments` contains top-level comments from GraphQL.
        // `freshComments` already includes replies (counted via GraphQL),
        // so subtracting top-level gives the reply count.
        const topLevelCount = live.comments?.length ?? 0;
        const freshReplies = Math.max(0, freshComments - topLevelCount);
        db.prepare(
          `UPDATE ideas
              SET github_vote_count = ?,
                  comment_count = ?,
                  replies_count = ?,
                  synced_at = datetime('now')
            WHERE id = ?`
        ).run(freshVotes, freshComments, freshReplies, id);
        // Re-read the idea so the response reflects the fresh counts
        idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as any;
      }
    } catch (e) {
      console.error("[projects/[id]] live IAB refresh failed:", e);
    }
  }

  // Get comments
  const comments = db.prepare(
    "SELECT * FROM idea_comments WHERE idea_id = ? ORDER BY created_at ASC"
  ).all(id);

  // Get tasks from JSON file
  const tasks = getTasksForIdea(id);

  // Get submissions for each task (single file read)
  const submissionMap = getAllSubmissionsGrouped();
  const tasksWithSubmissions = tasks.map((task: Task) => ({
    ...task,
    submissions: submissionMap.get(task.id) || [],
  }));

  // Get AI analysis
  const analysis = getCachedAnalysis(id);

  // Get help offers
  const helpOffers = db.prepare(
    "SELECT * FROM help_offers WHERE idea_id = ? ORDER BY created_at DESC"
  ).all(id);

  // Get vote count: github_vote_count + local votes (same formula as ideas list API)
  const localVoteCount = (db.prepare(
    "SELECT COUNT(*) as c FROM votes WHERE idea_id = ?"
  ).get(id) as { c: number })?.c || 0;
  const voteCount = ((idea as any).github_vote_count || 0) + localVoteCount;

  // Get vote reasons
  const voteReasons = db.prepare(
    "SELECT vote_reason FROM votes WHERE idea_id = ? AND vote_reason IS NOT NULL AND vote_reason != '' ORDER BY created_at DESC LIMIT 5"
  ).all(id) as any[];

  // Members of a project = everyone who participated in any way:
  // commenters (local AND GitHub-synced), task claimers/submitters, help
  // offerers, and people who tapped "Join" (project_subscriptions).
  // ContributorsTab dedupes by login/name, so overlap is harmless.
  const localCommenters = db.prepare(
    "SELECT DISTINCT author_login as login, author_avatar as avatar FROM idea_comments WHERE idea_id = ? AND author_login IS NOT NULL AND author_login != ''"
  ).all(id) as Array<{ login: string; avatar: string | null }>;

  const taskClaimers = tasks
    .filter((t: Task) => t.assigneeName)
    .map((t: Task) => ({ name: t.assigneeName, role: "claimed task" }));

  const submitters = tasks.flatMap((t: Task) =>
    (submissionMap.get(t.id) || []).map((s: Submission) => ({ name: s.authorName, role: "submitted work" }))
  );

  // People who explicitly joined (project_subscriptions → "Join" button).
  // Same shape as commenters so ContributorsTab can merge without a schema
  // change.
  const followers = db.prepare(
    `SELECT u.name AS name, u.github_login AS login, u.avatar_url AS avatar
     FROM project_subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.idea_id = ?`
  ).all(id) as Array<{ name: string | null; login: string | null; avatar: string | null }>;
  const joinedUsers = followers
    .map((f) => ({ login: f.login || f.name || "", avatar: f.avatar || "" }))
    .filter((f) => f.login);

  // Compute project status based on tasks
  let computedStatus = (idea as any).project_status || "idea";
  const openTasks = tasks.filter((t: Task) => t.status === "open").length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: Task) => t.status === "accepted").length;

  if (computedStatus === "active" && totalTasks > 0 && completedTasks === totalTasks) {
    computedStatus = "completed";
  } else if (computedStatus === "active" && totalTasks > 0 && openTasks === totalTasks) {
    computedStatus = "needs-contributors";
  }

  // Get activity log
  const activityLog = db.prepare(
    "SELECT * FROM activity_log WHERE idea_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(id);

  return NextResponse.json({
    idea,
    comments,
    tasks: tasksWithSubmissions,
    analysis,
    helpOffers,
    voteCount,
    contributors: {
      // Everyone who participated: commenters (local + GitHub-synced) and
      // people who tapped Join. Dedup by login happens client-side.
      commenters: [...localCommenters, ...joinedUsers],
      taskClaimers,
      submitters,
      helpOffers: helpOffers.map((h: any) => ({
        name: (h as any).name,
        skills: JSON.parse((h as any).skills || "[]"),
      })),
    },
    projectStatus: computedStatus,
    projectContent: (idea as any).project_content || "",
    googleDocUrl: (idea as any).google_doc_url || null,
    lastAiDocumentAt: (idea as any).last_ai_document_at || null,
    teaserImageUrl: (idea as any).teaser_image_url || null,
    projectDocMeta: JSON.parse((idea as any).project_doc_meta || "{}"),
    projectDocs: JSON.parse((idea as any).project_docs || "[]"),
    projectResources: JSON.parse((idea as any).project_resources || "[]"),
    projectLeads: JSON.parse((idea as any).project_leads || "[]"),
    aiOpenQuestions: JSON.parse((idea as any).ai_open_questions || "[]"),
    activityLog,
    voteReasons,
  }, {
    headers: { "Cache-Control": "no-cache" },
  });
}

// PATCH: update project status (admin only) or project content (contributors)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { auth } = await import("@/lib/auth");
  const { isAdmin } = await import("@/lib/admin");
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const db = getDb();

  if (body.projectStatus !== undefined) {
    // Admin only
    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    db.prepare("UPDATE ideas SET project_status = ? WHERE id = ?").run(body.projectStatus, id);
  }

  if (body.projectContent !== undefined) {
    // Only admins can edit content
    const { isAdmin } = await import("@/lib/admin");
    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(body.projectContent, id);

    // Update doc meta with version tracking
    const existingMeta = JSON.parse(
      ((db.prepare("SELECT project_doc_meta FROM ideas WHERE id = ?").get(id) as any)?.project_doc_meta) || "{}"
    );
    const newMeta = {
      lastEditedBy: session.user.name || session.user.email,
      lastEditedAt: new Date().toISOString(),
      version: (existingMeta.version || 0) + 1,
    };
    db.prepare("UPDATE ideas SET project_doc_meta = ? WHERE id = ?").run(JSON.stringify(newMeta), id);

    // Log activity
    const { logActivity } = await import("@/lib/db");
    logActivity({
      ideaId: id,
      eventType: "project_content_updated",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email,
    });
  }

  if (body.googleDocUrl !== undefined) {
    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    db.prepare("UPDATE ideas SET google_doc_url = ? WHERE id = ?").run(body.googleDocUrl || null, id);
  }

  if (body.projectDocs !== undefined) {
    db.prepare("UPDATE ideas SET project_docs = ? WHERE id = ?").run(
      JSON.stringify(body.projectDocs),
      id
    );
    const { logActivity } = await import("@/lib/db");
    logActivity({
      ideaId: id,
      eventType: "project_docs_updated",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email,
    });
  }

  if (body.teaserImageUrl !== undefined) {
    db.prepare("UPDATE ideas SET teaser_image_url = ? WHERE id = ?").run(body.teaserImageUrl || null, id);
    const { logActivity } = await import("@/lib/db");
    logActivity({
      ideaId: id,
      eventType: "teaser_image_updated",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email,
    });
  }

  if (body.projectLeads !== undefined) {
    // Only global admins can modify the leads list — leads can't self-demote / promote others
    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const prevRow = db.prepare("SELECT project_leads, title FROM ideas WHERE id = ?").get(id) as { project_leads?: string; title?: string } | undefined;
    let prevLeads: string[] = [];
    try { prevLeads = JSON.parse(prevRow?.project_leads || "[]"); } catch { /* ignore */ }
    db.prepare("UPDATE ideas SET project_leads = ? WHERE id = ?")
      .run(JSON.stringify(body.projectLeads), id);

    // Notify new leads (fire-and-forget)
    const newLeads: string[] = Array.isArray(body.projectLeads) ? body.projectLeads : [];
    const added = newLeads.filter((l: string) => !prevLeads.includes(l));
    if (added.length > 0) {
      (async () => {
        try {
          const { sendNotification } = await import("@/lib/notifications/dispatcher");
          const { getNotificationTemplate } = await import("@/lib/notifications/templates");
          for (const name of added) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const user = db.prepare("SELECT id FROM users WHERE name = ? OR email = ? OR github_login = ? LIMIT 1").get(name, name, name) as any;
            if (!user?.id) continue;
            const tpl = getNotificationTemplate("lead_promoted", "en", { projectTitle: prevRow?.title || "project" });
            sendNotification({
              userId: user.id, type: "lead_promoted",
              title: tpl.title, body: tpl.body,
              linkUrl: `/projects/${id}`,
              channels: ["in_app", "telegram"],
              sourceType: "project", sourceId: id,
            }).catch(() => {});
          }
        } catch (e) { console.error("[notifications] lead promotion failed:", e); }
      })();
    }
    const { logActivity } = await import("@/lib/db");
    logActivity({
      ideaId: id,
      eventType: "project_leads_updated",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email,
    });
  }

  if (body.projectResources !== undefined) {
    db.prepare("UPDATE ideas SET project_resources = ? WHERE id = ?").run(
      JSON.stringify(body.projectResources),
      id
    );
    const { logActivity } = await import("@/lib/db");
    logActivity({
      ideaId: id,
      eventType: "project_resources_updated",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email,
    });
  }

  // Remove a contributor from the project.
  // Allowed: global admin OR a project lead.
  if (typeof body.removeContributor === "string" && body.removeContributor.trim()) {
    const login = body.removeContributor.trim();

    // Fetch idea for existence check
    const idea = db
      .prepare("SELECT author_login, lead_user_id, project_leads FROM ideas WHERE id = ?")
      .get(id) as
      | {
          author_login?: string | null;
          lead_user_id?: string | null;
          project_leads?: string | null;
        }
      | undefined;

    if (!idea) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { canManageProject } = await import("@/lib/permissions/project");
    if (!canManageProject(session, id)) {
      return NextResponse.json(
        { error: "Admins or project leads only" },
        { status: 403 }
      );
    }

    // Unclaim the contributor's in-progress tasks. Don't touch submitted/done work.
    db.prepare(
      `UPDATE tasks
          SET status = 'open',
              assignee_id = NULL,
              assignee_name = NULL,
              claimed_at = NULL
        WHERE idea_id = ?
          AND assignee_name = ?
          AND status IN ('open', 'claimed', 'in-progress')`
    ).run(id, login);

    // Remove any help offers they made on this project (match by name or email)
    db.prepare(
      "DELETE FROM help_offers WHERE idea_id = ? AND (name = ? OR email = ?)"
    ).run(id, login, login);

    // Pull them out of project_leads if they had been promoted
    try {
      const leads: string[] = JSON.parse(idea.project_leads || "[]");
      if (Array.isArray(leads) && leads.includes(login)) {
        const newLeads = leads.filter((l) => l !== login);
        db.prepare("UPDATE ideas SET project_leads = ? WHERE id = ?").run(
          JSON.stringify(newLeads),
          id
        );
      }
    } catch {
      // malformed JSON — leave untouched
    }

    const { logActivity } = await import("@/lib/db");
    logActivity({
      ideaId: id,
      eventType: "contributor_removed",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email || undefined,
      details: login,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
