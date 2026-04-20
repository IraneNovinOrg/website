# IranENovin — Project Guide

**IranENovin** (ایران نوین) is a mission-driven collaboration operating system for Iranians worldwide to rebuild Iran. Ideas flow in from the community, get validated through voting and AI analysis, form into structured projects with tasks, and are executed by distributed volunteer teams.

**Live:** [iranenovin.com](https://iranenovin.com) | **Source ideas:** [IranAzadAbad/ideas](https://github.com/IranAzadAbad/ideas)

---

## Quick Reference

```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server at localhost:3000
pnpm build            # Production build (must pass with 0 errors)
```

| What | Where |
|------|-------|
| Database | `_data/iranenovin.db` (SQLite, WAL mode, 42 tables) |
| Schema | `lib/db/schema.sql` + migrations in `lib/db/index.ts` |
| AI config | `_config/ai.json` (models, admin emails, task routing) |
| Agent config | `_config/agent.json` (cycle period, thresholds, triggers) |
| AI playbooks | `_config/ai-playbooks/*.md` (7 prompt templates) |
| AI skills | `_config/ai-skills/*.md` (7 structured skills incl. suggest-repo-name) |
| Translations | `messages/en.json`, `messages/fa.json` |
| Brand assets | `public/brand/` (custom overrides in `public/brand/custom/`) |
| Environment | `.env.local` (never commit) |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| **[docs/FEATURES.md](docs/FEATURES.md)** | Complete feature list |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | File structure, tech stack, schema, performance |
| **[docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)** | Live database stats, what works, what's pending |
| **[docs/AI_AGENT.md](docs/AI_AGENT.md)** | AI system: models, playbooks, skills, triggers, jobs queue |
| **[docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)** | Bugs, failures, dead code, prioritized fix list |
| **[docs/CHANGELOG.md](docs/CHANGELOG.md)** | Version history |
| **[docs/COMPLETE_PROJECT_SPEC.md](docs/COMPLETE_PROJECT_SPEC.md)** | Full engineering spec |
| **[docs/PERFORMANCE_AUDIT.md](docs/PERFORMANCE_AUDIT.md)** | How data is stored, AI blocking analysis, DB browsing |
| **[docs/GOOGLE_SIGNIN_SETUP.md](docs/GOOGLE_SIGNIN_SETUP.md)** | Google OAuth setup without "risky app" warning |
| **[DEPLOY.md](DEPLOY.md)** | Deployment guide |

---

## Architecture

- **Framework:** Next.js 14.2 (App Router) with TypeScript strict mode
- **Database:** SQLite via better-sqlite3, WAL mode, 42 tables
- **Auth:** NextAuth v5 (GitHub OAuth + Google OAuth + Email/Password)
- **AI:** Multi-model router — Codex CLI subprocess primary (`gpt-5.4`), Anthropic Claude fallback
- **i18n:** next-intl for bilingual EN/FA with full RTL support
- **UI:** Tailwind CSS 3.4 + shadcn/ui (Radix) + Framer Motion
- **Theme:** Lion & Sun (Shir-o-Khorshid) — Iran flag colors + Persian heritage palette
- **GitHub:** Octokit for GraphQL discussion sync + repo creation
- **Background:** Non-blocking 15-min agent cycle + 3-min AI job retry loop via `instrumentation.ts`

## Key Design Decisions

1. **Every idea IS a project.** The `ideas` table has project-specific columns. No separate projects table for community ideas.
2. **SQLite for everything.** Reads are instant. No external DB. Tasks, submissions, comments, analyses, chat, AI jobs — all in one file.
3. **AI via Codex CLI subprocess.** Shells out to `codex exec -m gpt-5.4 --dangerously-bypass-approvals-and-sandbox`. Uses ChatGPT Pro session (separate quota from API). Falls back to Anthropic API.
4. **IranAzadAbad is the upstream source.** We sync ideas FROM their GitHub Discussions. Full attribution with badges.
5. **AI never blocks the UI.** All AI calls are fire-and-forget (`import("...").then(...).catch(console.error)`) or use the 202+polling job queue (`lib/ai-jobs.ts`). Background agent yields to event loop between operations.
6. **AI job retry.** Every durable AI op (analysis, doc-suggestion review) stores its payload in `ai_jobs`. Transient failures (rate limits, timeouts, codex auth expiry) are auto-retried with exponential backoff when AI comes back online.
7. **AI never sees template placeholders.** Analyze-idea playbook was rewritten without the JSON template example (was causing Codex to echo placeholder values); `extractJson` in `lib/ai/skills.ts` rejects JSON matching known template markers as a belt-and-suspenders defense.
8. **Admin list is single source of truth.** `_config/ai.json → adminEmails`, read via `lib/admin.ts` (`isAdmin`, `listAdmins`, `addAdmin`, `removeAdmin`). Never hardcode emails in routes or components; use `/api/auth/me` on the client, `isAdmin(session.user.email)` on the server.
9. **Project management = admin OR project lead.** `lib/permissions/project.ts` exposes `canManageProject` and `isProjectLead`. Applied to contributor removal, doc-suggestion approval, and lead-scoped actions.
10. **Document editing = suggestion flow.** Any signed-in user can submit edits. AI auto-reviews: `approve` → applied immediately; `reject` → rejected with reason, admins notified; `defer` → kept pending, admins + leads notified. Visual diff shows removed lines struck-through and added lines in green.
11. **Trust levels.** Discourse-inspired 4-tier system (New → Contributor → Reviewer → Lead) with auto-promotion (`lib/permissions.ts`).
12. **Drop-in brand override.** `public/brand/custom/` — user drops logo files, `LionSunLogo.tsx` fallback chain picks them up.

---

## Environment Variables

```bash
# Required
NEXTAUTH_SECRET=              # Random 32-char string
NEXTAUTH_URL=                 # https://iranenovin.com or http://localhost:3000
GITHUB_BOT_TOKEN=             # GitHub PAT (repo + discussions scope)
GITHUB_CLIENT_ID=             # GitHub OAuth App client ID
GITHUB_CLIENT_SECRET=         # GitHub OAuth App secret
GOOGLE_CLIENT_ID=             # Google OAuth client ID (see docs/GOOGLE_SIGNIN_SETUP.md)
GOOGLE_CLIENT_SECRET=         # Google OAuth client secret

# Optional
ANTHROPIC_API_KEY=            # Claude AI fallback
GOOGLE_SERVICE_ACCOUNT_EMAIL= # Google Docs integration
GOOGLE_SERVICE_PRIVATE_KEY=   # Google Docs integration
TELEGRAM_BOT_TOKEN=           # Telegram bot
TELEGRAM_CHANNEL_ID=          # Admin notifications
RESEND_API_KEY=               # Transactional emails
```

---

## Admin Access

Admin emails live in `_config/ai.json` → `adminEmails`. The `lib/admin.ts` module caches the list with a 30-second TTL and exposes programmatic `addAdmin(email)` / `removeAdmin(email)` helpers (writes the file back in place).

Admins can:
- Activate/reject projects
- Trigger AI analysis (single or bulk)
- Manually trigger any AI skill
- Configure the background agent (cycle period, thresholds)
- Create GitHub repos for projects (names suggested by AI)
- Set user trust levels
- Remove contributors from projects
- Promote/demote project leads
- Approve or reject document-edit suggestions (as well as project leads, scoped)
- View structured logs + AI operations history

---

## AI System (Quick Summary)

Full details: [docs/AI_AGENT.md](docs/AI_AGENT.md)

```
User Action → API Route → AI Trigger (fire-and-forget or ai_jobs queue)
    → Agent Orchestrator → AI Router (Codex CLI → Claude fallback)
    → Action Execution → SQLite + Activity Log + Notification Fanout
```

| Trigger | Skill / Effect | Action |
|---------|----------------|--------|
| Comment posted (>30 chars) | replyToComment | AI auto-reply after 5s |
| Task note posted (>30 chars) | replyToTaskNote | AI reply note after 5s |
| Task submitted | reviewSubmission | AI review with decision/confidence |
| Project activated | matchExperts + updateDocument | Expert matching + doc refresh |
| Task completed | updateDocument | Refresh project document |
| Periodic (15-min cycle) | suggestImprovements | Flag stale projects |
| Saturday | generateWeeklyDigest | Community digest |
| Admin chat message | Agentic planner | Chooses `create_tasks` / `generate_document` / `run_analysis` / `update_document` / `answer_question`, executes server-side |
| User submits doc edit | reviewDocSuggestion | AI approves / rejects / defers. Approved edits apply; rejected + deferred notify admins + leads |
| New AI job (analysis, doc-review) | ai_jobs queue | Stores payload; retry loop picks up after transient failures |
| GitHub repo creation | suggestRepoName | AI picks professional short repo name + topics + description |

**Task cap:** AI will never create a new task if the project already has 8+ unfinished AI tasks (`open`, `claimed`, `in-progress` with `source='ai'`). Users can still add tasks manually.

**Background cycle** (`lib/agent/cycle.ts`): GitHub sync → auto-activate (20+ votes) → analyze (max 2/cycle) → review submissions (max 3/cycle) → suggest improvements → weekly digest.

**AI job retry** (`lib/ai-jobs.ts` + `instrumentation.ts`): every 3 minutes, scan `ai_jobs` for failed-but-retryable work with payload. Exponential backoff 2→4→8→16→30 min capped, max 3 attempts.

**AI context aggregator** (`lib/ai/context.ts`): `buildProjectContext(ideaId)` gathers idea, document, prior analysis, comments, tasks, task notes, submissions, members, docs, resources, activity, open questions. `renderContextAsPrompt(ctx, {maxChars})` formats for the model. Used by admin-chat so the AI sees the full project state.

---

## Critical Files

### AI Pipeline
| File | Purpose |
|------|---------|
| `lib/ai/router.ts` | Multi-model router with `callCodexCLI()` subprocess + `callAnthropic()` fallback |
| `lib/ai/skills.ts` | Skill executors + `extractJson` with template-rejection + trailing-artifact stripping |
| `lib/ai-trigger.ts` | Event router: maps user actions to AI skills (task cap enforced) |
| `lib/ai.ts` | High-level AI functions (analyze, chat, generateDoc, review) |
| `lib/ai/agent.ts` | Agent orchestrator (context gathering + skill selection) |
| `lib/ai/context.ts` | Project context aggregator for AI calls |
| `lib/ai/review-doc-suggestion.ts` | AI auto-review for document edit suggestions |
| `lib/ai-jobs.ts` | Async AI job queue + retry with exponential backoff |
| `lib/ai-sanitize.ts` | Strip system-prompt leakage, `tokens used`, codex role markers, etc. |
| `lib/agent/cycle.ts` | Background agent 15-min cycle |
| `_config/ai.json` | Model config, admin emails, task routing |
| `_config/agent.json` | Agent cycle settings and trigger config |

### Core UI
| File | Purpose |
|------|---------|
| `components/projects/ProjectWorkspace.tsx` | Sticky top tabs (Overview, Discussion, Tasks, Document, Files, Members, Chat, Activity) |
| `components/projects/tabs/OverviewTab.tsx` | AI summary + discussion preview |
| `components/projects/tabs/DiscussionTab.tsx` | Comment threads, posting, reactions |
| `components/projects/tabs/TasksTab.tsx` | Kanban board, task detail with notes chat, submit form |
| `components/projects/tabs/DocumentTab.tsx` | Suggestion-mode editor, pending-suggestion diff panel, image upload, share-link |
| `components/projects/tabs/ChatTab.tsx` | Project group chat (persisted in `project_chat_messages`) |
| `components/projects/tabs/ContributorsTab.tsx` | Member list with lead/admin management + Remove action |
| `app/[locale]/projects/[slug]/page.tsx` | Project page with Follow button, Join, admin chat dock |
| `app/[locale]/projects/[slug]/document/page.tsx` | Standalone doc viewer with share link |
| `components/ideas/IdeasFeed.tsx` | Main feed with search, filters, pagination |
| `components/ideas/IdeaCard.tsx` | Idea card (RTL-aware trending ribbon) |
| `components/brand/LionSunLogo.tsx` | Brand mark with fallback chain |
| `components/layout/Navbar.tsx` | Home link + bell dropdown with unread count + profile-completion bubble |
| `components/layout/JumpToTop.tsx` | Floating scroll-to-top button |

### Data Layer
| File | Purpose |
|------|---------|
| `lib/db/index.ts` | SQLite connection, migrations, CRUD helpers |
| `lib/db/schema.sql` | Full schema (42 tables) |
| `lib/db/notifications.ts` | Notification row writer/reader |
| `lib/sync/index.ts` | GitHub GraphQL sync (ideas + comments + replies) |
| `lib/auth.ts` | NextAuth v5 configuration (GitHub + Google + Email/Password + dbId fallback) |
| `lib/admin.ts` | Admin email config source — `isAdmin`, `listAdmins`, `addAdmin`, `removeAdmin` |
| `lib/permissions/project.ts` | `canManageProject`, `isProjectLead` |
| `lib/permissions.ts` | Trust level system (4 tiers) |
| `lib/notifications/dispatcher.ts` | Single entry point — writes in-app row, fires telegram + email per user prefs |
| `lib/notifications/projectFanout.ts` | Notify every follower + member + lead (+ admins with `includeAdmins`) |
| `lib/notifications/templates.ts` | i18n-aware notification templates |

---

## Security Rules

- NEVER hardcode API keys, secrets, OR admin emails in source files
- NEVER commit `.env` or `.env.local` files
- Always validate user input at system boundaries (API routes)
- Admin actions gated by `isAdmin(session.user.email)` from `lib/admin.ts` (server) or `/api/auth/me` (client)
- Project management actions gated by `canManageProject(session, ideaId)` from `lib/permissions/project.ts`
- Trust levels restrict what actions users can take (`lib/permissions.ts`)
- Comment edit/delete verifies ownership (`author_login` match)
- Cascade delete uses SQLite transactions to prevent orphaned data
- Document edits from non-admins go through the AI-reviewed suggestion flow; never applied directly

---

## Concurrency & Performance

- All AI operations non-blocking (async subprocess exec, dynamic imports, fire-and-forget, or 202+polling via `ai_jobs`)
- Background agent yields to event loop between operations (`setImmediate()`)
- SWR on frontend with 2s deduplication for responsive updates
- SQLite WAL mode for concurrent reads during writes
- Batch GROUP BY queries for votes, help offers, feasibility (not N+1)
- Ideas list API selects only needed columns (excludes full body)
- Cache headers: Ideas 5s, Stats 60s, Categories 300s, Project detail: no cache
- Dynamic imports for tab components (lazy-loaded)
- Markdown editor lazy-loaded
- AI job retry loop uses exponential backoff so a transient outage doesn't hammer the model

See [docs/PERFORMANCE_AUDIT.md](docs/PERFORMANCE_AUDIT.md) for how to browse the SQLite file locally and a full table of which AI calls block which UI paths (answer: none of them block user interaction).

---

## Brand & Theme

The platform uses a **Lion & Sun (Shir-o-Khorshid)** design system inspired by Iranian heritage.

**Color palette** (`tailwind.config.ts`):
- Iran flag: `iran-green`, `iran-red`, `iran-gold`, `iran-saffron`
- Persian heritage: `persia-turquoise`, `persia-indigo`, `persia-terracotta`, `persia-clay`, `persia-ivory`

**Favicon / Chrome tab:** `public/brand/iranenovin_no_bg1_white_logo.png`
**Navbar logo:** `public/brand/iranenovin_no_bg1_white.png` (no white circle backdrop)
**Hero:** `public/brand/iranenovin_no_bg1_white.png` centered, Ferdowsi verse below in bold gold

**Logo override:** Drop files into `public/brand/custom/` — see `public/brand/custom/README.txt`. `LionSunLogo.tsx` tries custom files first.

**Fonts:** Inter (EN body), Plus Jakarta Sans (EN display), Vazirmatn (FA)

---

## Data Flow

### Ideas Lifecycle
```
GitHub Discussion (IranAzadAbad)
    → Sync to SQLite (lib/sync/index.ts)
    → Displayed in IdeasFeed
    → Community votes (20+ triggers auto-activation)
    → AI analyzes (stored in ai_jobs → ai_analyses; task cap 8 open AI tasks)
    → Volunteers claim tasks → submit work
    → AI reviews submissions
    → Project document auto-maintained
    → Followers + members + leads notified of any change
```

### Comment Flow
```
User types in DiscussionTab
    → POST /api/comments
    → Stored in idea_comments (source='local')
    → If >30 chars and not AI: handleProjectEvent('new_comment')
    → AI skill replyToComment runs after 5s delay
    → projectFanout → in-app + telegram to every follower/member/lead (excludes author)
```

### AI Analysis Flow
```
Admin clicks "Analyze" OR background agent picks idea
    → POST /api/ai/analyze → returns 202 + jobId
    → lib/ai-jobs.ts createJob('analysis', {payload})
    → runJobInBackground calls analyzeIdea → callAI → Codex CLI
    → Output sanitized (lib/ai-sanitize.ts) + template-rejected (lib/ai/skills.ts extractJson)
    → Stored in ai_analyses; tasks created up to cap of 8 open AI tasks
    → Transient failures auto-retried by the 3-min retry loop with exponential backoff
    → Activity logged; followers notified
```

### Document Suggestion Flow
```
Signed-in user (non-admin/non-lead) edits doc
    → POST /api/document-suggestions
    → Row inserted in document_suggestions (status=pending)
    → ai_job created: review-doc-suggestion
    → AI verdict → "approve" | "reject" | "defer"
    → approve: content applied to ideas.project_content, marked approved by "AI (auto)"
    → reject: marked rejected, notifications to admins + leads (includeAdmins: true)
    → defer: stays pending, notifications to admins + leads
    → Diff view in DocumentTab for reviewers (added lines green, removed struck-through red)
```

### Notification Flow
```
Any notification trigger
    → sendNotification({userId, type, title, body, linkUrl, channels})
    → writes in-app row (createNotification)
    → if user linked Telegram + pref allows: sendTelegram
    → if email channel + user opted in: sendEmail
    → Project events also fan out via notifyProject() to subscribers + members + leads (+ admins when includeAdmins)
```

---

## Recent Changes (see [docs/CHANGELOG.md](docs/CHANGELOG.md))

- **0.4.0 (Apr 2026)** — Doc-suggestion AI auto-review, project chat tab, right-side sidebar then reverted to sticky top tabs, Follow-project subscriptions, admin notifications, AI job queue with retry, profile-completion smart bubble, image upload in editor, standalone doc viewer route, Home tab, JumpToTop.
- **0.3.0** — Centralized admin config (`lib/admin.ts`), project lead permissions (`lib/permissions/project.ts`), member management for admins + leads, AI context aggregator.
- **0.2.0** — Hero logo refinement, search bar removed, workspace directory deleted, JSON parser made template-aware + trailing-artifact-aware, chat reverted from 202 to synchronous, landing page consolidation.
