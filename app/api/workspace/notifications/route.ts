import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listForUser,
  markRead,
  markAllRead,
  countUnread,
} from "@/lib/db/notifications";

/**
 * Workspace V2 — Phase 4: Notifications endpoint.
 *
 *  GET  /api/workspace/notifications?limit=20&unread=true
 *    Returns the signed-in user's notifications ordered by newest first.
 *    Also returns `unreadCount` so the bell badge can update in a single
 *    round-trip.
 *
 *  POST /api/workspace/notifications { id, action: "markRead" | "markAllRead" }
 *    Marks a single notification (by id) or every unread one as read for
 *    the current user. Always scoped to the session user.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string | null } | undefined)?.id;
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 20;
  const onlyUnread = url.searchParams.get("unread") === "true";

  const notifications = listForUser(userId, limit, onlyUnread);
  const unreadCount = countUnread(userId);

  return NextResponse.json(
    { notifications, unreadCount },
    {
      // Per-user; 15s private cache so rapid re-renders don't refetch.
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
    }
  );
}

interface PostBody {
  id?: string;
  action?: "markRead" | "markAllRead";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string | null } | undefined)?.id;
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "markAllRead") {
    const res = markAllRead(userId);
    return NextResponse.json({ ok: true, count: res.count });
  }

  if (body.action === "markRead") {
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const res = markRead(body.id, userId);
    return NextResponse.json({ ok: res.ok });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
