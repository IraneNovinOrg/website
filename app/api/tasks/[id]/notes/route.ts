import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  addTaskNote,
  updateTaskNote,
  deleteTaskNote,
  getTaskById,
} from "@/lib/ai-tasks";
import { isAdmin } from "@/lib/admin";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 40,
    windowMs: 60 * 60 * 1000,
    bucket: "task-notes",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { content, replyTo } = body as { content?: string; replyTo?: string | null };

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    const userId = session.user.id || session.user.email || "unknown";
    const userName = session.user.name || "Anonymous";

    const task = addTaskNote(
      id,
      userId,
      userName,
      content.trim(),
      typeof replyTo === "string" && replyTo ? replyTo : null
    );
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Dispatch to AI agent for task_note_added
    if (content.length > 30) {
      // Find the note we just inserted (most recent by this author)
      const newestNote = [...(task.notes || [])]
        .filter((n) => n.authorId === userId)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];

      import("@/lib/ai-trigger").then(({ handleProjectEvent }) => {
        handleProjectEvent(task.ideaId, "task_note_added", {
          noteId: newestNote?.id,
        }).catch(console.error);
      });

      // Keep legacy agent event for backward-compat
      import("@/lib/ai/agent").then(({ handleAgentEvent }) => {
        handleAgentEvent({
          type: "task_note_added",
          ideaId: task.ideaId,
          entityId: id,
          actorName: userName,
          content,
        }).catch(console.error);
      });
    }

    return NextResponse.json({ task });
  } catch (e) {
    console.error("POST /api/tasks/[id]/notes error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId, content } = body as { noteId?: string; content?: string };

    if (!noteId || !content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "noteId and content required" }, { status: 400 });
    }

    const userId = session.user.id || session.user.email || "unknown";
    const result = updateTaskNote(noteId, userId, content.trim());
    if (!result.ok) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const task = getTaskById(id);
    return NextResponse.json({ task });
  } catch (e) {
    console.error("PUT /api/tasks/[id]/notes error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId } = body as { noteId?: string };
    if (!noteId) {
      return NextResponse.json({ error: "noteId required" }, { status: 400 });
    }

    const userId = session.user.id || session.user.email || "unknown";
    const admin = isAdmin(session.user.email);
    const result = deleteTaskNote(noteId, userId, admin);
    if (!result.ok) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const task = getTaskById(id);
    return NextResponse.json({ task });
  } catch (e) {
    console.error("DELETE /api/tasks/[id]/notes error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
