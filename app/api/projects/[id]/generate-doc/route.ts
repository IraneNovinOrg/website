/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { generateProjectDocument, getCachedAnalysis } from "@/lib/ai";
import { getTasksForIdea, getAcceptedWork } from "@/lib/ai-tasks";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 5,
    windowMs: 60 * 60 * 1000,
    bucket: "project-doc",
  });
  if (limited) return limited;

  const db = getDb();
  const idea = db.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as any;
  if (!idea) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const analysis = getCachedAnalysis(id);
  const comments = db.prepare(
    "SELECT body, author_login FROM idea_comments WHERE idea_id = ? ORDER BY created_at ASC"
  ).all(id) as any[];
  const tasks = getTasksForIdea(id);
  const accepted = getAcceptedWork(id);

  try {
    const doc = await generateProjectDocument({
      id,
      title: idea.title,
      body: idea.body,
      category: idea.category || "General",
      status: idea.project_status || "idea",
      analysis,
      comments: comments.map((c: any) => ({ body: c.body, author: c.author_login || "Unknown" })),
      tasks: tasks.map((t: any) => ({ title: t.title, status: t.status, description: t.description })),
      completedWork: accepted.map((w: any) => ({ taskTitle: w.taskId, content: w.content })),
    });

    db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(doc, id);
    try {
      db.prepare("UPDATE ideas SET last_ai_document_at = datetime('now') WHERE id = ?").run(id);
    } catch { /* column may not exist yet */ }
    try {
      const { logActivity } = await import("@/lib/db");
      logActivity({
        ideaId: id,
        eventType: "ai_document_updated",
        actorName: "AI Assistant",
        details: `Admin-triggered regeneration (${doc.length} chars)`,
      });
    } catch { /* logger unavailable */ }

    // Sync to Google Docs if configured
    try {
      const { isGoogleDocsConfigured, createProjectDoc, writeToDoc } = await import("@/lib/google-docs");
      if (isGoogleDocsConfigured()) {
        const existingDocUrl = idea.google_doc_url as string | null;
        if (existingDocUrl) {
          const docId = existingDocUrl.match(/\/d\/([\w-]+)/)?.[1];
          if (docId) await writeToDoc({ docId, content: doc });
        } else {
          const result = await createProjectDoc({
            title: idea.title,
            ideaId: id,
            initialContent: doc,
          });
          if (result) {
            db.prepare("UPDATE ideas SET google_doc_url = ? WHERE id = ?").run(result.docUrl, id);
          }
        }
      }
    } catch (e) {
      console.error(`[generate-doc] Google Docs sync failed for ${id}:`, e);
    }

    return NextResponse.json({ document: doc });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
