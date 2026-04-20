import type { UnifiedIdea, IABComment, IABCache } from "@/types";
import { GITHUB_BOT_TOKEN } from "./constants";

const IAB_CACHE_URL =
  "https://raw.githubusercontent.com/IraneNovinOrg/ideas/main/_data/iranazadabad-cache.json";

// ─── Fetch IAB ideas: try cache first, fall back to live GraphQL ─────────────

export async function getIABIdeas(): Promise<UnifiedIdea[]> {
  // Try cache first
  try {
    const res = await fetch(IAB_CACHE_URL, { next: { revalidate: 300 } });
    if (res.ok) {
      const cache: IABCache = await res.json();
      if (cache.ideas && cache.ideas.length > 0) {
        return cache.ideas;
      }
    }
  } catch {
    // cache failed, fall through to live fetch
  }

  // Cache empty or unavailable — fetch live from IranAzadAbad via GraphQL
  return fetchIABIdeasLive();
}

async function fetchIABIdeasLive(): Promise<UnifiedIdea[]> {
  if (!GITHUB_BOT_TOKEN) return [];

  const query = `
    query($cursor: String) {
      repository(owner: "IranAzadAbad", name: "ideas") {
        discussions(first: 100, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            number title body createdAt updatedAt url upvoteCount
            author { login avatarUrl }
            category { name emoji }
            labels(first: 10) { nodes { name color } }
            comments { totalCount }
          }
        }
      }
    }
  `;

  try {
    const all: UnifiedIdea[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const res: Response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables: { cursor } }),
      });

      if (!res.ok) break;
      const json = await res.json();
      if (json.errors) break;

      const { nodes, pageInfo } = json.data.repository.discussions;
      for (const node of nodes) {
        all.push(transformDiscussionNode(node));
      }

      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      // Limit to 300 ideas max for performance
      if (all.length >= 300) break;
    }

    return all;
  } catch (e) {
    console.error("fetchIABIdeasLive failed:", e);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformDiscussionNode(node: any): UnifiedIdea {
  // Use `upvoteCount` (the dedicated discussion upvote) — NOT emoji
  // reactions — to match what the sync stores in `github_vote_count`.
  const votes = node.upvoteCount ?? 0;
  return {
    id: `iae-${node.number}`,
    nativeId: node.number,
    title: node.title,
    body: node.body,
    bodyPreview: stripMarkdown(node.body).slice(0, 200),
    category: node.category?.name ?? "General",
    categoryEmoji: node.category?.emoji ?? "",
    source: "iranazadabad",
    sourceUrl: node.url,
    author: {
      login: node.author?.login ?? "ghost",
      avatarUrl: node.author?.avatarUrl ?? "",
      profileUrl: `https://github.com/${node.author?.login ?? "ghost"}`,
    },
    voteCount: votes,
    commentCount: node.comments?.totalCount ?? 0,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    labels: node.labels?.nodes ?? [],
    stage: inferStage(votes),
    helpOffersCount: 0,
    graduatedTo: null,
  };
}

export async function getIABIdea(
  nativeId: number
): Promise<UnifiedIdea | null> {
  // Use live fetch for individual ideas — always fresh
  const result = await getLiveIABIdea(nativeId);
  return result?.idea ?? null;
}

export async function getGraduationStatus(
  nativeId: number
): Promise<string | null> {
  try {
    const headers = {
      Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
      Accept: "application/vnd.github+json",
    };
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:IraneNovinOrg/ideas+source:iranazadabad:${nativeId}+in:body+type:discussion`,
      { headers, next: { revalidate: 600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].html_url;
    }
    return null;
  } catch {
    return null;
  }
}

export async function buildGraduationMap(): Promise<Record<number, string>> {
  try {
    const headers = {
      Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
      Accept: "application/vnd.github+json",
    };
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:IraneNovinOrg/ideas+"source:iranazadabad:"+in:body+type:discussion&per_page=100`,
      { headers, next: { revalidate: 600 } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<number, string> = {};
    for (const item of data.items || []) {
      const match = item.body?.match(
        /<!-- source:iranazadabad:(\d+) -->/
      );
      if (match) {
        map[parseInt(match[1])] = item.html_url;
      }
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Live fetch for individual idea detail pages ──────────────────────────────

export async function getLiveIABIdea(nativeId: number): Promise<{
  idea: UnifiedIdea;
  comments: IABComment[];
} | null> {
  if (!GITHUB_BOT_TOKEN) return null;

  // Use GraphQL to fetch the discussion so we get `upvoteCount` (the
  // dedicated discussion upvote), which is what the sync stores in
  // `github_vote_count`.  The REST API only exposes emoji reactions
  // (`reactions["+1"]`) which is a *different* metric and caused a vote
  // count mismatch between the list view and the detail view.
  const graphqlQuery = `
    query($number: Int!) {
      repository(owner: "IranAzadAbad", name: "ideas") {
        discussion(number: $number) {
          number title body createdAt updatedAt url upvoteCount
          author { login avatarUrl }
          category { name emoji }
          labels(first: 10) { nodes { name color } }
          comments(first: 100) {
            totalCount
            nodes {
              id body createdAt
              author { login avatarUrl }
              replies(first: 50) { totalCount }
            }
          }
        }
      }
    }
  `;

  try {
    const graphqlRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { number: nativeId },
      }),
      next: { revalidate: 60 },
    } as RequestInit);

    if (!graphqlRes.ok) return null;
    const json = await graphqlRes.json();
    if (json.errors || !json.data?.repository?.discussion) return null;

    const node = json.data.repository.discussion;
    const votes = node.upvoteCount ?? 0;

    // Count total comments including nested replies
    const topLevelCommentCount = node.comments?.totalCount ?? 0;
    const repliesCount = (node.comments?.nodes || []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, c: any) => sum + (c.replies?.totalCount ?? 0),
      0
    );
    const totalCommentCount = topLevelCommentCount + repliesCount;

    const idea: UnifiedIdea = {
      id: `iae-${nativeId}`,
      nativeId,
      title: node.title,
      body: node.body,
      bodyPreview: stripMarkdown(node.body).slice(0, 200),
      category: node.category?.name ?? "General",
      categoryEmoji: node.category?.emoji ?? "",
      source: "iranazadabad",
      sourceUrl: node.url,
      author: {
        login: node.author?.login ?? "ghost",
        avatarUrl: node.author?.avatarUrl ?? "",
        profileUrl: `https://github.com/${node.author?.login ?? "ghost"}`,
      },
      voteCount: votes,
      commentCount: totalCommentCount,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      labels: node.labels?.nodes ?? [],
      stage: inferStage(votes),
      helpOffersCount: 0,
      graduatedTo: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments: IABComment[] = (node.comments?.nodes || []).map((c: any) => ({
      id: c.id,
      body: c.body,
      author: {
        login: c.author?.login ?? "ghost",
        avatarUrl: c.author?.avatarUrl ?? "",
        profileUrl: `https://github.com/${c.author?.login ?? "ghost"}`,
      },
      createdAt: c.createdAt,
    }));

    return { idea, comments };
  } catch (e) {
    console.error("getLiveIABIdea failed:", e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function transformComment(c: any): IABComment {
  return {
    id: c.id,
    body: c.body,
    author: {
      login: c.user?.login ?? "ghost",
      avatarUrl: c.user?.avatar_url ?? "",
      profileUrl: `https://github.com/${c.user?.login ?? "ghost"}`,
    },
    createdAt: c.created_at,
  };
}

function stripMarkdown(text = ""): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/>\s/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function inferStage(votes: number): UnifiedIdea["stage"] {
  if (votes >= 20) return "validated";
  if (votes >= 5) return "gaining";
  return "submitted";
}
