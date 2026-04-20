/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, logActivity } from "@/lib/db/index";
import { limitOrRespond } from "@/lib/rate-limit";

function genId(): string {
  return "sug-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** GET: List suggestions for an idea. */
export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get("ideaId");
  if (!ideaId) {
    return NextResponse.json({ error: "ideaId required" }, { status: 400 });
  }

  const db = getDb();
  const suggestions = db
    .prepare(
      "SELECT id, idea_id, user_id, user_name, original_content, suggested_content, diff_summary, status, ai_verdict, ai_reason, ai_reviewed_at, reviewed_by, reviewed_at, created_at FROM document_suggestions WHERE idea_id = ? ORDER BY created_at DESC"
    )
    .all(ideaId);

  return NextResponse.json({ suggestions });
}

/**
 * POST: Create a new document suggestion.
 * Fires an AI auto-review in the background:
 *   - verdict "approve": apply immediately, mark approved
 *   - verdict "reject": mark rejected with reason, notify admins+leads
 *   - verdict "defer": stays pending, notifies admins+leads to decide
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limited = limitOrRespond(request, session.user.id, {
    max: 20,
    windowMs: 60 * 60 * 1000,
    bucket: "doc-suggest",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { ideaId, originalContent, suggestedContent, diffSummary } = body;

    if (!ideaId || !suggestedContent) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const db = getDb();
    const idea = db.prepare("SELECT id, title FROM ideas WHERE id = ?").get(ideaId) as { id: string; title: string } | undefined;
    if (!idea) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const id = genId();
    db.prepare(
      `INSERT INTO document_suggestions (id, idea_id, user_id, user_name, original_content, suggested_content, diff_summary, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(
      id,
      ideaId,
      session.user.id,
      session.user.name || "Anonymous",
      originalContent || "",
      suggestedContent,
      diffSummary || null
    );

    // Fire-and-forget AI auto-review — create a retryable ai_job so a transient
    // AI outage doesn't silently drop this suggestion.
    const { createJob, runJobInBackground } = await import("@/lib/ai-jobs");
    const jobId = createJob(ideaId, "review-doc-suggestion", {
      suggestionId: id,
      projectTitle: idea.title,
      original: originalContent || "",
      suggested: suggestedContent,
    });

    runJobInBackground(jobId, async () => {
      const { reviewDocSuggestion } = await import("@/lib/ai/review-doc-suggestion");
      const verdict = await reviewDocSuggestion(idea.title, originalContent || "", suggestedContent);

      const db2 = getDb();
      db2.prepare(
        "UPDATE document_suggestions SET ai_verdict = ?, ai_reason = ?, ai_reviewed_at = datetime('now') WHERE id = ?"
      ).run(verdict.verdict, verdict.reason, id);

      if (verdict.verdict === "approve") {
        db2.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(suggestedContent, ideaId);
        db2.prepare(
          "UPDATE document_suggestions SET status = 'approved', reviewed_by = 'AI (auto)', reviewed_at = datetime('now') WHERE id = ?"
        ).run(id);
        logActivity({
          ideaId, eventType: "doc_suggestion_auto_approved",
          actorName: session.user.name || session.user.email || "User",
          details: `${verdict.reason.slice(0, 100)}`,
        });
      } else if (verdict.verdict === "reject") {
        db2.prepare(
          "UPDATE document_suggestions SET status = 'rejected', reviewed_by = 'AI (auto)', reviewed_at = datetime('now') WHERE id = ?"
        ).run(id);
        const { notifyProject } = await import("@/lib/notifications/projectFanout");
        await notifyProject({
          ideaId,
          type: "doc_suggestion",
          title: "Edit suggestion auto-rejected",
          body: `${session.user.name || "A user"} suggested changes that AI flagged: ${verdict.reason}`,
          linkUrl: `/projects/${ideaId}?tab=document`,
          sourceType: "doc_suggestion",
          sourceId: id,
          includeAdmins: true,
        });
      } else {
        // Defer → notify managers to decide
        const { notifyProject } = await import("@/lib/notifications/projectFanout");
        await notifyProject({
          ideaId,
          type: "doc_suggestion",
          title: "Document edit suggestion needs review",
          body: `${session.user.name || "A user"} proposed changes to "${idea.title}". AI: ${verdict.reason}`,
          linkUrl: `/projects/${ideaId}?tab=document`,
          sourceType: "doc_suggestion",
          sourceId: id,
          includeAdmins: true,
        });
      }
      return JSON.stringify(verdict);
    });

    return NextResponse.json({ success: true, id, jobId }, { status: 201 });
  } catch (e) {
    console.error("POST /api/document-suggestions error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH: Approve or reject a suggestion (admin or project lead). */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { suggestionId, action } = body;

    if (!suggestionId || !["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const db = getDb();
    const suggestion = db.prepare("SELECT * FROM document_suggestions WHERE id = ?").get(suggestionId) as any;
    if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });

    // Admin OR project lead can approve/reject
    const { canManageProject } = await import("@/lib/permissions/project");
    if (!canManageProject(session, suggestion.idea_id)) {
      return NextResponse.json({ error: "Admin or project lead only" }, { status: 403 });
    }

    db.prepare(
      "UPDATE document_suggestions SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?"
    ).run(action, session.user.email, suggestionId);

    if (action === "approved") {
      db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?")
        .run(suggestion.suggested_content, suggestion.idea_id);
    }

    // Notify the user who made the suggestion
    (async () => {
      try {
        if (!suggestion.user_id) return;
        const { sendNotification } = await import("@/lib/notifications/dispatcher");
        const title = action === "approved"
          ? "Your document suggestion was approved"
          : "Your document suggestion was not applied";
        const bodyMsg = action === "approved"
          ? "Thanks for improving the project document!"
          : "A project lead decided this change wasn't a fit right now.";
        sendNotification({
          userId: suggestion.user_id,
          type: "doc_suggestion",
          title, body: bodyMsg,
          linkUrl: `/projects/${suggestion.idea_id}?tab=document`,
          channels: ["in_app"],
          sourceType: "doc_suggestion", sourceId: suggestionId,
        }).catch(() => {});
      } catch (e) { console.error("[doc-suggestion] notify failed:", e); }
    })();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH /api/document-suggestions error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
