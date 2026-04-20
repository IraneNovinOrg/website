# IranENovin — Changelog

## [0.4.0] — 2026-04-17 → 2026-04-19 — Document suggestions, AI retry, notifications overhaul

### Added
- **Document suggestion flow** — any signed-in user can edit the project doc as a suggestion. AI auto-reviews: approve → apply + mark approved, reject → notify admins/leads with reason, defer → notify admins/leads for human decision. Diff view with added-green + removed-strikethrough lines.
- **AI job queue with retry** (`lib/ai-jobs.ts`) — every durable AI op stores payload; transient failures (rate limit, timeout, auth, network) auto-retry with exponential backoff 2→4→8→16→30 min capped, max 3 attempts. Retry loop runs every 3 min via `instrumentation.ts`.
- **Project Chat tab** — per-project group chat persisted in `project_chat_messages`, 10s polling, own/admin delete.
- **Follow-project button** — `/api/projects/[id]/subscribe` GET/POST/DELETE. `project_subscriptions` table.
- **Notification fanout** — `lib/notifications/projectFanout.ts`. Includes `includeAdmins` flag so doc-suggestion notifications reach platform admins even when they're not members/leads.
- **Expanded notification templates** — `project_update`, `new_comment`, `task_created`, `admin_promoted`, `lead_promoted`, `doc_suggestion`, `site_announcement`.
- **Notification comment fanout** — every new substantial comment fans out to followers/members/leads (not the author).
- **Lead promotion notifications** — when admin PATCHes `projectLeads`, newly-added leads are notified.
- **Bell dropdown with notifications list** — shows title, body, time, unread dots, mark-all-read, mark-on-click. Bell stops pointing to `/profile`.
- **Bigger red badges** — unread count with "99+" cap, ring, "!" mark for profile completion attention.
- **Smart profile-completion bubble** — only shows when profile is <40% complete (7 signals: name, avatar, bio, skills, location, languages, categories).
- **Home tab** in navbar before Projects.
- **Jump-to-top** floating button after 400px scroll.
- **Image upload in doc editor** — button + paste + drag-drop; files up to 5MB; stored in GitHub repo via existing `/api/upload-image`; auto-inserts markdown.
- **Standalone document viewer** — `/projects/<slug>/document` clean shareable URL; "Copy share link" in DocumentTab header.
- **Centralized admin config module** — `lib/admin.ts` now exposes `isAdmin`, `listAdmins`, `addAdmin`, `removeAdmin`, `invalidateAdminCache` with 30s TTL cache. Admin list single source of truth: `_config/ai.json → adminEmails`.
- **`/api/auth/me` endpoint** — returns `{authenticated, email, isAdmin, isLead, canManage, profileCompleted, profileCompleteness, needsProfileAttention}`; optional `?ideaId=` for per-project lead check.
- **`lib/permissions/project.ts`** — `isProjectLead`, `canManageProject`. Used by member-removal and doc-suggestion approval APIs.
- **`lib/ai/context.ts`** — `buildProjectContext(ideaId)` aggregator + `renderContextAsPrompt(ctx)` used by admin-chat so the AI sees full project state.
- **AI admin chat** — `/api/ai/admin-chat` is now agentic: AI picks `create_tasks` / `generate_document` / `run_analysis` / `update_document` / `answer_question` and the server executes it. Cap at 8 open AI tasks enforced.
- **Task cap at 8** for AI-generated tasks — applies to background analysis AND admin-chat create_tasks.
- **Task interaction hints** — task detail view has explanatory text about commenting to ask questions or propose changes.
- **AI-consulted GitHub repo naming** — before creating a repo, `lib/github-repos.ts` asks AI for a professional short name.
- **`suggest-repo-name.md` skill file**.

### Changed
- **Sticky top tab bar** — reverted the right-side sidebar experiment; tabs stay on top and stay visible on scroll (`sticky top-16`).
- **Hero logo** — `iranenovin_no_bg1_white.png` centered, no white circle, Ferdowsi verse bold gold below the logo (inside the hero, not a separate section).
- **Favicon** — `iranenovin_no_bg1_white_logo.png`.
- **AI analysis returns 202 + jobId** — frontend polls `/api/ai/jobs/{jobId}` instead of blocking.
- **Chat endpoint reverted from 202 to synchronous** — the 202 flow broke the project page's inline admin chat; chat is fast enough to stay synchronous with a spinner.
- **`extractJson` in `lib/ai/skills.ts`** — rewrote with string-aware brace scanner (respects JSON string literals), trailing-artifact stripping (`tokens used\n3,016`), and template-placeholder rejection.
- **`analyzeIdea` in `lib/ai.ts`** — validates the parsed output isn't a template echo; throws explicit error if it is.
- **`lib/ai/router.ts` Codex CLI parsing** — now finds the `assistant`/`codex` role marker separating echoed prompt from actual response; falls back to metadata-line skip heuristics.
- **`_config/ai-playbooks/analyze-idea.md`** — removed the JSON template example (was causing Codex to echo placeholder values like `green|yellow|orange|red`); format is now described in prose.
- **Member management** — `canManageProject` (admin OR project lead) gates contributor removal and doc-suggestion approval.
- **Project page action bar** — now has Vote + Join + Follow + Share + (admin controls).
- **Join project** no longer blocks on incomplete profile — shows dismissible toast instead of in-page banner.
- **Navbar avatar menu** — Admin Panel link only visible if `/api/auth/me` says `isAdmin`. No hardcoded emails.

### Removed
- **Workspace section** — `app/[locale]/workspace/` directory deleted.
- **"Try the new workspace" banner** — removed from ProjectWorkspace.
- **Top search bar / Cmd+K command palette** — per user request.
- **Hardcoded admin email lists** — all call-sites now use `isAdmin()` or `/api/auth/me`.

### Fixed
- **AI analysis stored template garbage** — multi-layer fix: playbook rewrite, `extractJson` rejects known markers, `analyzeIdea` validates output, Codex output parsing uses role markers, and 2 garbage analyses + 2 garbage tasks purged from DB.
- **"Sorry, I couldn't process that" chat error** — root cause was 202 pattern change; chat reverted to synchronous on the project page; AIChat component also handles synchronous case.
- **Task comment view jumped to tasks list** — caused by `setSelectedTask(null)` during SWR revalidation; now shows "Loading task..." and preserves selection.
- **Admin didn't receive doc-suggestion notifications** — `notifyProject` now has `includeAdmins: true` option and doc-suggestion paths use it; admins are looked up by `listAdmins()` from centralized config.
- **Red bubble on profile stayed forever** — now respects `profileCompleteness` and clears at ≥40%.
- **"project.chat" raw text in tab** — added `chat` i18n key in both locales.
- **RTL trending ribbon overlapped IAB badge** — ribbon now placed on `start` corner (opposite of IAB `end` corner), with `rtl:rotate-45` to flip correctly.
- **AI replies showed "NULL" / "tokens used 3,016"** — sanitizer strips these patterns multi-line; agent rejects replies that are `NULL` or contain only metadata; 3 garbage task notes cleaned in DB.
- **AI chat leaked system prompt** — sanitizer strips Codex headers, playbook rules, role markers, web-search artifacts.

## [0.3.0] — 2026-04-17 — Tabs port, permissions, context

- Ported old platform's tab components (Overview, Tasks, Document, Contributors, Activity, Files) while keeping the new DiscussionTab.
- Added `lib/permissions/project.ts` with lead/admin combined checks.
- Centralized admin config via `lib/admin.ts`.
- Built `lib/ai/context.ts` aggregator for AI calls.

## [0.2.0] — 2026-04-15/16 — Finalization Audit & Fix

Comprehensive audit of all user-facing flows. Fixed 6 broken flows, added 2 missing APIs, and added 3 missing UI components.

- Build: 47 static pages, 88.2 kB shared JS, 63 API routes
- Fixed 6 broken flows (AI router, comment POST, cascade deletes, auth gates, error handling)
- Added: TaskSubmitForm, AIReviewCard, task status PATCH endpoint, remove contributor button, brand asset folder
- Changed: AI model from gpt-4o → gpt-5.4, LionSunLogo now uses fallback chain for custom assets

## [0.1.0] — 2026-04-14/15 — Lion & Sun Upgrade

Complete platform redesign and rebuild.

- Phase 1: Design system (brand assets, Iran flag colors, CSS utilities, custom animations)
- Phase 2: Navigation & homepage
- Phase 3: Discussion UI
- Phase 4: Workspace tabs with AI skills system
- Phase 5-6: AI Skills (7 structured skills, event-driven triggers, 30-min cooldown)
- Phase 7: Notifications pipeline
- Phase 8: Search & data fixes
- Phase 9: Admin panel (6 tabs)
- Phase 10: UI polish
- Phase 11: Profile & members (reputation, trust levels, skill endorsements)
