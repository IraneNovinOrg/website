import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { createTeam, getTeamByIdea } from "@/lib/teams";
import { getIABIdea } from "@/lib/iranazadabad";
import { graduateIABIdea } from "@/lib/graduation";
import { GITHUB_ORG, GITHUB_IDEAS_REPO, GITHUB_BOT_TOKEN } from "@/lib/constants";

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
    const {
      sourceIdeaId,
      sourceIdeaTitle,
      projectType,
      firstMilestone,
      roles,
      createRepo,
    } = body;

    if (!sourceIdeaId || !sourceIdeaTitle || !projectType || !roles?.length) {
      return NextResponse.json(
        { error: "Missing required fields", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Check if project already exists for this idea
    const existing = getTeamByIdea(sourceIdeaId);
    if (existing) {
      return NextResponse.json(
        { error: "A project already exists for this idea", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    const userId = session.user.id || session.user.email || "unknown";
    const userName = session.user.name || session.user.email || "Anonymous";

    // If IAB idea: run graduation (create IranENovin discussion + comment on IAB)
    if (sourceIdeaId.startsWith("iae-")) {
      const nativeId = parseInt(sourceIdeaId.replace("iae-", ""));
      const iabIdea = await getIABIdea(nativeId);

      if (iabIdea) {
        await graduateIABIdea({
          nativeId,
          title: iabIdea.title,
          body: iabIdea.body,
          authorLogin: iabIdea.author.login,
          sourceUrl: iabIdea.sourceUrl,
          createdAt: iabIdea.createdAt,
          description: firstMilestone?.title,
          helpNeeded: roles,
          graduatingUserName: session.user.githubLogin || userName,
        });
      }
    }

    // If native idea: add stage label
    if (sourceIdeaId.startsWith("ien-") && GITHUB_BOT_TOKEN) {
      const discNumber = parseInt(sourceIdeaId.replace("ien-", ""));
      await fetch(
        `https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_IDEAS_REPO}/issues/${discNumber}/labels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ labels: ["stage:active-project"] }),
        }
      ).catch(() => {});
    }

    // Create project/team
    const team = await createTeam({
      ideaId: sourceIdeaId,
      ideaTitle: sourceIdeaTitle,
      leadUserId: userId,
      leadName: userName,
      roles,
      createRepo: !!(createRepo && projectType === "software"),
    });

    if (!team) {
      return NextResponse.json(
        { error: "Failed to create project", code: "ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      slug: team.projectSlug || team.id,
      projectUrl: team.repoUrl,
    });
  } catch (e) {
    console.error("POST /api/projects/launch error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
