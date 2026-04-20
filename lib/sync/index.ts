/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb } from "../db/index";
import { GITHUB_BOT_TOKEN, GITHUB_ORG, GITHUB_IDEAS_REPO } from "../constants";
import { resolveEmoji } from "../emoji-map";

const GRAPHQL = "https://api.github.com/graphql";
const REST = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
  };
}

// Yield to Node's event loop so synchronous better-sqlite3 writes don't
// starve the HTTP handler. Use setImmediate (not Promise.resolve) so we
// actually drain pending I/O callbacks (incoming requests) before continuing.
function yieldToEventLoop(): Promise<void> {
  return new Promise((r) => setImmediate(r));
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

function inferStage(votes: number): string {
  if (votes >= 20) return "validated";
  if (votes >= 5) return "gaining";
  return "submitted";
}

const DISCUSSIONS_QUERY = `query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    discussions(first: 50, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title body createdAt updatedAt url upvoteCount
        author { login avatarUrl }
        category { name emoji }
        comments(first: 100) {
          totalCount
          nodes {
            id body createdAt
            author { login avatarUrl }
            upvoteCount
            reactions(content: THUMBS_UP) { totalCount }
            replies(first: 50) {
              totalCount
              nodes {
                id body createdAt
                author { login avatarUrl }
                upvoteCount
                reactions(content: THUMBS_UP) { totalCount }
              }
            }
          }
        }
        reactions(content: THUMBS_UP) { totalCount }
      }
    }
  }
}`;

// ─── Sync discussions from a repo ───────────────────────────────────────────

async function syncDiscussions(owner: string, repo: string, sourceTag: string) {
  if (!GITHUB_BOT_TOKEN) return 0;
  const db = getDb();

  // Every 10th sync, do a full refresh (not incremental) to keep vote counts accurate
  const syncCount = db.prepare(
    "SELECT COUNT(*) as c FROM activity_log WHERE event_type = 'sync_complete'"
  ).get() as any;
  const isFullSync = (syncCount?.c || 0) % 10 === 0;

  const lastSync = db.prepare(
    "SELECT MAX(synced_at) as last FROM ideas WHERE source = ?"
  ).get(sourceTag) as any;
  const since = isFullSync ? "2020-01-01T00:00:00Z" : (lastSync?.last || "2020-01-01T00:00:00Z");
  if (isFullSync) console.log(`[Sync] Full refresh cycle for ${sourceTag} (every 10th sync)`);

  // Prepared statements hoisted once per sync call. Re-creating them inside
  // the per-node loop (as the old code did) re-parses SQL thousands of times
  // per cycle and was a measurable hot spot.
  const upsertIdea = db.prepare(`
    INSERT INTO ideas (id, native_id, title, body, body_preview, category,
      category_emoji, source, source_url, author_login, author_avatar,
      author_profile_url, github_vote_count, comment_count, replies_count, stage,
      created_at, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, body=excluded.body, body_preview=excluded.body_preview,
      github_vote_count=excluded.github_vote_count, comment_count=excluded.comment_count,
      replies_count=excluded.replies_count,
      stage=excluded.stage, updated_at=excluded.updated_at, synced_at=datetime('now')
  `);

  const upsertComment = db.prepare(`
    INSERT INTO idea_comments (id, idea_id, body, author_login, author_avatar, created_at, source, github_vote_count, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, 'github', ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET body=excluded.body, github_vote_count=excluded.github_vote_count, synced_at=datetime('now')
  `);

  const upsertReply = db.prepare(`
    INSERT INTO idea_comments (id, idea_id, body, author_login, author_avatar, created_at, source, github_vote_count, reply_to, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, 'github', ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET body=excluded.body, github_vote_count=excluded.github_vote_count, reply_to=excluded.reply_to, synced_at=datetime('now')
  `);

  // One-shot bulk query for local vote counts per idea — avoids N+1 SELECTs
  // inside the upsert loop.
  const localVoteRows = db.prepare(
    "SELECT idea_id, COUNT(*) as c FROM votes GROUP BY idea_id"
  ).all() as Array<{ idea_id: string; c: number }>;
  const localVotes = new Map<string, number>();
  for (const r of localVoteRows) localVotes.set(r.idea_id, r.c);

  let cursor: string | null = null;
  let hasNextPage = true;
  let count = 0;
  const prefix = sourceTag === "iranazadabad" ? "iae" : "ien";

  while (hasNextPage) {
    const res: Response = await fetch(GRAPHQL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        query: DISCUSSIONS_QUERY,
        variables: { owner, repo, cursor },
      }),
    });

    if (!res.ok) break;
    const json = await res.json();
    if (json.errors) break;

    const { nodes, pageInfo } = json.data.repository.discussions;

    // Chunk writes into small transactions (5 discussions per tx) so we can
    // yield to the event loop between them. A single 50-discussion
    // transaction used to freeze the server for multiple seconds.
    const CHUNK = 5;
    for (let i = 0; i < nodes.length; i += CHUNK) {
      const chunk = nodes.slice(i, i + CHUNK);
      db.transaction(() => {
        for (const node of chunk) {
          const votes = node.upvoteCount ?? 0;
          const ideaId = `${prefix}-${node.number}`;

          const topLevelCommentCount = node.comments?.totalCount ?? 0;
          const repliesCount = (node.comments?.nodes || []).reduce(
            (sum: number, c: any) => sum + (c.replies?.totalCount ?? 0),
            0
          );
          const totalCommentCount = topLevelCommentCount + repliesCount;

          upsertIdea.run(
            ideaId, node.number, node.title, node.body,
            stripMarkdown(node.body).slice(0, 200),
            node.category?.name ?? "General",
            resolveEmoji(node.category?.emoji ?? ""),
            sourceTag, node.url,
            node.author?.login ?? "ghost",
            node.author?.avatarUrl ?? "",
            `https://github.com/${node.author?.login ?? "ghost"}`,
            votes, totalCommentCount, repliesCount,
            inferStage(votes + (localVotes.get(ideaId) || 0)),
            node.createdAt, node.updatedAt
          );

          for (const c of node.comments?.nodes || []) {
            const commentId = `${prefix}-c-${c.id || node.number + "-" + Math.random().toString(36).slice(2, 6)}`;
            const commentVotes = c.upvoteCount ?? 0;
            upsertComment.run(
              commentId, ideaId, c.body,
              c.author?.login ?? "ghost",
              c.author?.avatarUrl ?? "",
              c.createdAt,
              commentVotes
            );

            for (const r of c.replies?.nodes || []) {
              const replyVotes = r.upvoteCount ?? 0;
              // Single upsert with reply_to set — was 2 statements (INSERT + UPDATE) before.
              upsertReply.run(
                `${prefix}-c-${r.id}`,
                ideaId, r.body,
                r.author?.login ?? "ghost",
                r.author?.avatarUrl ?? "",
                r.createdAt,
                replyVotes,
                commentId
              );
            }
          }

          count++;
        }
      })();

      // Drain the event loop so pending HTTP requests get a turn before we
      // start the next chunk. This is what keeps the site responsive during sync.
      await yieldToEventLoop();
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;

    const oldest = nodes[nodes.length - 1]?.updatedAt;
    if (oldest && new Date(oldest) < new Date(since)) break;

    await new Promise((r) => setTimeout(r, 1000));
  }

  return count;
}

// ─── Public sync functions ──────────────────────────────────────────────────

export async function syncIABIdeas(): Promise<number> {
  console.log("[Sync] IAB ideas...");
  const count = await syncDiscussions("IranAzadAbad", "ideas", "iranazadabad");
  console.log(`[Sync] IAB: ${count} ideas synced`);
  return count;
}

export async function syncNativeIdeas(): Promise<number> {
  console.log("[Sync] Native ideas...");
  const count = await syncDiscussions(GITHUB_ORG, GITHUB_IDEAS_REPO, "iranenovin");
  console.log(`[Sync] Native: ${count} ideas synced`);
  return count;
}

export async function syncProjectGitHub(slug: string) {
  if (!GITHUB_BOT_TOKEN) return;
  const db = getDb();
  const h = headers();

  try {
    const [repoRes, readmeRes, issuesRes, msRes, contribRes] = await Promise.all([
      fetch(`${REST}/repos/${GITHUB_ORG}/${slug}`, { headers: h }),
      fetch(`${REST}/repos/${GITHUB_ORG}/${slug}/readme`, {
        headers: { ...h, Accept: "application/vnd.github.raw" },
      }),
      fetch(`${REST}/repos/${GITHUB_ORG}/${slug}/issues?state=all&labels=task&per_page=100`, { headers: h }),
      fetch(`${REST}/repos/${GITHUB_ORG}/${slug}/milestones?state=all`, { headers: h }),
      fetch(`${REST}/repos/${GITHUB_ORG}/${slug}/contributors?per_page=30`, { headers: h }),
    ]);

    if (repoRes.ok) {
      const repo = await repoRes.json();
      db.prepare(`
        INSERT INTO project_github_cache (slug, repo_url, description, language,
          star_count, fork_count, topics, homepage, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(slug) DO UPDATE SET
          description=excluded.description, star_count=excluded.star_count,
          fork_count=excluded.fork_count, topics=excluded.topics,
          homepage=excluded.homepage, synced_at=datetime('now')
      `).run(slug, repo.html_url, repo.description, repo.language,
        repo.stargazers_count, repo.forks_count,
        JSON.stringify(repo.topics || []), repo.homepage);

      if (readmeRes.ok) {
        const readme = await readmeRes.text();
        db.prepare("UPDATE project_github_cache SET readme_content = ? WHERE slug = ?")
          .run(readme, slug);
      }
    }

    await yieldToEventLoop();

    if (issuesRes.ok) {
      const issues = await issuesRes.json();
      const ins = db.prepare(`
        INSERT INTO project_issues_cache (id, project_slug, title, body, state,
          labels, assignee_login, assignee_avatar, milestone_title, html_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        db.prepare("DELETE FROM project_issues_cache WHERE project_slug = ?").run(slug);
        for (const i of issues) {
          ins.run(i.number, slug, i.title, i.body, i.state,
            JSON.stringify(i.labels?.map((l: any) => l.name) || []),
            i.assignee?.login, i.assignee?.avatar_url,
            i.milestone?.title, i.html_url, i.created_at);
        }
      })();
    }

    await yieldToEventLoop();

    if (msRes.ok) {
      const milestones = await msRes.json();
      const ins = db.prepare(`
        INSERT INTO project_milestones_cache (id, project_slug, title, description,
          open_issues, closed_issues, html_url, due_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        db.prepare("DELETE FROM project_milestones_cache WHERE project_slug = ?").run(slug);
        for (const m of milestones) {
          ins.run(m.number, slug, m.title, m.description,
            m.open_issues, m.closed_issues, m.html_url, m.due_on);
        }
      })();
    }

    await yieldToEventLoop();

    if (contribRes.ok) {
      const contribs = await contribRes.json();
      const ins = db.prepare(`
        INSERT INTO project_contributors_cache (login, project_slug, avatar_url, html_url, contributions)
        VALUES (?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        db.prepare("DELETE FROM project_contributors_cache WHERE project_slug = ?").run(slug);
        for (const c of contribs) {
          ins.run(c.login, slug, c.avatar_url, c.html_url, c.contributions);
        }
      })();
    }

    console.log(`[Sync] Project ${slug} synced`);
  } catch (e) {
    console.error(`[Sync] Project ${slug} failed:`, e);
  }
}

export async function syncCategories() {
  if (!GITHUB_BOT_TOKEN) return;
  const db = getDb();

  for (const [owner, repo, tag] of [
    ["IranAzadAbad", "ideas", "iranazadabad"],
    [GITHUB_ORG, GITHUB_IDEAS_REPO, "iranenovin"],
  ] as const) {
    try {
      const res = await fetch(GRAPHQL, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          query: `query($o: String!, $r: String!) {
            repository(owner: $o, name: $r) {
              discussionCategories(first: 30) { nodes { id name emoji } }
            }
          }`,
          variables: { o: owner, r: repo },
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const cats = json.data?.repository?.discussionCategories?.nodes || [];
      const ins = db.prepare(
        "INSERT OR REPLACE INTO github_categories (id, name, emoji, repo) VALUES (?, ?, ?, ?)"
      );
      db.transaction(() => {
        for (const c of cats) {
          ins.run(c.id, c.name, c.emoji || "", tag);
        }
      })();
    } catch {
      // ignore
    }
  }
}

export async function runFullSync() {
  console.log("[Sync] Starting full sync...");
  await syncIABIdeas();
  await yieldToEventLoop();
  await syncNativeIdeas();
  await yieldToEventLoop();
  await syncCategories();
  await yieldToEventLoop();

  const db = getDb();
  const projects = db.prepare(
    "SELECT slug FROM projects WHERE github_repo_url IS NOT NULL"
  ).all() as any[];

  for (const p of projects) {
    await syncProjectGitHub(p.slug);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Log sync_complete so the periodic full-sync counter advances
  db.prepare(
    "INSERT INTO activity_log (id, event_type, details, created_at) VALUES (?, 'sync_complete', 'Full sync cycle completed', datetime('now'))"
  ).run(Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  console.log("[Sync] Full sync complete");
}
