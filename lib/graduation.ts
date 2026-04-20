import {
  GITHUB_ORG,
  GITHUB_IDEAS_REPO,
  GITHUB_IDEAS_CATEGORY_ID,
  GITHUB_BOT_TOKEN,
} from "./constants";

export async function graduateIABIdea(params: {
  nativeId: number;
  title: string;
  body: string;
  authorLogin: string;
  sourceUrl: string;
  createdAt: string;
  description?: string;
  helpNeeded?: string[];
  graduatingUserName: string;
}): Promise<{ discussionUrl: string; discussionNumber: number } | null> {
  if (!GITHUB_BOT_TOKEN) return null;

  const headers = {
    Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };

  const date = new Date(params.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const helpList = (params.helpNeeded || []).map((h) => `- ${h}`).join("\n");

  const discussionBody = `> 🤝 **Originally posted on [IranAzadAbad](https://github.com/IranAzadAbad/ideas)
> by [@${params.authorLogin}](https://github.com/${params.authorLogin}) on ${date}.**
> **[View original →](${params.sourceUrl})**
>
> IranENovin community is taking this idea forward.

<!-- source:iranazadabad:${params.nativeId} -->

---

## Plan

${params.description || "To be defined by the team."}

## Help needed

${helpList || "- Open to all contributors"}

---

## Original idea

${params.body}`;

  try {
    // Get repo ID
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
    if (!repoId) return null;

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
          title: params.title,
          body: discussionBody,
        },
      }),
    });
    const createData = await createRes.json();
    const disc = createData.data?.createDiscussion?.discussion;
    if (!disc) return null;

    // Add stage label
    await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_IDEAS_REPO}/issues/${disc.number}/labels`,
      { method: "POST", headers, body: JSON.stringify({ labels: ["stage:active-project"] }) }
    ).catch(() => {});

    // Post comment on original IAB discussion
    await fetch(
      `https://api.github.com/repos/IranAzadAbad/ideas/discussions/${params.nativeId}/comments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: `🚀 **Great news!** This idea has been picked up by the [IranENovin](https://iranenovin.com) community.\n\n**@${params.graduatingUserName}** is taking it forward:\n👉 ${disc.url}\n\n— The IranENovin community`,
        }),
      }
    ).catch(() => {});

    return { discussionUrl: disc.url, discussionNumber: disc.number };
  } catch (e) {
    console.error("graduateIABIdea failed:", e);
    return null;
  }
}
