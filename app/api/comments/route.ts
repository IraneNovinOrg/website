import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, logActivity } from "@/lib/db/index";
import { isAdmin as isAdminEmail } from "@/lib/admin";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId =
      (session?.user as { id?: string } | undefined)?.id ||
      session?.user?.email ||
      null;
    const limited = limitOrRespond(request, userId, {
      max: 30,
      windowMs: 60 * 60 * 1000,
      bucket: "comments",
    });
    if (limited) return limited;

    const body = await request.json();
    const { discussionId, body: commentBody, name, category, replyTo } = body;

    if (!discussionId || !commentBody) {
      return NextResponse.json(
        { error: "Missing required fields", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorLogin = session?.user?.name || session?.user?.email || name || "Anonymous";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorAvatar = (session?.user as any)?.image || "";

    // Store the comment body - prepend category tag if provided
    const finalBody = category && category !== "general"
      ? `[${category}] ${commentBody}`
      : commentBody;

    db.prepare(
      `INSERT INTO idea_comments (id, idea_id, body, author_login, author_avatar, created_at, source, reply_to)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 'local', ?)`
    ).run(id, discussionId, finalBody, authorLogin, authorAvatar, replyTo || null);

    logActivity({
      ideaId: discussionId,
      eventType: "comment_added",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actorId: (session?.user as any)?.id,
      actorName: authorLogin,
      details: commentBody.slice(0, 100),
    });

    // Fire-and-forget: notify parent comment author of the reply.
    if (replyTo) {
      (async () => {
        try {
          const db2 = getDb();
          const parent = db2
            .prepare(
              "SELECT author_login, idea_id FROM idea_comments WHERE id = ?"
            )
            .get(replyTo) as { author_login?: string; idea_id?: string } | undefined;
          if (!parent?.author_login) return;
          if (parent.author_login === authorLogin) return; // don't notify self
          const parentUser = db2
            .prepare(
              "SELECT id FROM users WHERE name = ? OR email = ? OR github_login = ? LIMIT 1"
            )
            .get(parent.author_login, parent.author_login, parent.author_login) as { id?: string } | undefined;
          if (!parentUser?.id) return;

          const { sendNotification } = await import(
            "@/lib/notifications/dispatcher"
          );
          const { getNotificationTemplate } = await import(
            "@/lib/notifications/templates"
          );
          const tpl = getNotificationTemplate("comment_reply", "en", {
            actorName: authorLogin,
            preview: commentBody.slice(0, 140),
          });
          sendNotification({
            userId: parentUser.id,
            type: "comment_reply",
            title: tpl.title,
            body: tpl.body,
            linkUrl: `/ideas/${discussionId}#comment-${id}`,
            channels: ["in_app", "telegram"],
            sourceType: "comment",
            sourceId: id,
          }).catch(console.error);
        } catch (e) {
          console.error("[notifications] comment_reply dispatch failed:", e);
        }
      })();
    }

    // Trigger AI re-evaluation if comment is substantial and author is not the AI itself.
    // Non-blocking: do NOT await so the response isn't delayed.
    const isAiAuthor =
      authorLogin === "ai-assistant" || authorLogin === "AI Assistant";
    if (!isAiAuthor && commentBody.length > 30) {
      import("@/lib/ai-trigger")
        .then(({ handleProjectEvent }) => {
          handleProjectEvent(discussionId, "new_comment", { commentId: id }).catch(
            console.error
          );
        })
        .catch(console.error);
    }

    // Fan out to project subscribers / members / leads (fire-and-forget)
    if (!isAiAuthor) {
      (async () => {
        try {
          const db2 = getDb();
          const idea = db2.prepare("SELECT title FROM ideas WHERE id = ?").get(discussionId) as { title?: string } | undefined;
          const { notifyProject } = await import("@/lib/notifications/projectFanout");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const actorUserId = (session?.user as any)?.id || null;
          await notifyProject({
            ideaId: discussionId,
            type: "new_comment",
            title: `New comment on "${idea?.title || "project"}"`,
            body: `${authorLogin}: ${commentBody.slice(0, 140)}`,
            linkUrl: `/projects/${discussionId}#comment-${id}`,
            sourceType: "comment",
            sourceId: id,
            excludeUserId: actorUserId,
          });
        } catch (e) {
          console.error("[notifications] project fanout failed:", e);
        }
      })();
    }

    return NextResponse.json({
      comment: { id, idea_id: discussionId, body: finalBody, author_login: authorLogin, author_avatar: authorAvatar, source: "local", reply_to: replyTo || null, created_at: new Date().toISOString() }
    }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comments error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { commentId, body: newBody } = await request.json();
    if (!commentId || !newBody?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const db = getDb();
    // Only allow editing own comments (match by author_login)
    const authorLogin = session.user.name || session.user.email || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = db.prepare("SELECT * FROM idea_comments WHERE id = ? AND author_login = ? AND source = 'local'").get(commentId, authorLogin) as any;
    if (!existing) {
      return NextResponse.json({ error: "Comment not found or not yours" }, { status: 404 });
    }
    db.prepare("UPDATE idea_comments SET body = ?, edited_at = datetime('now') WHERE id = ?").run(newBody.trim(), commentId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { commentId } = await request.json();
    if (!commentId) {
      return NextResponse.json({ error: "commentId required" }, { status: 400 });
    }
    const db = getDb();
    const authorLogin = session.user.name || session.user.email || "";
    // Allow own comments or admin
    const isAdmin = isAdminEmail(session.user.email);

    // If not admin, verify ownership before cascading.
    if (!isAdmin) {
      const owned = db
        .prepare(
          "SELECT id FROM idea_comments WHERE id = ? AND author_login = ? AND source = 'local'"
        )
        .get(commentId, authorLogin);
      if (!owned) {
        return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
      }
    }

    // Cascade delete: reactions on replies -> replies -> reactions on parent -> parent.
    const cascade = db.transaction((parentId: string) => {
      db.prepare(
        "DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM idea_comments WHERE reply_to = ?)"
      ).run(parentId);
      db.prepare("DELETE FROM idea_comments WHERE reply_to = ?").run(parentId);
      db.prepare("DELETE FROM comment_reactions WHERE comment_id = ?").run(parentId);
      db.prepare("DELETE FROM idea_comments WHERE id = ?").run(parentId);
    });
    cascade(commentId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
