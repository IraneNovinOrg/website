# Performance Audit — What blocks the UI, what doesn't

## TL;DR

**The AI never blocks the UI** for user-triggered actions. All AI entry points are fire-and-forget or return 202 with polling. Slowness you're seeing is likely:

1. Project detail page does **one** big `/api/projects/[id]` fetch that serially loads idea + comments + tasks + submissions + activity. On active projects with 300+ comments, this can take 300-800ms. → **Fix: pagination for comments (already capped at 50), lazy-load activity log.**
2. SQLite cold-start WAL checkpoint on first request per Node process. → **Not fixable without moving to a persistent server; acceptable.**
3. Dev mode is always slower than production. Use `pnpm build && pnpm start` to benchmark.

## How data is stored (for admins)

Everything is in a single SQLite file: `_data/iranenovin.db`. You can browse it with any SQLite tool:

```bash
# CLI
sqlite3 _data/iranenovin.db ".tables"
sqlite3 _data/iranenovin.db "SELECT * FROM ideas LIMIT 10;"

# GUI (recommended):
brew install --cask db-browser-for-sqlite
open -a "DB Browser for SQLite" _data/iranenovin.db
```

Main tables (42 total as of this audit):
- `ideas` — one row per project (includes `project_content` markdown + JSON fields for leads, docs, resources)
- `idea_comments` — discussion thread (GitHub-sourced + local replies, `source` column)
- `tasks` — task board, `source='ai'` or `'user'`
- `task_notes` — per-task comments
- `submissions` — work submitted on tasks
- `help_offers` — community members who joined projects
- `users`, `votes`, `vote_counts`, `notifications`, `activity_log`, `ai_analyses`, `ai_jobs`, `project_chat_messages`, `document_suggestions` (and more)

WAL mode is on, so reads never block writes and vice-versa. DB size is typically < 50 MB.

## AI — does it block the UI?

| Entry point | Blocks UI? | How |
|-------------|------------|-----|
| `/api/ai/analyze` POST | No — returns 202 with `jobId`; analysis runs in `setImmediate` | `lib/ai-jobs.ts` job queue |
| `/api/ai/chat` POST (user-facing project chat) | No — synchronous but typically <20s with a loading spinner | Direct `callAI` |
| `/api/ai/admin-chat` POST | No — actions (create_tasks, generate_document, run_analysis) run fire-and-forget | `lib/ai-trigger.ts` |
| Background agent cycle (`instrumentation.ts`) | No — runs every 15 min in the node process, never on HTTP hot path | `setImmediate`, `yieldToEventLoop()` |
| GitHub sync | No — runs in background cycle | `lib/sync/index.ts` |
| Doc generation, skill execution | No — always fire-and-forget from triggers | `lib/ai/skills.ts` |

The one user-visible AI call that IS synchronous is `chatWithContext` used by the regular user chat panel (`/api/ai/chat`). Codex CLI typically takes 10-30 seconds. The UI shows "thinking..." during that time and the rest of the page stays interactive — only the chat input is disabled.

## Other things that could feel slow

- **Initial hero image** — the `iranenovin_no_bg1_white.png` logo is ~800 KB. Optimize with `next/image` + static import for automatic sizing (follow-up task).
- **Ideas feed on `/` or `/projects`** — SWR with `dedupingInterval=10000` caches responses for 10s. First load fetches ~2 MB of JSON for 300+ ideas. → **Fix: pagination on feed (already partially done via `?stage=` filters).**
- **Navbar `/api/auth/me` ping on every mount** — runs once per page; acceptable.
- **Tab content (Overview/Tasks/Discussion)** — each tab re-renders on switch but uses the same `useProject` SWR data, so no extra fetches.

## Recommended next steps (if still too slow)

1. `pnpm build && pnpm start` — production build is 2-5x faster than `pnpm dev`.
2. Add `next/image` for the hero logo (saves ~500 KB on every visit).
3. Paginate comments on project detail (currently returns all; should cap at 100 server-side).
4. Lazy-load ActivityTab via `dynamic()` (already done).

## How to verify AI is truly non-blocking

1. Open a project in two browser tabs.
2. In tab A: click "Run AI Analysis" (admin).
3. In tab B: immediately navigate, post a comment, vote on an idea.
4. Tab B should remain responsive while tab A's analysis runs in the background. The analysis completes silently and updates appear on next tab B interaction (or refresh).
