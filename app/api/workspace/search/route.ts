/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Workspace V2 — Phase 4: Unified search endpoint.
 *
 * GET /api/workspace/search?q=term&limit=20
 *   Searches across projects (ideas), tasks, doc pages, and users and
 *   returns grouped results for the global command palette.
 *
 *   Each result row has the shape:
 *     { id, title, subtitle, url, kind }
 *
 *   Group sizes are capped at 5 by default so a single dominant kind can't
 *   hide results from the others.
 */
interface SearchRow {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  kind: "project" | "task" | "doc" | "user";
}

interface IdeaRow {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  idea_id: string;
  idea_title: string | null;
  idea_id_for_url: string | null;
}

interface DocRow {
  id: string;
  title: string;
  idea_id: string;
  content_plain: string | null;
  idea_title: string | null;
}

interface UserRow {
  id: string;
  name: string | null;
  github_login: string | null;
}

const GROUP_LIMIT = 5;

function clampSnippet(s: string | null | undefined, n = 80): string {
  if (!s) return "";
  const cleaned = s.replace(/\s+/g, " ").trim();
  return cleaned.length > n ? cleaned.slice(0, n - 1) + "…" : cleaned;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const totalLimit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 20;

  const empty = {
    projects: [] as SearchRow[],
    tasks: [] as SearchRow[],
    docs: [] as SearchRow[],
    users: [] as SearchRow[],
  };

  if (q.length === 0) {
    return NextResponse.json(empty, {
      headers: { "Cache-Control": "no-cache" },
    });
  }

  const like = `%${q}%`;
  const db = getDb();

  // ── Projects (ideas) ───────────────────────────────────────────────
  let ideas: IdeaRow[] = [];
  try {
    ideas = db
      .prepare(
        `SELECT id, title, body, category
           FROM ideas
          WHERE title LIKE ? COLLATE NOCASE
             OR body  LIKE ? COLLATE NOCASE
          ORDER BY COALESCE(github_vote_count, 0) DESC, title ASC
          LIMIT ?`
      )
      .all(like, like, GROUP_LIMIT) as IdeaRow[];
  } catch {
    ideas = [];
  }

  const projects: SearchRow[] = ideas.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.category || clampSnippet(r.body, 80),
    url: `/workspace/p/${r.id}`,
    kind: "project",
  }));

  // ── Tasks ──────────────────────────────────────────────────────────
  let tasks: TaskRow[] = [];
  try {
    tasks = db
      .prepare(
        `SELECT t.id, t.title, t.description, t.idea_id,
                i.title as idea_title, i.id as idea_id_for_url
           FROM tasks t
           LEFT JOIN ideas i ON i.id = t.idea_id
          WHERE t.title       LIKE ? COLLATE NOCASE
             OR t.description LIKE ? COLLATE NOCASE
          ORDER BY t.created_at DESC
          LIMIT ?`
      )
      .all(like, like, GROUP_LIMIT) as TaskRow[];
  } catch {
    tasks = [];
  }

  const taskResults: SearchRow[] = tasks.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.idea_title || clampSnippet(r.description, 80),
    url: r.idea_id_for_url
      ? `/workspace/p/${r.idea_id_for_url}/tasks/${r.id}`
      : `/workspace/p/${r.idea_id}/tasks/${r.id}`,
    kind: "task",
  }));

  // ── Doc pages ──────────────────────────────────────────────────────
  let docs: DocRow[] = [];
  try {
    docs = db
      .prepare(
        `SELECT d.id, d.title, d.idea_id, d.content_plain,
                i.title as idea_title
           FROM doc_pages d
           LEFT JOIN ideas i ON i.id = d.idea_id
          WHERE d.title         LIKE ? COLLATE NOCASE
             OR d.content_plain LIKE ? COLLATE NOCASE
          ORDER BY d.updated_at DESC
          LIMIT ?`
      )
      .all(like, like, GROUP_LIMIT) as DocRow[];
  } catch {
    docs = [];
  }

  const docResults: SearchRow[] = docs.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.idea_title || clampSnippet(r.content_plain, 80),
    url: `/workspace/p/${r.idea_id}/docs/${r.id}`,
    kind: "doc",
  }));

  // ── Users ──────────────────────────────────────────────────────────
  let users: UserRow[] = [];
  try {
    users = db
      .prepare(
        `SELECT id, name, github_login
           FROM users
          WHERE name         LIKE ? COLLATE NOCASE
             OR github_login LIKE ? COLLATE NOCASE
          ORDER BY COALESCE(name, github_login) ASC
          LIMIT ?`
      )
      .all(like, like, GROUP_LIMIT) as UserRow[];
  } catch {
    users = [];
  }

  const userResults: SearchRow[] = users.map((r) => ({
    id: r.id,
    title: r.name || r.github_login || r.id,
    subtitle: r.github_login ? `@${r.github_login}` : "",
    url: `/members/${r.github_login || r.id}`,
    kind: "user",
  }));

  // Cap the total number of rows returned across all groups so the palette
  // never renders more than `limit` items.
  const combined = [
    ...projects,
    ...taskResults,
    ...docResults,
    ...userResults,
  ].slice(0, totalLimit);

  const pickKind = (kind: SearchRow["kind"]): SearchRow[] =>
    combined.filter((r) => r.kind === kind);

  return NextResponse.json(
    {
      projects: pickKind("project"),
      tasks: pickKind("task"),
      docs: pickKind("doc"),
      users: pickKind("user"),
    },
    { headers: { "Cache-Control": "no-cache" } }
  );
}
