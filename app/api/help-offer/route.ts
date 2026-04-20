import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/index";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Please sign in to join this project.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  if (!session.user.id) {
    return NextResponse.json(
      { error: "Your session is missing account information. Please sign out and sign back in.", code: "SESSION_INVALID" },
      { status: 401 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success } = rateLimit(`help-offer:${ip}`, 20, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    // Accept both "description" and "message" from the client
    const { ideaId, skills, description, message, hoursPerWeek, wantNotifications } =
      body;

    if (!ideaId) {
      return NextResponse.json(
        { error: "ideaId is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if the user already joined this project
    const existing = db.prepare(
      "SELECT id FROM help_offers WHERE idea_id = ? AND user_id = ?"
    ).get(ideaId, session.user.id);

    if (existing) {
      return NextResponse.json(
        { success: true, alreadyJoined: true },
        { status: 200 }
      );
    }

    // Make description and hoursPerWeek optional with sensible defaults
    const finalDescription = description || message || "I want to contribute to this project!";
    const finalHoursPerWeek = hoursPerWeek || "flexible";

    // Resolve display name: prefer name, fall back to githubLogin, then email prefix
    const displayName =
      session.user.name ||
      (session.user as { githubLogin?: string | null }).githubLogin ||
      session.user.email?.split("@")[0] ||
      "Anonymous";

    const id =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    db.prepare(
      `INSERT INTO help_offers (id, idea_id, user_id, name, skills, message, hours_per_week, want_notifications)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      ideaId,
      session.user.id,
      displayName,
      JSON.stringify(skills || []),
      finalDescription,
      finalHoursPerWeek,
      wantNotifications ? 1 : 0
    );

    // Trigger AI event for help offered
    import("@/lib/ai-trigger").then(({ handleProjectEvent }) => {
      handleProjectEvent(ideaId, "help_offered").catch(console.error);
    });

    return NextResponse.json({ success: true, joined: true }, { status: 201 });
  } catch (e) {
    console.error("POST /api/help-offer error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ joined: false });
  }

  const { searchParams } = new URL(request.url);
  const ideaId = searchParams.get("ideaId");

  if (!ideaId) {
    return NextResponse.json(
      { error: "ideaId is required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db.prepare(
    "SELECT id FROM help_offers WHERE idea_id = ? AND user_id = ?"
  ).get(ideaId, session.user.id);

  return NextResponse.json({ joined: !!existing });
}
