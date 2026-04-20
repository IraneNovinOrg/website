import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { sendNotification } from "@/lib/notifications/dispatcher";
import { limitOrRespond } from "@/lib/rate-limit";

const REACTION_EMOJI: Record<string, string> = {
  upvote: "👍",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
  party: "🎉",
};

/**
 * Notify the author of a comment that someone reacted. Best-effort — silently
 * no-ops when the comment is GitHub-synced (no local author_id) or when the
 * reactor is the author themself.
 */
async function notifyReaction(args: {
  commentId: string;
  reactionType: string;
  reactorUserId: string;
  reactorName: string;
}): Promise<void> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.id, c.idea_id, c.author_id, c.author_login, c.body,
              i.title AS idea_title
       FROM idea_comments c
       LEFT JOIN ideas i ON i.id = c.idea_id
       WHERE c.id = ?`
    )
    .get(args.commentId) as
    | {
        id: string;
        idea_id: string;
        author_id: string | null;
        author_login: string | null;
        body: string | null;
        idea_title: string | null;
      }
    | undefined;

  if (!row) return;

  // Resolve the recipient: prefer author_id (local user row). Fall back to
  // looking up by github_login on users table for GitHub-synced accounts.
  let recipientId = row.author_id || null;
  if (!recipientId && row.author_login) {
    const u = db
      .prepare(
        "SELECT id FROM users WHERE github_login = ? OR email = ? LIMIT 1"
      )
      .get(row.author_login, row.author_login) as { id: string } | undefined;
    if (u) recipientId = u.id;
  }

  if (!recipientId || recipientId === args.reactorUserId) return;

  const emoji = REACTION_EMOJI[args.reactionType] || "👍";
  const snippet = (row.body || "").replace(/\s+/g, " ").slice(0, 80);
  const ideaPath = row.idea_id.startsWith("iae-")
    ? `/projects/${row.idea_id}`
    : `/ideas/${row.idea_id}`;

  await sendNotification({
    userId: recipientId,
    type: "comment_reaction",
    title: `${args.reactorName} reacted ${emoji} to your comment`,
    body: snippet
      ? `"${snippet}${(row.body || "").length > 80 ? "…" : ""}" on "${row.idea_title || "your idea"}"`
      : row.idea_title || undefined,
    linkUrl: `${ideaPath}?tab=discussion#comment-${row.id}`,
    sourceType: "comment",
    sourceId: row.id,
    channels: ["in_app", "telegram"],
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const rlUserId =
      (session.user as { id?: string }).id || session.user.email || null;
    const limited = limitOrRespond(request, rlUserId, {
      max: 120,
      windowMs: 60 * 60 * 1000,
      bucket: "reactions",
    });
    if (limited) return limited;

    const { commentId, reactionType } = await request.json();

    if (!commentId || !reactionType) {
      return NextResponse.json(
        { error: "commentId and reactionType are required" },
        { status: 400 }
      );
    }

    const validTypes = ["upvote", "heart", "rocket", "eyes", "party"];
    if (!validTypes.includes(reactionType)) {
      return NextResponse.json(
        { error: `Invalid reactionType. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id || session.user.email || "";
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const db = getDb();

    // Toggle: check if reaction already exists
    const existing = db
      .prepare(
        "SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction_type = ?"
      )
      .get(commentId, userId, reactionType);

    if (existing) {
      // Remove existing reaction
      db.prepare(
        "DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction_type = ?"
      ).run(commentId, userId, reactionType);
    } else {
      // Add new reaction
      const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      db.prepare(
        "INSERT INTO comment_reactions (id, comment_id, user_id, reaction_type) VALUES (?, ?, ?, ?)"
      ).run(id, commentId, userId, reactionType);

      // Fire-and-forget: notify the comment author that someone reacted.
      // Skip if reacting to your own comment, to an idea-level reaction
      // (which is just an upvote on the idea itself), or if the author is a
      // GitHub-synced user with no local account.
      if (!commentId.startsWith("idea-")) {
        notifyReaction({
          commentId,
          reactionType,
          reactorUserId: userId,
          reactorName: session.user.name || session.user.email || "Someone",
        }).catch((e) =>
          console.error("[reactions] notify failed:", e)
        );
      }
    }

    // Fetch updated counts for this comment (local reactions)
    const counts = db
      .prepare(
        "SELECT reaction_type, COUNT(*) as count FROM comment_reactions WHERE comment_id = ? GROUP BY reaction_type"
      )
      .all(commentId) as { reaction_type: string; count: number }[];

    const reactions: Record<string, number> = {};
    for (const row of counts) {
      reactions[row.reaction_type] = row.count;
    }

    // Merge GitHub upvotes into the response so the UI shows combined counts.
    // For idea-level reactions (commentId starts with "idea-"), look up the ideas table.
    // For regular comments, look up idea_comments.
    if (commentId.startsWith("idea-")) {
      const realIdeaId = commentId.slice(5); // strip "idea-" prefix
      const ghRow = db
        .prepare("SELECT COALESCE(github_vote_count, 0) as gh_votes FROM ideas WHERE id = ?")
        .get(realIdeaId) as { gh_votes: number } | undefined;
      if (ghRow && ghRow.gh_votes > 0) {
        reactions.upvote = (reactions.upvote || 0) + ghRow.gh_votes;
      }
    } else {
      const ghRow = db
        .prepare("SELECT COALESCE(github_vote_count, 0) as gh_votes FROM idea_comments WHERE id = ?")
        .get(commentId) as { gh_votes: number } | undefined;
      if (ghRow && ghRow.gh_votes > 0) {
        reactions.upvote = (reactions.upvote || 0) + ghRow.gh_votes;
      }
    }

    // Fetch which reactions the current user has on this comment
    const userReactions = db
      .prepare(
        "SELECT reaction_type FROM comment_reactions WHERE comment_id = ? AND user_id = ?"
      )
      .all(commentId, userId) as { reaction_type: string }[];

    const userReacted: Record<string, boolean> = {};
    for (const row of userReactions) {
      userReacted[row.reaction_type] = true;
    }

    return NextResponse.json({ reactions, userReacted });
  } catch (e) {
    console.error("POST /api/comments/reactions error:", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const commentIdsParam = searchParams.get("commentIds");

    if (!commentIdsParam) {
      return NextResponse.json(
        { error: "commentIds query parameter is required" },
        { status: 400 }
      );
    }

    const commentIds = commentIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (commentIds.length === 0) {
      return NextResponse.json({});
    }

    // Limit to 100 IDs per request to prevent abuse
    if (commentIds.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 comment IDs per request" },
        { status: 400 }
      );
    }

    const db = getDb();
    const placeholders = commentIds.map(() => "?").join(",");

    // Fetch local reaction counts
    const rows = db
      .prepare(
        `SELECT comment_id, reaction_type, COUNT(*) as count
         FROM comment_reactions
         WHERE comment_id IN (${placeholders})
         GROUP BY comment_id, reaction_type`
      )
      .all(...commentIds) as {
      comment_id: string;
      reaction_type: string;
      count: number;
    }[];

    // Fetch github_vote_count for each comment so we can merge with local upvotes.
    // Split into regular comment IDs and idea-level IDs (prefixed with "idea-").
    const regularCommentIds = commentIds.filter((id) => !id.startsWith("idea-"));
    const ideaCommentIds = commentIds.filter((id) => id.startsWith("idea-"));
    const ideaRealIds = ideaCommentIds.map((id) => id.slice(5));

    const ghVoteMap: Record<string, number> = {};

    if (regularCommentIds.length > 0) {
      const regPlaceholders = regularCommentIds.map(() => "?").join(",");
      const ghRows = db
        .prepare(
          `SELECT id, COALESCE(github_vote_count, 0) as gh_votes
           FROM idea_comments
           WHERE id IN (${regPlaceholders})`
        )
        .all(...regularCommentIds) as { id: string; gh_votes: number }[];
      for (const row of ghRows) {
        if (row.gh_votes > 0) {
          ghVoteMap[row.id] = row.gh_votes;
        }
      }
    }

    if (ideaRealIds.length > 0) {
      const ideaPlaceholders = ideaRealIds.map(() => "?").join(",");
      const ideaGhRows = db
        .prepare(
          `SELECT id, COALESCE(github_vote_count, 0) as gh_votes
           FROM ideas
           WHERE id IN (${ideaPlaceholders})`
        )
        .all(...ideaRealIds) as { id: string; gh_votes: number }[];
      for (const row of ideaGhRows) {
        if (row.gh_votes > 0) {
          // Map back using the "idea-" prefix
          ghVoteMap[`idea-${row.id}`] = row.gh_votes;
        }
      }
    }

    const result: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!result[row.comment_id]) {
        result[row.comment_id] = {};
      }
      result[row.comment_id][row.reaction_type] = row.count;
    }

    // Merge GitHub upvotes into the "upvote" counts
    for (const commentId of commentIds) {
      const ghVotes = ghVoteMap[commentId] || 0;
      if (ghVotes > 0) {
        if (!result[commentId]) {
          result[commentId] = {};
        }
        result[commentId].upvote = (result[commentId].upvote || 0) + ghVotes;
      }
    }

    // If user is logged in, also return which reactions they have
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session?.user as any)?.id || session?.user?.email || "";
    const userReactedMap: Record<string, Record<string, boolean>> = {};
    if (userId) {
      const userRows = db
        .prepare(
          `SELECT comment_id, reaction_type
           FROM comment_reactions
           WHERE comment_id IN (${placeholders}) AND user_id = ?`
        )
        .all(...commentIds, userId) as { comment_id: string; reaction_type: string }[];

      for (const row of userRows) {
        if (!userReactedMap[row.comment_id]) {
          userReactedMap[row.comment_id] = {};
        }
        userReactedMap[row.comment_id][row.reaction_type] = true;
      }
    }

    return NextResponse.json({ counts: result, userReacted: userReactedMap });
  } catch (e) {
    console.error("GET /api/comments/reactions error:", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
