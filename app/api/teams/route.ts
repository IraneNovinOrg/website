import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { createTeam, getAllTeams, getTeamsForUser, getTeamByIdea } from "@/lib/teams";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ideaId = searchParams.get("ideaId");
  const userId = searchParams.get("userId");

  if (ideaId) {
    const team = getTeamByIdea(ideaId);
    return NextResponse.json({ team });
  }

  if (userId) {
    const teams = getTeamsForUser(userId);
    return NextResponse.json({ teams });
  }

  const teams = getAllTeams();
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { ideaId, ideaTitle, roles, createRepo } = body;

    if (!ideaId || !ideaTitle || !roles?.length) {
      return NextResponse.json(
        { error: "Missing required fields", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const team = await createTeam({
      ideaId,
      ideaTitle,
      leadUserId: session.user.id || session.user.email || "unknown",
      leadName: session.user.name || session.user.email || "Anonymous",
      roles,
      createRepo: !!createRepo,
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team already exists for this idea", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    return NextResponse.json({ team }, { status: 201 });
  } catch (e) {
    console.error("POST /api/teams error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
