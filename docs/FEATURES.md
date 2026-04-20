# IranENovin — Complete Feature List

_Last updated: 2026-04-19 (v0.4.0)_

## 1. Ideas feed
- Unified feed of 306+ ideas synced from IranAzadAbad/ideas + native submissions
- Search, category filter, stage filter, project-status filter
- Sorting: Top, New, Trending (trending based on velocity of votes in last 7 days)
- Pagination
- RTL-aware trending ribbon (flips correctly in Farsi mode)
- Each card shows: category badge, stage, active-project badge, title, body preview, comment count, vote count, author, creation time

## 2. Voting
- GitHub votes (synced from upstream) + local votes combined into one `total_votes` count
- Optional vote reason captured per vote (`votes.vote_reason`)
- 20+ votes triggers auto-activation via background agent

## 3. Comments (Discussion tab)
- GitHub + local + AI replies unified in `idea_comments` (via `source` column)
- Threading via `reply_to`
- Emoji reactions (`comment_reactions` table)
- @mentions
- Cascade delete (owner/admin)
- Edit ownership verified via `author_login`
- AI auto-reply for substantial comments (>30 chars, via `replyToComment` skill, 5s delay, 30-min cooldown)

## 4. Tasks
- Kanban board + list view
- Status: open → claimed → in-progress → in-review → done (accepted) / changes-requested / rejected
- Claim / unclaim / submit work with text OR link OR file attachments
- Per-task notes chat with threading, reactions, AI auto-reply
- **Task interaction hint**: users are reminded they can ask questions or propose changes in the notes
- AI review of submissions with decision + confidence
- **Cap at 8 open AI tasks** per project (open/claimed/in-progress with `source='ai'`). Users can still add tasks manually.
- Task detail view — never jumps away on SWR revalidation; shows "Loading task..." while refetching

## 5. Document (Document tab + `/projects/<slug>/document` viewer)
- AI-generated + user-editable markdown
- **Suggestion flow for regular users**: edit → submits as suggestion → AI auto-reviews
  - `approve` → applied to `ideas.project_content` immediately, marked approved by "AI (auto)"
  - `reject` → rejected with reason, admins + leads notified
  - `defer` → stays pending, admins + leads notified to decide
- Admin/lead direct-save path
- **Visual diff** on pending suggestions — removed lines struck-through in red, added lines highlighted in green
- **Image upload**: button, paste from clipboard, drag-and-drop (up to 5 MB, any image/*). Stored in GitHub repo via `/api/upload-image`
- **Copy share link** → `/projects/<slug>/document` standalone viewer
- Google Docs embed option (admin only)
- Doc metadata (last edited by / at / version)

## 6. Project chat (Chat tab)
- Per-project group chat persisted in `project_chat_messages`
- Text only for v1, 4000-char cap
- Optimistic send, 10s polling for new messages
- Own-message and admin delete
- Authenticated users only

## 7. Members (Contributors tab)
- Unified list derived from: `author_login` (owner) + `contributors.commenters` + `contributors.taskClaimers` + `contributors.submitters` + `contributors.helpOffers` + `project_leads`
- Roles: Owner, Lead, Contributor
- **Admins** can Make Lead / Remove Lead / Remove contributor
- **Project leads** can Remove contributor
- Avatar + name + role badge + joined date

## 8. Join + Follow project
- **Join** via `/api/help-offer` — stores in `help_offers`; auth-error messaging for incomplete sessions; `alreadyJoined` detection
- **Follow** via `/api/projects/[id]/subscribe` — in-app + telegram notifications on project changes
- Join does NOT require profile completion (shown as optional toast reminder)

## 9. AI system

### Models (via `lib/ai/router.ts`)
- Codex CLI subprocess (`gpt-5.4` via ChatGPT Pro session) — primary
- Anthropic Claude (`claude-sonnet-4-20250514`) — fallback
- OpenAI direct API — fallback if key set
- Google Gemini — fallback if key set
- Task routing via `_config/ai.json → taskRouting`

### Skills (`_config/ai-skills/*.md`)
1. `create-tasks` — project analysis → structured task list
2. `reply-to-comment` — replies to substantial comments
3. `reply-to-task-note` — replies to task notes
4. `review-submission` — reviews submitted work (decision + confidence)
5. `suggest-improvements` — flags stale projects
6. `update-document` — regenerates project document
7. `suggest-repo-name` — professional short GitHub repo name

### Playbooks (`_config/ai-playbooks/*.md`)
`analyze-idea`, `chat-rules`, `expert-match`, `generate-project-doc`, `review-submission`, `suggest-next-steps`, `system-prompt`

### Agentic admin chat (`/api/ai/admin-chat`)
AI receives full project context (via `buildProjectContext`) + admin's message, picks one of:
- `create_tasks` — creates tasks server-side (respects 8-task cap)
- `generate_document` — fire-and-forget doc regeneration
- `run_analysis` — fire-and-forget full analysis
- `update_document` — direct markdown write (small edits)
- `answer_question` — prose reply only

### AI context aggregator (`lib/ai/context.ts`)
`buildProjectContext(ideaId)` collects: idea + document + last analysis + comments + tasks + task notes + accepted submissions + pending submissions + members + docs + resources + activity log + open questions + stats.

### AI job queue with retry (`lib/ai-jobs.ts`)
- Each durable op creates an `ai_jobs` row with `payload`
- `runJobInBackground` wraps execution; on transient errors marks as failed-but-retryable
- 3-min retry loop in `instrumentation.ts` auto-resumes when AI comes back online
- Exponential backoff: 2 → 4 → 8 → 16 → 30 min capped, `max_attempts` default 3
- Supported retry types: `analysis`, `review-doc-suggestion`

### Output sanitization (`lib/ai-sanitize.ts`)
- Strips Codex headers: `OpenAI Codex v`, `workdir:`, `model:`, `provider:`, `approval:`, `sandbox:`, `reasoning`, `session id:`, separator `--------`
- Strips trailing `tokens used\n3,016`-style artifacts (multi-line)
- Strips MCP startup, role markers (`user`, `assistant`, `codex`)
- Strips web-search artifacts
- Strips playbook rule leaks

### JSON extraction (`lib/ai/skills.ts → extractJson`)
- String-aware brace scanner (respects JSON string literals with braces)
- Trailing-artifact stripping before parse
- **Template-placeholder rejection**: rejects JSON containing known markers like `"green|yellow|orange|red"`, `"A 2-3 sentence executive summary"`, etc.
- Falls back through: full parse → fenced code block → scan each `{` forward → scan each `[` forward
- 8 unit tests passing

### AI summary on Overview
Below the idea body, the Overview tab renders the cached analysis with:
- Feasibility badge + explanation
- Summary
- Project scope
- Key insights
- "What's Needed" — top 3 open tasks linked to Tasks tab
- Risks

## 10. Background systems

### Agent cycle (`lib/agent/cycle.ts`) — every 15 min
1. GitHub sync (IranAzadAbad + IranENovinOrg)
2. Auto-activate ideas with 20+ votes
3. Analyze (max 2/cycle, skip if analyzed in last hour)
4. Auto-generate docs (max 2/cycle)
5. Review submissions (max 3/cycle)
6. Suggest improvements (max 2/cycle)
7. Saturday: weekly digest

### AI job retry loop — every 3 min
- Pick up to 3 retryable jobs where `next_retry_at <= now()`
- Execute based on `job_type`
- Exponential backoff on re-failure

## 11. Notifications

### Dispatcher (`lib/notifications/dispatcher.ts`)
Single entry point `sendNotification({userId, type, title, body, linkUrl, channels})`:
- Always writes in-app row
- Fires telegram if user has `telegram_links` + prefs allow
- Fires email if `RESEND_API_KEY` + user opted in

### Fanout (`lib/notifications/projectFanout.ts`)
`notifyProject({ideaId, type, title, body, linkUrl, includeAdmins})` deduplicates across:
- `project_subscriptions` (Follow button)
- `help_offers` (joined members)
- `project_leads`
- Platform admins (when `includeAdmins: true`)
Excludes the actor (`excludeUserId`).

### Templates (`lib/notifications/templates.ts`, EN + FA)
`comment_reply`, `ai_reply`, `task_assigned`, `task_submitted`, `task_reviewed`, `mentioned`, `weekly_digest`, `idea_graduated`, `submission_reviewed`, `project_update`, `new_comment`, `task_created`, `admin_promoted`, `lead_promoted`, `doc_suggestion`, `site_announcement`.

### Bell dropdown (Navbar)
- Unread count badge (bigger, "99+" cap)
- Shows last 20 notifications
- Click to mark read + navigate
- "Mark all read" action
- Polls every 60s

### Profile completion bubble
- Only shows when `profileCompleteness < 40%` AND not marked complete
- Clears automatically once user fills 3+ of the 7 signals (name, avatar, bio, skills, location, languages, categories)

## 12. Auth (`lib/auth.ts`)
- GitHub OAuth (adds user to GitHub org)
- Google OAuth (requires published OAuth consent screen, see `GOOGLE_SIGNIN_SETUP.md`)
- Email/Password via bcrypt
- `dbId` fallback lookup by email if provider didn't set it
- Session enriched with `id`, `githubLogin`, `accessToken`, `isOrgMember`, `provider`

## 13. Permissions
- **Platform admin**: email in `_config/ai.json → adminEmails`
- **Project lead**: name/email/login in `ideas.project_leads` array
- **Trust levels** (1-4): New → Contributor → Reviewer → Lead (auto-promotion based on reputation)
- `canManageProject` = admin OR project lead
- `canManage` passed through `/api/auth/me` to UI components

## 14. Admin panel (`/admin`)
- 6 tabs: Overview stats, AI Operations, Logs, Charts (activity/AI-usage/categories), Users (trust-level management), Config (agent thresholds)
- AI operations table with latency, token counts, model, success/failure

## 15. UI
- **Navbar**: Home + Projects + Submit + Members + Invite; LocaleSwitcher + ThemeToggle + Bell + Avatar dropdown
- **Hero**: `iranenovin_no_bg1_white.png` centered, Ferdowsi verse bold gold below
- **Favicon**: `iranenovin_no_bg1_white_logo.png`
- **Jump-to-top** floating button appears after 400px scroll
- **Sticky top project tabs** stay visible on scroll
- **RTL support** throughout — trending ribbon flips correctly, fonts swap (Vazirmatn for FA)
- **Lion & Sun** design system with Iran flag + Persian heritage colors
- **Brand override**: drop files into `public/brand/custom/`

## 16. Integrations
- **GitHub** — discussion sync, repo creation (AI-suggested repo name), org membership via bot token
- **Telegram** — bot with `/start <token>` linking flow, per-user notifications, admin broadcast channel
- **Google Docs** — optional embed/sync (requires service account)
- **Resend** — optional transactional email

## 17. i18n
- EN + FA via `next-intl`
- RTL layout for Farsi (direction-aware Tailwind with `rtl:` modifier)
- Fonts: Inter (EN body), Plus Jakarta Sans (EN display), Vazirmatn (FA)

## 18. Data storage
- Single SQLite file `_data/iranenovin.db` (WAL mode, 42 tables)
- Browsable with `sqlite3` CLI or DB Browser for SQLite
- WAL mode enables concurrent reads during writes
- Migrations run inline in `getDb()` init with try/catch (idempotent)

## 19. Performance
- AI never blocks the UI — fire-and-forget, 202+polling, or background retry queue
- SWR dedup (2s) + server cache headers
- SQLite in-process reads are instant
- Dynamic imports for heavy UI (markdown editor, tab components)
- See `docs/PERFORMANCE_AUDIT.md` for the full blocking/non-blocking table
