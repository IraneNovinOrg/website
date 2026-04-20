import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyToTeam } from "@/lib/teams";

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

  try {
    const body = await request.json();
    const { role, message, skills } = body;

    if (!role) {
      return NextResponse.json(
        { error: "Role is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const success = await applyToTeam(
      params.teamId,
      session.user.id || session.user.email || "unknown",
      session.user.name || "Anonymous",
      role,
      message || "",
      skills || []
    );

    if (!success) {
      return NextResponse.json(
        { error: "Already applied or team not found", code: "ERROR" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/teams/[teamId]/apply error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
