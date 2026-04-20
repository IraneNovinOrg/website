/**
 * GitHub recruitment-invitation CTA.
 *
 * Posts a short "come build this on iranenovin.com" message as a comment on
 * the original GitHub discussion. Supports single-idea and bulk triggers,
 * de-duplicates via `ideas.github_invite_posted_at`, and uses an editable
 * template stored in `_config/github-invite.json`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { graphql as ghGraphql } from "@octokit/graphql";
import { GITHUB_BOT_TOKEN } from "./constants";
import { getDb } from "./db/index";
import { logError, logInfo } from "./logger";

const CONFIG_PATH = join(process.cwd(), "_config", "github-invite.json");

export const DEFAULT_TEMPLATE = {
  enabled: true,
  body: [
    "👋 **Exciting update — this idea is now a live project on IranENovin!**",
    "",
    "If you want to help turn this into reality, join the team, claim a task, or just follow along, head over to:",
    "",
    "🔗 **{{projectUrl}}**",
    "",
    "Thanks to everyone who upvoted and discussed this here — your signal is what brought it to life. See you on the other side. 🚀",
  ].join("\n"),
};

export interface InviteTemplate {
  enabled: boolean;
  body: string;
}

export function loadTemplate(): InviteTemplate {
  try {
    if (existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return {
        enabled: parsed.enabled !== false,
        body: typeof parsed.body === "string" && parsed.body.trim()
          ? parsed.body
          : DEFAULT_TEMPLATE.body,
      };
    }
  } catch (e) {
    logError(`[github-invite] loadTemplate failed: ${(e as Error).message}`, "github-invite");
  }
  return { ...DEFAULT_TEMPLATE };
}

export function saveTemplate(t: InviteTemplate): InviteTemplate {
  const next: InviteTemplate = {
    enabled: t.enabled !== false,
    body: typeof t.body === "string" && t.body.trim() ? t.body : DEFAULT_TEMPLATE.body,
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

// ─── Core: post a single invitation ─────────────────────────────────────────

interface IdeaRow {
  id: string;
  title: string;
  native_id: number;
  source: string;
  source_url: string | null;
  github_invite_posted_at: string | null;
  project_status: string | null;
  github_vote_count: number | null;
}

function parseSourceUrl(sourceUrl: string | null): { owner: string; repo: string; number: number } | null {
  if (!sourceUrl) return null;
  // Format: https://github.com/{owner}/{repo}/discussions/{n}
  const m = sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

function renderTemplate(tmpl: string, ctx: { projectUrl: string; title: string }): string {
  return tmpl
    .replace(/\{\{\s*projectUrl\s*\}\}/g, ctx.projectUrl)
    .replace(/\{\{\s*title\s*\}\}/g, ctx.title);
}

export interface PostInviteResult {
  ok: boolean;
  ideaId: string;
  skipped?: "already_posted" | "unsupported_source" | "missing_token" | "disabled";
  commentId?: string;
  commentUrl?: string;
  error?: string;
}

async function postInviteForRow(row: IdeaRow, template: InviteTemplate, appUrl: string, opts: { force?: boolean } = {}): Promise<PostInviteResult> {
  if (!template.enabled) return { ok: false, ideaId: row.id, skipped: "disabled" };
  if (!GITHUB_BOT_TOKEN) return { ok: false, ideaId: row.id, skipped: "missing_token" };
  if (!opts.force && row.github_invite_posted_at) {
    return { ok: false, ideaId: row.id, skipped: "already_posted" };
  }
  const parsed = parseSourceUrl(row.source_url);
  if (!parsed) return { ok: false, ideaId: row.id, skipped: "unsupported_source" };

  const gql = ghGraphql.defaults({
    headers: { authorization: `Bearer ${GITHUB_BOT_TOKEN}` },
  });

  const projectSlug = row.id;
  const projectUrl = `${appUrl.replace(/\/$/, "")}/en/projects/${projectSlug}`;
  const body = renderTemplate(template.body, { projectUrl, title: row.title });

  try {
    const discRes = await gql<{ repository: { discussion: { id: string } } }>(
      `query($owner:String!,$repo:String!,$number:Int!){
        repository(owner:$owner,name:$repo){
          discussion(number:$number){ id }
        }
      }`,
      { owner: parsed.owner, repo: parsed.repo, number: parsed.number }
    );
    const discussionId = discRes.repository?.discussion?.id;
    if (!discussionId) {
      return { ok: false, ideaId: row.id, error: "discussion_not_found" };
    }

    const commentRes = await gql<{
      addDiscussionComment: { comment: { id: string; url: string } };
    }>(
      `mutation($discussionId:ID!,$body:String!){
        addDiscussionComment(input:{discussionId:$discussionId,body:$body}){
          comment{ id url }
        }
      }`,
      { discussionId, body }
    );

    const c = commentRes.addDiscussionComment.comment;
    const nowIso = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE ideas
         SET github_invite_posted_at = ?,
             github_invite_comment_id = ?,
             github_invite_comment_url = ?
         WHERE id = ?`
      )
      .run(nowIso, c.id, c.url, row.id);

    logInfo(`[github-invite] posted for ${row.id} -> ${c.url}`, "github-invite");
    return { ok: true, ideaId: row.id, commentId: c.id, commentUrl: c.url };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    logError(`[github-invite] ${row.id}: ${msg}`, "github-invite");
    return { ok: false, ideaId: row.id, error: msg };
  }
}

export async function postInviteForIdea(ideaId: string, opts: { force?: boolean } = {}): Promise<PostInviteResult> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, title, native_id, source, source_url, github_invite_posted_at,
              project_status, github_vote_count
       FROM ideas WHERE id = ?`
    )
    .get(ideaId) as IdeaRow | undefined;
  if (!row) return { ok: false, ideaId, error: "not_found" };

  const template = loadTemplate();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";
  return postInviteForRow(row, template, appUrl, opts);
}

export interface BulkInviteFilter {
  minVotes?: number; // default 0
  projectStatus?: Array<"idea" | "active" | "needs-contributors" | "completed" | "any">;
  source?: "iranazadabad" | "iranenovin" | "all";
  limit?: number; // default 50
  dryRun?: boolean;
  force?: boolean; // re-post even when github_invite_posted_at is set
}

export interface BulkInviteSummary {
  matched: number;
  posted: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  results: PostInviteResult[];
  candidates?: Array<Pick<IdeaRow, "id" | "title" | "project_status" | "github_vote_count">>;
}

export async function postInviteBulk(filter: BulkInviteFilter = {}): Promise<BulkInviteSummary> {
  const db = getDb();
  const minVotes = Math.max(0, filter.minVotes ?? 0);
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 200));
  const source = filter.source ?? "all";
  const statuses = (filter.projectStatus ?? ["active", "needs-contributors"]).filter(
    (s) => s && s !== "any"
  );

  const where: string[] = ["source_url IS NOT NULL"];
  const params: any[] = [];
  if (!filter.force) where.push("github_invite_posted_at IS NULL");

  if (statuses.length) {
    where.push(`project_status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (source !== "all") {
    where.push("source = ?");
    params.push(source);
  }
  if (minVotes > 0) {
    where.push(
      `(github_vote_count + COALESCE((SELECT COUNT(*) FROM votes v WHERE v.idea_id = ideas.id), 0)) >= ?`
    );
    params.push(minVotes);
  }

  const rows = db
    .prepare(
      `SELECT id, title, native_id, source, source_url, github_invite_posted_at,
              project_status, github_vote_count
       FROM ideas
       WHERE ${where.join(" AND ")}
       ORDER BY github_vote_count DESC, updated_at DESC
       LIMIT ?`
    )
    .all(...params, limit) as IdeaRow[];

  const summary: BulkInviteSummary = {
    matched: rows.length,
    posted: 0,
    skipped: 0,
    failed: 0,
    dryRun: !!filter.dryRun,
    results: [],
  };

  if (filter.dryRun) {
    summary.candidates = rows.map((r) => ({
      id: r.id,
      title: r.title,
      project_status: r.project_status,
      github_vote_count: r.github_vote_count,
    }));
    return summary;
  }

  const template = loadTemplate();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";

  for (const row of rows) {
    const res = await postInviteForRow(row, template, appUrl, { force: filter.force });
    summary.results.push(res);
    if (res.ok) summary.posted++;
    else if (res.skipped) summary.skipped++;
    else summary.failed++;
    // Pace posts so we don't trip GitHub's abuse detection on bulk runs.
    await new Promise((r) => setTimeout(r, 1500));
  }

  return summary;
}
