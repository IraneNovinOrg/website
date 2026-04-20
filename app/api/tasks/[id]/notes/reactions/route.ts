import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";

const VALID_REACTION_TYPES = ["upvote", "heart", "rocket", "eyes", "party"] as const;
type ReactionType = (typeof VALID_REACTION_TYPES)[number];

function isValidType(t: unknown): t is ReactionType {
  return typeof t === "string" && (VALID_REACTION_TYPES as readonly string[]).includes(t);
}

interface SessionUserLike {
  id?: string | null;
  email?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const { noteId, reactionType } = body as { noteId?: string; reactionType?: string };

    if (!noteId || !reactionType) {
      return NextResponse.json(
        { error: "noteId and reactionType are required" },
        { status: 400 }
      );
    }

    if (!isValidType(reactionType)) {
      return NextResponse.json(
        { error: `Invalid reactionType. Must be one of: ${VALID_REACTION_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const u = session.user as SessionUserLike;
    const userId = u.id || u.email || "";
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const db = getDb();

    // Verify the note exists
    const note = db.prepare("SELECT id FROM task_notes WHERE id = ?").get(noteId);
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Toggle
    const existing = db
      .prepare(
        "SELECT id FROM task_note_reactions WHERE note_id = ? AND user_id = ? AND reaction_type = ?"
      )
      .get(noteId, userId, reactionType);

    if (existing) {
      db.prepare(
        "DELETE FROM task_note_reactions WHERE note_id = ? AND user_id = ? AND reaction_type = ?"
      ).run(noteId, userId, reactionType);
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      db.prepare(
        "INSERT INTO task_note_reactions (id, note_id, user_id, reaction_type) VALUES (?, ?, ?, ?)"
      ).run(id, noteId, userId, reactionType);
    }

    const counts = db
      .prepare(
        "SELECT reaction_type, COUNT(*) as count FROM task_note_reactions WHERE note_id = ? GROUP BY reaction_type"
      )
      .all(noteId) as { reaction_type: string; count: number }[];

    const reactions: Record<string, number> = {};
    for (const row of counts) {
      reactions[row.reaction_type] = row.count;
    }

    const userReactionRows = db
      .prepare(
        "SELECT reaction_type FROM task_note_reactions WHERE note_id = ? AND user_id = ?"
      )
      .all(noteId, userId) as { reaction_type: string }[];

    const userReacted: Record<string, boolean> = {};
    for (const row of userReactionRows) {
      userReacted[row.reaction_type] = true;
    }

    return NextResponse.json({ reactions, userReacted });
  } catch (e) {
    console.error("POST /api/tasks/[id]/notes/reactions error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteIdsParam = searchParams.get("noteIds");
    if (!noteIdsParam) {
      return NextResponse.json(
        { error: "noteIds query parameter is required" },
        { status: 400 }
      );
    }

    const noteIds = noteIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (noteIds.length === 0) {
      return NextResponse.json({});
    }

    if (noteIds.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 note IDs per request" },
        { status: 400 }
      );
    }

    const db = getDb();
    const placeholders = noteIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT note_id, reaction_type, COUNT(*) as count
         FROM task_note_reactions
         WHERE note_id IN (${placeholders})
         GROUP BY note_id, reaction_type`
      )
      .all(...noteIds) as { note_id: string; reaction_type: string; count: number }[];

    const result: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!result[row.note_id]) {
        result[row.note_id] = {};
      }
      result[row.note_id][row.reaction_type] = row.count;
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/tasks/[id]/notes/reactions error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
