import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIABIdea, getGraduationStatus } from "@/lib/iranazadabad";
import {
  GITHUB_ORG,
  GITHUB_IDEAS_REPO,
  GITHUB_IDEAS_CATEGORY_ID,
  GITHUB_BOT_TOKEN,
} from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const userId = session.user.email || session.user.githubLogin || "unknown";
  const { success } = rateLimit(`graduate:${userId}`, 5, 24 * 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limited", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { sourceId, description, helpNeeded, isCodeProject } = body;

    if (!sourceId?.startsWith("iae-")) {
      return NextResponse.json(
        { error: "Invalid source ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const nativeId = parseInt(sourceId.replace("iae-", ""));
    const idea = await getIABIdea(nativeId);
    if (!idea) {
      return NextResponse.json(
        { error: "Idea not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const alreadyGraduated = await getGraduationStatus(nativeId);
    if (alreadyGraduated) {
      return NextResponse.json(
        { error: "Already graduated", code: "ALREADY_GRADUATED" },
        { status: 409 }
      );
    }

    // Build attribution body
    const date = new Date(idea.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const helpList = (helpNeeded || [])
      .map((h: string) => `- ${h}`)
      .join("\n");

    const discussionBody = `> 🤝 **Originally posted on [IranAzadAbad](https://github.com/IranAzadAbad/ideas)
> by [@${idea.author.login}](https://github.com/${idea.author.login}) on ${date}.**
> **[View original →](${idea.sourceUrl})**
>
> IranENovin community is taking this idea forward.

<!-- source:iranazadabad:${nativeId} -->

---

## Plan

${description || "To be defined by the team."}

## Help needed

${helpList || "- Open to all contributors"}

---

## Original idea

${idea.body}`;

    // Get repo ID
    const headers = {
      Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
      "Content-Type": "application/json",
    };

    const repoRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { id } }`,
        variables: { owner: GITHUB_ORG, repo: GITHUB_IDEAS_REPO },
      }),
    });
    const repoData = await repoRes.json();
    const repoId = repoData.data?.repository?.id;

    if (!repoId) {
      return NextResponse.json(
        { error: "Failed to get repo", code: "GITHUB_ERROR" },
        { status: 500 }
      );
    }

    // Create discussion
    const createRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
          createDiscussion(input: { repositoryId: $repoId, categoryId: $categoryId, title: $title, body: $body }) {
            discussion { number url }
          }
        }`,
        variables: {
          repoId,
          categoryId: GITHUB_IDEAS_CATEGORY_ID,
          title: idea.title,
          body: discussionBody,
        },
      }),
    });
    const createData = await createRes.json();
    const disc = createData.data?.createDiscussion?.discussion;

    if (!disc) {
      return NextResponse.json(
        { error: "Failed to create discussion", code: "GITHUB_ERROR" },
        { status: 500 }
      );
    }

    // Add stage label
    await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_IDEAS_REPO}/issues/${disc.number}/labels`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ labels: ["stage:team-forming"] }),
      }
    ).catch(() => {});

    // Create repo if code project
    let projectUrl: string | undefined;
    if (isCodeProject) {
      const slug = idea.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50);

      const repoCreateRes = await fetch(
        `https://api.github.com/orgs/${GITHUB_ORG}/repos`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: slug,
            description: `Project from IranENovin community | source:iranazadabad:${nativeId}`,
            auto_init: true,
          }),
        }
      );
      if (repoCreateRes.ok) {
        const repo = await repoCreateRes.json();
        projectUrl = repo.html_url;
      }
    }

    // Post comment on original IAB discussion
    const graduatingUser =
      session.user.githubLogin || session.user.name || "Someone";
    await fetch(
      `https://api.github.com/repos/IranAzadAbad/ideas/discussions/${nativeId}/comments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: `🚀 **Great news!** This idea has been picked up by the [IranENovin](https://iranenovin.com) community.\n\n**@${graduatingUser}** is taking it forward and building it here:\n👉 ${disc.url}\n\nThank you for sharing this idea — your contribution matters and it's now moving to the next stage.\n\n— The IranENovin community`,
        }),
      }
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      discussionUrl: disc.url,
      projectUrl,
    });
  } catch (e) {
    console.error("POST /api/ideas/graduate error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
