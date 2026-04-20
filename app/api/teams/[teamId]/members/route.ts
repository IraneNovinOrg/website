import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTeamById, acceptApplicant, rejectApplicant } from "@/lib/teams";

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const team = getTeamById(params.teamId);
  if (!team) {
    return NextResponse.json(
      { error: "Team not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const userId = session.user.id || session.user.email || "";
  if (team.leadUserId !== userId) {
    return NextResponse.json(
      { error: "Only the team lead can manage members", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { applicantUserId } = body;

    const success = await acceptApplicant(params.teamId, applicantUserId);
    return NextResponse.json({ success });
  } catch (e) {
    console.error("POST /api/teams/[teamId]/members error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const team = getTeamById(params.teamId);
  if (!team) {
    return NextResponse.json(
      { error: "Team not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  const userId = session.user.id || session.user.email || "";
  if (team.leadUserId !== userId) {
    return NextResponse.json(
      { error: "Only the team lead can manage members", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { applicantUserId } = body;

    const success = await rejectApplicant(params.teamId, applicantUserId);
    return NextResponse.json({ success });
  } catch (e) {
    console.error("DELETE /api/teams/[teamId]/members error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
