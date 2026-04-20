import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ notifications: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id || session.user.email || "";
  const db = getDb();

  const notifications = db.prepare(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(userId);

  return NextResponse.json(
    { notifications },
    {
      // Per-user data, so private. 15s client cache means the bell won't
      // re-fetch on rapid route changes, but polls every 2min still see fresh.
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
    }
  );
}

// Mark notification as read
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }

  const { notificationId } = await request.json();
  if (!notificationId) {
    return NextResponse.json({ error: "notificationId required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notificationId);
  return NextResponse.json({ success: true });
}
