/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createIdea } from "@/lib/github";
import { getDb, getUserVotedIdeas } from "@/lib/db/index";
import { GITHUB_BOT_TOKEN } from "@/lib/constants";
import { getAllTasksGrouped } from "@/lib/ai-tasks";
import { limitOrRespond } from "@/lib/rate-limit";

// ─── GET: Read from SQLite (instant) ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get("source") ?? "all";
  const category = searchParams.get("category") ?? null;
  const stage = searchParams.get("stage") ?? null;
  const sort = searchParams.get("sort") ?? "top";
  const search = searchParams.get("search") ?? null;
  const projectFilter = searchParams.get("projectFilter") ?? null;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const db = getDb();

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (source && source !== "all") {
    where += " AND source = ?";
    params.push(source === "iranazadabad" ? "iranazadabad" : "iranenovin");
  }

  if (category && category !== "all") {
    where += " AND LOWER(category) = LOWER(?)";
    params.push(category);
  }

  if (stage && stage !== "all") {
    where += " AND stage = ?";
    params.push(stage);
  }

  if (search) {
    where +=
      " AND (LOWER(title) LIKE ? OR LOWER(body_preview) LIKE ? OR LOWER(body) LIKE ? OR LOWER(category) LIKE ?)";
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q, q);
  }

  if (projectFilter === "active") {
    where += " AND project_status IN ('active', 'needs-contributors')";
  }

  // Batch lookups — avoid N+1 queries
  const voteRows = db.prepare("SELECT idea_id, COUNT(*) as c FROM votes GROUP BY idea_id").all() as any[];
  const voteMap = new Map(voteRows.map((v: any) => [v.idea_id, v.c as number]));

  const helpRows = db.prepare("SELECT idea_id, COUNT(*) as c FROM help_offers GROUP BY idea_id").all() as any[];
  const helpMap = new Map(helpRows.map((h: any) => [h.idea_id, h.c as number]));

  const feasRows = db.prepare("SELECT idea_id, feasibility FROM ai_analyses").all() as any[];
  const feasMap = new Map(feasRows.map((a: any) => [a.idea_id, a.feasibility]));

  // Count ALL comments (including replies) from idea_comments table
  const allCommentCounts = db.prepare(
    "SELECT idea_id, COUNT(*) as c FROM idea_comments GROUP BY idea_id"
  ).all() as any[];
  const allCommentMap = new Map(allCommentCounts.map((r: any) => [r.idea_id, r.c as number]));

  // Recent comments (last 14 days) — measures active discussion
  const recentCommentCounts = db.prepare(
    "SELECT idea_id, COUNT(*) as c FROM idea_comments WHERE created_at > datetime('now', '-14 days') GROUP BY idea_id"
  ).all() as any[];
  const recentCommentMap = new Map(recentCommentCounts.map((r: any) => [r.idea_id, r.c as number]));

  // Recent votes (last 14 days) — measures momentum
  const recentVoteRows = db.prepare(
    "SELECT idea_id, COUNT(*) as c FROM votes WHERE created_at > datetime('now', '-14 days') GROUP BY idea_id"
  ).all() as any[];
  const recentVoteMap = new Map(recentVoteRows.map((v: any) => [v.idea_id, v.c as number]));

  // Task completions (accepted tasks) — measures active progress
  const taskCompletionRows = db.prepare(
    "SELECT idea_id, COUNT(*) as c FROM tasks WHERE status = 'accepted' GROUP BY idea_id"
  ).all() as any[];
  const taskCompletionMap = new Map(taskCompletionRows.map((t: any) => [t.idea_id, t.c as number]));

  // ─── Compute trending score ─────────────────────────────────────────────
  // Trending = a blend of engagement signals weighted by recency.
  // For non-trending sorts we only need this to tag the top few IDs with
  // `isTrending`, so we can work off the top N by vote count (a cheap
  // indexed sort) instead of scanning every matching idea.
  const MAX_TRENDING = 5;

  const trendingCandidateLimit = sort === "trending" ? 0 /* all */ : 200;
  const allIdeaRows = db.prepare(
    trendingCandidateLimit
      ? `SELECT id, github_vote_count, updated_at FROM ideas ${where} ORDER BY github_vote_count DESC, updated_at DESC LIMIT ?`
      : `SELECT id, github_vote_count, updated_at FROM ideas ${where}`
  ).all(
    ...(trendingCandidateLimit ? [...params, trendingCandidateLimit] : params)
  ) as any[];

  const trendingScoreMap = new Map<string, number>();
  const now = Date.now();

  for (const row of allIdeaRows) {
    const id = row.id as string;
    const githubVotes = row.github_vote_count || 0;
    const localVotes = voteMap.get(id) || 0;
    const totalVotes = githubVotes + localVotes;
    const comments = allCommentMap.get(id) || 0;
    const recentComments = recentCommentMap.get(id) || 0;
    const recentVotes = recentVoteMap.get(id) || 0;
    const helpOffers = helpMap.get(id) || 0;
    const completedTasks = taskCompletionMap.get(id) || 0;

    // Recency decay: ideas with recent updates score higher.
    // Half-life of ~14 days — activity older than a month contributes little.
    const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const daysSinceUpdate = Math.max(0, (now - updatedMs) / 86400000);
    const recencyMultiplier = Math.exp(-0.05 * daysSinceUpdate); // e^(-0.05*d), ~0.5 at 14 days

    // Weighted score:
    //   - Total votes: baseline popularity (weight 1)
    //   - Recent votes: momentum signal (weight 3)
    //   - Recent comments: active discussion (weight 2)
    //   - Help offers: community interest (weight 2)
    //   - Completed tasks: real progress (weight 3)
    //   - Total comments: general engagement (weight 0.5)
    const rawScore =
      totalVotes * 1.0 +
      recentVotes * 3.0 +
      recentComments * 2.0 +
      helpOffers * 2.0 +
      completedTasks * 3.0 +
      comments * 0.5;

    // Apply recency decay so stale high-vote ideas don't dominate
    const trendingScore = rawScore * recencyMultiplier;
    trendingScoreMap.set(id, trendingScore);
  }

  // Pick the top N trending IDs (must have a minimum score to qualify)
  const MIN_TRENDING_SCORE = 5; // Filter out near-zero-activity ideas
  const sortedByTrending = [...trendingScoreMap.entries()]
    .filter(([, score]) => score >= MIN_TRENDING_SCORE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TRENDING);
  const trendingIdSet = new Set(sortedByTrending.map(([id]) => id));

  // Simple sort — no correlated subqueries
  let orderBy: string;
  switch (sort) {
    case "new":
      orderBy = "ORDER BY created_at DESC";
      break;
    case "comments":
      orderBy = "ORDER BY comment_count DESC";
      break;
    case "trending":
      // Trending sort handled in JS after query (need the computed score)
      orderBy = "ORDER BY github_vote_count DESC, created_at DESC";
      break;
    default:
      orderBy = "ORDER BY github_vote_count DESC";
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM ideas ${where}`).get(...params) as any).c;

  const taskMap = getAllTasksGrouped();

  // Per-viewer `hasVoted` decoration: one query, O(n) Set lookups. Cheaper
  // than a per-card /api/has-voted round-trip.
  const session = await auth();
  const viewerId = (session?.user as any)?.id || session?.user?.email || null;
  const votedSet = viewerId ? getUserVotedIdeas(viewerId) : new Set<string>();

  if (sort === "trending") {
    // ─── Trending sort: fetch all matching ideas, sort by trending score in JS,
    // then paginate. Trending items (top 5) always appear first.
    const allRows = db.prepare(`
      SELECT id, native_id, title, body_preview, category, category_emoji,
        source, source_url, author_login, author_avatar, author_name, author_profile_url,
        github_vote_count, comment_count, created_at, updated_at, stage,
        graduated_to, project_status
      FROM ideas ${where}
    `).all(...params) as any[];

    // Sort by trending score descending
    allRows.sort((a: any, b: any) => {
      const scoreA = trendingScoreMap.get(a.id) || 0;
      const scoreB = trendingScoreMap.get(b.id) || 0;
      return scoreB - scoreA;
    });

    const offset = (page - 1) * limit;
    const pagedRows = allRows.slice(offset, offset + limit);

    const ideas = pagedRows.map((r: any) => {
      const ideaTasks = taskMap.get(r.id) || [];
      const localVotes = voteMap.get(r.id) || 0;
      return {
        id: r.id,
        nativeId: r.native_id,
        title: r.title,
        bodyPreview: r.body_preview || "",
        category: r.category || "General",
        categoryEmoji: r.category_emoji || "",
        source: r.source,
        sourceUrl: r.source_url,
        author: {
          login: r.author_login || "ghost",
          avatarUrl: r.author_avatar || "",
          name: r.author_name,
          profileUrl: r.author_profile_url,
        },
        voteCount: (r.github_vote_count || 0) + localVotes,
        hasVoted: votedSet.has(r.id),
        commentCount: allCommentMap.get(r.id) || r.comment_count || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        labels: [],
        stage: r.stage || "submitted",
        helpOffersCount: helpMap.get(r.id) || 0,
        graduatedTo: r.graduated_to,
        projectStatus: r.project_status || "idea",
        isTrending: trendingIdSet.has(r.id),
        trendingScore: trendingScoreMap.get(r.id) || 0,
        taskCounts: {
          total: ideaTasks.length,
          open: ideaTasks.filter((t: any) => t.status === "open").length,
          completed: ideaTasks.filter((t: any) => t.status === "accepted").length,
        },
        feasibility: feasMap.get(r.id) || null,
      };
    });

    return NextResponse.json(
      { ideas, total, page, totalPages: Math.ceil(total / limit), hasMore: page < Math.ceil(total / limit) },
      // `private` because the response contains the viewer's `hasVoted`
      // decoration — a shared CDN cache would leak one user's flags to
      // everyone. SWR client-side cache still gives sub-second feel.
      { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" } }
    );
  }

  // ─── Non-trending sorts: standard SQL pagination ───────────────────────────
  const offset = (page - 1) * limit;

  // Select only needed columns — exclude full body (large) for list view
  const rows = db.prepare(`
    SELECT id, native_id, title, body_preview, category, category_emoji,
      source, source_url, author_login, author_avatar, author_name, author_profile_url,
      github_vote_count, comment_count, created_at, updated_at, stage,
      graduated_to, project_status
    FROM ideas ${where} ${orderBy} LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  const ideas = rows.map((r: any) => {
    const ideaTasks = taskMap.get(r.id) || [];
    const localVotes = voteMap.get(r.id) || 0;
    return {
      id: r.id,
      nativeId: r.native_id,
      title: r.title,
      bodyPreview: r.body_preview || "",
      category: r.category || "General",
      categoryEmoji: r.category_emoji || "",
      source: r.source,
      sourceUrl: r.source_url,
      author: {
        login: r.author_login || "ghost",
        avatarUrl: r.author_avatar || "",
        name: r.author_name,
        profileUrl: r.author_profile_url,
      },
      voteCount: (r.github_vote_count || 0) + localVotes,
      commentCount: allCommentMap.get(r.id) || r.comment_count || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      labels: [],
      stage: r.stage || "submitted",
      helpOffersCount: helpMap.get(r.id) || 0,
      graduatedTo: r.graduated_to,
      projectStatus: r.project_status || "idea",
      isTrending: trendingIdSet.has(r.id),
      trendingScore: trendingScoreMap.get(r.id) || 0,
      taskCounts: {
        total: ideaTasks.length,
        open: ideaTasks.filter((t: any) => t.status === "open").length,
        completed: ideaTasks.filter((t: any) => t.status === "accepted").length,
      },
      feasibility: feasMap.get(r.id) || null,
    };
  });

  // For non-trending sorts on page 1, float trending items to the top
  if (page === 1 && sort !== "new") {
    const trending = ideas.filter((i: any) => i.isTrending);
    const rest = ideas.filter((i: any) => !i.isTrending);
    const reordered = [...trending, ...rest];
    return NextResponse.json(
      { ideas: reordered, total, page, totalPages: Math.ceil(total / limit), hasMore: page < Math.ceil(total / limit) },
      // `private` because the response contains the viewer's `hasVoted`
      // decoration — a shared CDN cache would leak one user's flags to
      // everyone. SWR client-side cache still gives sub-second feel.
      { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" } }
    );
  }

  return NextResponse.json(
    { ideas, total, page, totalPages: Math.ceil(total / limit), hasMore: page < Math.ceil(total / limit) },
    { headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=10" } }
  );
}

// ─── POST: Create idea (still writes to GitHub) ─────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 10,
    windowMs: 60 * 60 * 1000,
    bucket: "ideas",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { title, body: ideaBody, categoryId, tags, type, language } = body;

    if (!title || !ideaBody || !categoryId) {
      return NextResponse.json({ error: "Missing required fields", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const userName = session.user.name || session.user.email || "Anonymous";
    const userGithub = session.user.githubLogin;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";

    let attribution = `> **Submitted by ${userName}`;
    if (userGithub) attribution += ` ([@${userGithub}](https://github.com/${userGithub}))`;
    attribution += ` via [IranENovin](${appUrl})**`;

    let fullBody = `${attribution}\n\n---\n\n${ideaBody}`;
    if (tags) fullBody += `\n\n---\n**Tags:** ${tags}`;
    if (language && language !== "en") fullBody += `\n**Language:** ${language}`;
    if (type === "project-ready") fullBody += `\n\n🚀 *This idea is marked as ready to become a project.*`;

    // Create on GitHub
    const idea = await createIdea(title, fullBody, categoryId, undefined);
    if (!idea) {
      return NextResponse.json({ error: "Failed to create idea", code: "GITHUB_ERROR" }, { status: 500 });
    }

    // Also insert into local SQLite immediately
    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO ideas (id, native_id, title, body, body_preview, category,
        source, source_url, author_login, author_avatar, github_vote_count,
        comment_count, stage, created_at, updated_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, 'iranenovin', ?, ?, ?, 0, 0, 'submitted', datetime('now'), datetime('now'), datetime('now'))
    `).run(
      `ien-${idea.id}`, idea.id, title, fullBody,
      ideaBody.slice(0, 200).replace(/\n+/g, " "),
      idea.category, idea.url,
      idea.author.login, idea.author.avatarUrl
    );

    // Cross-post to IranAzadAbad (non-blocking)
    crossPostToIAB(title, ideaBody, userName, idea.id, appUrl).catch((e) =>
      console.error("Cross-post failed:", e)
    );

    // Channel post: new idea (fire-and-forget)
    import("@/lib/telegram/channel").then(({ postNewIdea }) => {
      postNewIdea({
        id: `ien-${idea.id}`,
        title: title,
        category: idea.category || 'General',
        authorName: userName,
        bodyPreview: ideaBody?.slice(0, 200) || '',
      }).catch(console.error);
    }).catch(() => {});

    return NextResponse.json({ idea: { ...idea, id: `ien-${idea.id}` } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/ideas error:", e);
    return NextResponse.json({ error: "Server error", code: "SERVER_ERROR" }, { status: 500 });
  }
}

async function crossPostToIAB(title: string, body: string, authorName: string, discNum: number, appUrl: string) {
  if (!GITHUB_BOT_TOKEN) return;
  const h = { Authorization: `Bearer ${GITHUB_BOT_TOKEN}`, "Content-Type": "application/json" };

  const repoRes = await fetch("https://api.github.com/graphql", {
    method: "POST", headers: h,
    body: JSON.stringify({
      query: `query { repository(owner:"IranAzadAbad",name:"ideas") { id discussionCategories(first:5){nodes{id name}} } }`,
    }),
  });
  const repoData = await repoRes.json();
  const repoId = repoData.data?.repository?.id;
  const cats = repoData.data?.repository?.discussionCategories?.nodes || [];
  if (!repoId || !cats.length) return;
  const catId = cats.find((c: any) => c.name.toLowerCase() === "ideas")?.id || cats[0].id;

  const crossBody = `> 🔗 **Cross-posted from [IranENovin](${appUrl}) by ${authorName}**\n> [View full discussion →](${appUrl}/en/ideas/ien-${discNum})\n\n---\n\n${body}`;

  await fetch("https://api.github.com/graphql", {
    method: "POST", headers: h,
    body: JSON.stringify({
      query: `mutation($r:ID!,$c:ID!,$t:String!,$b:String!){createDiscussion(input:{repositoryId:$r,categoryId:$c,title:$t,body:$b}){discussion{number}}}`,
      variables: { r: repoId, c: catId, t: title, b: crossBody },
    }),
  });
}
