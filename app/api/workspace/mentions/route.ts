import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listForUser } from "@/lib/db/mentions";

/**
 * Workspace V2 — Phase 4: Mentions endpoint.
 *
 * GET /api/workspace/mentions
 *   Returns the last 50 mentions for the current user. The inbox surface
 *   uses this to render a "mentioned me" feed separate from the general
 *   notifications list.
 */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string | null } | undefined)?.id;
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const mentions = listForUser(userId, 50);
  return NextResponse.json(
    { mentions },
    { headers: { "Cache-Control": "no-cache" } }
  );
}
