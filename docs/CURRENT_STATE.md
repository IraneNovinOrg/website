# IranENovin — Current State

_Last updated: 2026-04-19_

## Database snapshot

File: `_data/iranenovin.db` (SQLite, WAL mode, 42 tables). Browse with `sqlite3` or DB Browser for SQLite.

| Table | Rows | Notes |
|-------|------|-------|
| `ideas` | 306 | 302 synced from IranAzadAbad + 4 native |
| `idea_comments` | 352 | GitHub-synced + local replies + AI replies |
| `tasks` | 30 | AI-generated + user-proposed |
| `users` | 2 | Pre-launch — includes admin (`omid.taheri.71@gmail.com`) |
| `ai_analyses` | 2 | Real analyses (template-garbage ones purged in 0.2.0) |
| `ai_jobs` | 3 | Job queue for durable/retryable AI ops |
| `document_suggestions` | 3 | Live-tested suggestion flow |
| `project_chat_messages` | 2 | Project group chat |
| `help_offers` | 1 | Join-project entries |
| `project_subscriptions` | 0 | Follow-project opt-ins |
| `notifications` | 1 | In-app notifications |

## What works ✅

### Content & community
- Ideas feed with 306 ideas, search, filters, sorting (top/new/trending)
- Voting combines GitHub + local counts; 20+ votes auto-activates projects
- Comments with threading, reactions, @mentions, cascade delete
- Task kanban board with claim/submit/unclaim/status transitions + per-task notes chat with reactions
- Task interaction hints — users know they can comment to ask questions or propose modifications
- Join project flow with alreadyJoined detection + auth fallback for missing `dbId`
- Follow project button → in-app + telegram notifications on changes
- Project chat tab — persisted, 10s polling, own/admin delete
- Contributors tab with admin & lead management — admins can Make/Remove Lead + Remove contributor; leads can Remove contributor

### AI system
- Codex CLI (`gpt-5.4`) primary + Claude fallback via `lib/ai/router.ts`
- AI summary on Overview: feasibility, summary, project scope, key insights, What's Needed (top open tasks), Risks
- AI admin chat — agentic planner picks `create_tasks` / `generate_document` / `run_analysis` / `update_document` / `answer_question` and executes server-side
- AI context aggregator (`lib/ai/context.ts`) — admin-chat sees idea + document + previous analysis + comments + tasks + submissions + members + activity
- AI job queue with retry (`lib/ai-jobs.ts`) — transient failures auto-resume when AI is back online; exponential backoff 2→4→8→16→30 min capped
- Output sanitization — strips Codex headers, `tokens used`, role markers, system-prompt leaks, playbook rule leaks
- Response validation — rejects template placeholders like `"green|yellow|orange|red"`
- Cap at 8 open AI tasks per project (users can still add manually)
- Document suggestion AI auto-review — `approve` applies immediately, `reject` rejects with reason and notifies admins, `defer` notifies admins + leads

### Document editor
- Any signed-in user can edit → submitted as suggestion
- Diff view with added-green / removed-strikethrough lines (Google-Docs-style)
- Image upload via button / paste / drag-drop → stored in GitHub repo via `/api/upload-image`
- "Copy share link" → `/projects/<slug>/document` standalone read-only viewer
- Admin/lead direct-save path; Google Docs embed option

### UI
- Hero: `iranenovin_no_bg1_white.png` centered, no circle, Ferdowsi verse bold gold below
- Favicon: `iranenovin_no_bg1_white_logo.png`
- Navbar: Home + Projects + Submit + Members + Invite
- Bell dropdown with unread count (bigger red badge, "99+" cap)
- Profile-completion red "!" bubble — only shows when profile is <40% complete
- Admin Panel link only for users in `_config/ai.json → adminEmails`
- Jump-to-top floating button
- Project tabs: sticky top bar (Overview, Discussion, Tasks, Document, Files, Members, Chat, Activity) — stays visible on scroll
- Right-to-left Farsi throughout; trending ribbon flips correctly

### Notifications
- `lib/notifications/dispatcher.ts` writes in-app + fires telegram + email per user prefs
- `lib/notifications/projectFanout.ts` notifies subscribers + members + leads (+ admins when `includeAdmins`)
- Templates: `comment_reply`, `ai_reply`, `project_update`, `new_comment`, `task_created`, `admin_promoted`, `lead_promoted`, `doc_suggestion`, `site_announcement`, plus task/review flows
- Bell dropdown polls every 60s; mark-all-read

### Auth & permissions
- GitHub OAuth + Google OAuth + Email/Password; `dbId` fallback lookup by email
- Centralized admin config via `lib/admin.ts` with 30s TTL cache
- `canManageProject(session, ideaId)` = admin OR project lead
- Trust level system (`lib/permissions.ts`, 4 tiers)
- `/api/auth/me?ideaId=...` returns `{isAdmin, isLead, canManage, profileCompleted, profileCompleteness, needsProfileAttention}`

### Background
- 15-min agent cycle: GitHub sync → auto-activate → analyze → review → digest
- 3-min AI job retry loop picks up failed-but-retryable work
- Both run in `instrumentation.ts` with `setImmediate` yielding

## What's blocked / partial ⏸

- **Google sign-in "risky app" warning** — not a code issue. See [GOOGLE_SIGNIN_SETUP.md](GOOGLE_SIGNIN_SETUP.md). Needs consent screen published in Google Cloud Console (only non-sensitive scopes, no verification required).
- **Admin UI to add/remove other admins** — backend in place (`addAdmin` / `removeAdmin`) but no form in `/admin` yet.
- **Site-wide announcements** — `site_subscriptions` table + template exist; composer UI not wired.
- **Email channel** — dispatcher sends email when `RESEND_API_KEY` is set and user opted in; opt-in UI not surfaced.
- **Real-time doc collaboration** (multi-cursor / CRDT) — intentionally out of scope for v1. Suggestion flow is the intermediate answer.

## Dead / cleaned up 🗑

- Old `/app/[locale]/workspace/` directory — deleted
- "Try the new workspace" cutover banner — removed
- Top-of-nav search / Cmd+K command palette — removed
- Template-placeholder bug — fixed at 4 layers: playbook rewrite, `extractJson` template rejection, `analyzeIdea` validation, Codex output role-marker parsing

## Files to look at for each subsystem

| Subsystem | Primary files |
|-----------|---------------|
| AI pipeline | `lib/ai/router.ts`, `lib/ai/skills.ts`, `lib/ai/agent.ts`, `lib/ai/context.ts`, `lib/ai-jobs.ts`, `lib/ai-sanitize.ts`, `lib/ai-trigger.ts`, `lib/ai.ts` |
| Notifications | `lib/notifications/dispatcher.ts`, `lib/notifications/projectFanout.ts`, `lib/notifications/templates.ts`, `lib/notifications/telegram.ts` |
| Permissions | `lib/admin.ts`, `lib/permissions/project.ts`, `/api/auth/me` |
| Project UI | `components/projects/ProjectWorkspace.tsx`, `components/projects/tabs/*` |
| Doc suggestions | `lib/ai/review-doc-suggestion.ts`, `/api/document-suggestions`, `components/projects/tabs/DocumentTab.tsx` |
| Subscriptions | `/api/projects/[id]/subscribe`, `projectFanout.ts` |
| Admin config | `lib/admin.ts`, `_config/ai.json` |
