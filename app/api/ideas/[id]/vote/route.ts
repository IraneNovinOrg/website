/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { castVote, getDb } from "@/lib/db/index";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to vote", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const userId = (session.user as any).id || session.user.email || "";
  if (!userId) {
    return NextResponse.json({ error: "No user ID" }, { status: 400 });
  }

  const limited = limitOrRespond(request, userId, {
    max: 120,
    windowMs: 60 * 60 * 1000,
    bucket: "votes",
  });
  if (limited) return limited;

  // Accept optional reason
  let reason = null;
  try {
    const body = await request.json();
    reason = body?.reason || null;
  } catch { /* no body = no reason, that's ok */ }

  const result = castVote(id, userId);

  // Store reason if a brand-new vote was just created.
  if (reason && result.hasVoted) {
    const db = getDb();
    db.prepare("UPDATE votes SET vote_reason = ? WHERE idea_id = ? AND user_id = ?").run(reason, id, userId);
  }

  return NextResponse.json({
    voteCount: result.totalVotes,
    hasVoted: result.hasVoted,
    // Back-compat for any callers still reading alreadyVoted.
    alreadyVoted: result.hasVoted,
  });
}
