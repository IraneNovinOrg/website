/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, logActivity } from "@/lib/db/index";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 30,
    windowMs: 60 * 60 * 1000,
    bucket: "project-comment",
  });
  if (limited) return limited;

  const { body, replyTo } = await request.json();
  if (!body || body.trim().length < 10) {
    return NextResponse.json(
      { error: "Comment must be at least 10 characters" },
      { status: 400 }
    );
  }
  const replyToId: string | null =
    typeof replyTo === "string" && replyTo.trim().length > 0 ? replyTo : null;

  const db = getDb();

  // Verify idea exists
  const idea = db.prepare("SELECT id FROM ideas WHERE id = ?").get(id);
  if (!idea) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const commentId =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const authorLogin =
    (session.user as any).githubLogin ||
    session.user.name ||
    session.user.email ||
    "Anonymous";
  const authorAvatar = (session.user as any).image || "";
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO idea_comments (id, idea_id, body, author_login, author_avatar, created_at, source, reply_to)
     VALUES (?, ?, ?, ?, ?, ?, 'local', ?)`
  ).run(commentId, id, body.trim(), authorLogin, authorAvatar, createdAt, replyToId);

  logActivity({
    ideaId: id,
    eventType: "comment_added",
    actorId: (session.user as any).id,
    actorName: authorLogin,
    details: body.trim().slice(0, 100),
  });

  // Check for auto-promotion after commenting
  import("@/lib/permissions").then(({ checkAutoPromotion }) => {
    const commentUserId = (session.user as any).id;
    if (commentUserId) checkAutoPromotion(commentUserId);
  });

  // Dispatch to ai-trigger (which fires replyToComment skill with a 5s delay)
  if (body.trim().length > 30) {
    import("@/lib/ai-trigger").then(({ handleProjectEvent }) => {
      handleProjectEvent(id, "new_comment", { commentId }).catch(console.error);
    });
  }

  // Legacy AI auto-reply path — disabled to avoid duplicate replies.
  if (false && body.trim().length > 30) {
    import("@/lib/ai").then(async ({ generateAIReply }) => {
      try {
        const ideaRow = db
          .prepare("SELECT title, body FROM ideas WHERE id = ?")
          .get(id) as any;
        if (!ideaRow) return;

        const recentComments = db
          .prepare(
            "SELECT body, author_login as authorName FROM idea_comments WHERE idea_id = ? ORDER BY created_at DESC LIMIT 10"
          )
          .all(id) as any[];

        const reply = await generateAIReply(
          { title: ideaRow.title, body: ideaRow.body },
          { body: body.trim(), authorName: authorLogin },
          recentComments.reverse()
        );

        if (reply) {
          const aiId =
            Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          db.prepare(
            `INSERT INTO idea_comments (id, idea_id, body, author_login, author_avatar, created_at, source, reply_to)
             VALUES (?, ?, ?, 'AI Assistant', '', datetime('now'), 'local', ?)`
          ).run(aiId, id, reply, commentId);

          // Notify the commenter about the AI reply
          const commentUserId = session?.user
            ? (session.user as { id?: string }).id
            : undefined;
          if (commentUserId) {
            const { createNotification } = await import("@/lib/db/index");
            createNotification(
              commentUserId,
              "ai_reply",
              "AI responded to your comment",
              reply.slice(0, 100),
              `/projects/${id}`
            );
          }
        }
      } catch (e) {
        console.error("[AI Reply] Error:", e);
      }
    });
  }

  return NextResponse.json(
    {
      comment: {
        id: commentId,
        idea_id: id,
        body: body.trim(),
        author_login: authorLogin,
        author_avatar: authorAvatar,
        created_at: createdAt,
        source: "local",
        reply_to: replyToId,
      },
    },
    { status: 201 }
  );
}
