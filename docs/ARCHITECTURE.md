# IranENovin — Architecture & File Structure

_Last updated: 2026-04-19 (v0.4.0)_

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2 |
| Language | TypeScript strict mode | 5.x |
| Runtime | Node.js | 20+ |
| Package manager | pnpm | 9.x |
| Database | SQLite via `better-sqlite3` | WAL mode, 42 tables |
| Auth | NextAuth.js v5 (beta) | GitHub + Google + Credentials |
| Styling | Tailwind CSS | 3.4 |
| UI primitives | shadcn/ui (Radix) | latest |
| Animation | Framer Motion | 11.x |
| i18n | next-intl | 3.x |
| AI client | native fetch + Codex CLI subprocess | — |
| GitHub API | Octokit (REST + GraphQL) | 21.x |
| Markdown | react-markdown + @uiw/react-md-editor | latest |

## Directory Layout

```
app/
  [locale]/                    # next-intl locale segment
    layout.tsx                 # Root layout: Navbar, Footer, JumpToTop, Providers
    page.tsx                   # Homepage
    HomeHero.tsx               # Hero client component
    HomeTabs.tsx               # Home tab sections
    StatsBar.tsx
    ProjectsSection.tsx
    MembersSection.tsx
    ideas/                     # Ideas routes
    projects/[slug]/
      page.tsx                 # Project detail with admin chat dock
      document/page.tsx        # Standalone doc viewer with share link
    profile/
    admin/                     # Admin panel (6 tabs)
    tasks/[id]/                # Individual task detail page
    submit/                    # Submit idea
    members/                   # Community directory
    invite/                    # Invitations
    join/                      # Join via invite code
  api/                         # All API routes
    auth/
      [...nextauth]/route.ts   # NextAuth handler
      me/route.ts              # User capabilities: isAdmin, isLead, canManage, profileCompleteness
      register/route.ts        # Email/password signup
    ai/
      analyze/route.ts         # 202 + jobId analysis trigger
      chat/route.ts            # Synchronous project chat
      admin-chat/route.ts      # Agentic admin chat (plans + executes actions)
      review/route.ts          # Submission review
      skills/[skillName]/route.ts # Manual skill trigger
      jobs/[jobId]/route.ts    # Poll AI job status
    admin/                     # Admin-only endpoints
    comments/                  # Comment CRUD
    document-suggestions/      # Submit/approve/reject doc edits
    help-offer/                # Join project
    ideas/                     # Ideas CRUD
    notifications/             # In-app notification list + mark-read
    projects/[id]/
      route.ts                 # Project detail PATCH (content, leads, remove contributor)
      chat/route.ts            # Project group chat
      subscribe/route.ts       # Follow/unfollow project
      generate-doc/route.ts    # Regenerate project doc
      tasks/route.ts
      content/route.ts
      comment/route.ts         # Legacy
    projects/launch/route.ts   # Create + graduate + GitHub repo
    tasks/                     # Task claim, submit, notes, review, status
    teams/                     # Team management
    telegram/                  # Bot webhook + linking
    users/[id]/endorse/route.ts
    upload/ + upload-image/    # File/image uploads → GitHub repo
    workspace/                 # Legacy workspace endpoints (still exist as API, UI removed)
    stats/, members/, config/, categories/, debug/, sync/, feedback/, invite/, profile/, anonymous-suggest/

  layout.tsx                   # Outermost root (sets favicon, metadata, icons)
  globals.css

components/
  ai/                          # AIChat, AIAnalysis panels
  auth/AuthModal.tsx
  brand/                       # LionSunLogo, SunMotif, IranMap, GirihPattern
  collaboration/CollaborationBanner
  comments/CommentThread
  ideas/                       # IdeasFeed, IdeaCard (with RTL trending ribbon)
  layout/                      # Navbar, Footer, LocaleSwitcher, ThemeToggle, TelegramBanner, JumpToTop
  onboarding/WelcomeBanner
  projects/
    ProjectWorkspace.tsx       # Sticky top tab bar container
    ProjectCard.tsx
    ProjectsFeed.tsx
    TaskList.tsx
    constants.ts, types.ts
    tabs/
      OverviewTab.tsx          # AI summary + discussion preview
      DiscussionTab.tsx        # Comment threads with reactions
      TasksTab.tsx             # Kanban + task detail + notes chat
      DocumentTab.tsx          # Suggestion flow + image upload + diff view
      FilesTab.tsx
      ContributorsTab.tsx      # Member list with lead/admin management
      ActivityTab.tsx
      ChatTab.tsx              # Project group chat (polling)
  ui/                          # shadcn primitives + MarkdownRenderer
  feedback/FeedbackButton.tsx

lib/
  admin.ts                     # SINGLE SOURCE of admin email list (config-driven)
  auth.ts                      # NextAuth v5 config with dbId fallback
  permissions.ts               # 4-tier trust level system
  permissions/project.ts       # canManageProject, isProjectLead
  db/
    index.ts                   # SQLite connection, migrations, helpers
    schema.sql                 # Base schema (inline migrations extend this)
    notifications.ts           # Notification row writer/reader
  ai/
    router.ts                  # Multi-model routing + Codex CLI subprocess + Claude fallback
    skills.ts                  # extractJson + skill runner + typed skills (replyToComment, etc.)
    agent.ts                   # Agent event orchestrator
    context.ts                 # buildProjectContext + renderContextAsPrompt
    review-doc-suggestion.ts   # AI auto-review for doc edits
    playbooks.ts               # Playbook/skill loader
    openai-auth.ts             # Codex OAuth token helper
  ai.ts                        # analyzeIdea, chatWithContext, generateProjectDocument, reviewSubmission
  ai-jobs.ts                   # ai_jobs queue + retry with exponential backoff
  ai-sanitize.ts               # Output sanitization (strip Codex artifacts, playbook rule leaks)
  ai-tasks.ts                  # Task CRUD for AI flows
  ai-trigger.ts                # User events → AI skills; enforces 8-task cap
  agent/cycle.ts               # Background 15-min cycle
  notifications/
    dispatcher.ts              # Main sendNotification; in-app + telegram + email
    projectFanout.ts           # Fan out to subscribers + members + leads (+ admins opt-in)
    templates.ts               # i18n-aware notification templates
    telegram.ts, email.ts
  sync/index.ts                # GitHub GraphQL sync for discussions
  github-repos.ts              # GitHub repo creation (AI-suggested name)
  telegram/bot.ts              # Telegram bot init + webhook handlers
  hooks/                       # SWR hooks (useProject, useNotifications, etc.)
  workspace/                   # Legacy helpers (flag, paletteStore — partially used)
  logger.ts                    # Structured logs → logs table
  constants.ts
  emoji-map.ts
  rate-limit.ts
  motion.ts                    # Framer Motion variants

_config/
  ai.json                      # Models + adminEmails + taskRouting
  agent.json                   # Trigger config + cycle period + thresholds
  telegram.json                # Bot config
  ai-playbooks/                # System prompt templates
    system-prompt.md, analyze-idea.md, chat-rules.md, expert-match.md,
    generate-project-doc.md, review-submission.md, suggest-next-steps.md
  ai-skills/                   # Structured skill definitions
    create-tasks.md, reply-to-comment.md, reply-to-task-note.md,
    review-submission.md, suggest-improvements.md, update-document.md,
    suggest-repo-name.md

messages/
  en.json, fa.json             # next-intl translations

public/
  brand/                       # Default brand assets (git-tracked)
    iranenovin_no_bg.jpg
    iranenovin_no_bg1.jpg
    iranenovin_no_bg1_white.png        # Main logo (no circle needed)
    iranenovin_no_bg1_white_logo.png   # Favicon
    iranenovin_no_bg2.jpg, iranenovin_no_bg2_white.png, iranenovin_no_bg2_white_logo.png
    girih-pattern.svg, iran-map.svg, sun-rays.svg
    lion-and-sun.svg, lion-and-sun-mini.svg
    custom/                    # User overrides (drop logo files here)

docs/
  FEATURES.md, ARCHITECTURE.md, CURRENT_STATE.md, AI_AGENT.md,
  KNOWN_ISSUES.md, CHANGELOG.md, COMPLETE_PROJECT_SPEC.md,
  UPGRADE_NOTES.md, PERFORMANCE_AUDIT.md,
  GOOGLE_SIGNIN_SETUP.md, google-docs-setup.md

instrumentation.ts             # Next.js instrumentation — starts background loops
middleware.ts                  # next-intl routing + RTL detection
next.config.mjs
i18n/routing.ts
_data/iranenovin.db            # SQLite (never commit)
_data/ai-analyses/             # Legacy JSON analyses (migrated to DB)
```

## Database — 42 tables

### Core entities
| Table | Purpose |
|-------|---------|
| `users` | Auth + profile + notification_prefs + trust_level + profile_completed |
| `ideas` | Unified ideas cache — GitHub-synced + native. Includes project-specific columns (`project_content`, `project_status`, `project_leads`, `project_docs`, `project_resources`, `project_doc_meta`, `google_doc_url`, `teaser_image_url`, `github_repo_url`, `ai_open_questions`, `ai_analyzed_at`, `last_ai_document_at`, `last_ai_suggestion_at`) |
| `idea_comments` | Discussion threads (`source`: github / local / ai; `reply_to` for threading; `is_ai_reply`) |
| `votes` | Individual votes with optional `vote_reason` |
| `vote_counts` | Denormalized total per idea (GitHub + local) |
| `comment_reactions` | Emoji reactions on comments |

### Tasks
| Table | Purpose |
|-------|---------|
| `tasks` | Task records with `source` (ai / user), `depends_on`, `priority`, `labels`, `skills_needed`, `sprint_id`, `story_points` |
| `task_notes` | Per-task comments with `reply_to` for threading |
| `task_note_reactions` | Emoji reactions on task notes |
| `task_label_defs` | Per-project label definitions |

### Submissions & work
| Table | Purpose |
|-------|---------|
| `submissions` | Work submitted on tasks — `type` (text/link/file), `attachments` JSON, `ai_review`, `ai_confidence`, `ai_decision` |
| `expert_reviews` | Manual expert reviews |
| `accepted_work` | Accepted submission archive |

### Community
| Table | Purpose |
|-------|---------|
| `help_offers` | Join project — user's name, skills, message, hours_per_week |
| `project_subscriptions` | Follow button — per-user project notification opt-ins |
| `site_subscriptions` | Global site announcement opt-ins |
| `skill_endorsements` | Peer endorsements |

### AI
| Table | Purpose |
|-------|---------|
| `ai_analyses` | Cached full analysis JSON per idea |
| `ai_chat_messages` | Chat history per idea |
| `ai_operations` | Per-call log (model, tokens, latency, success) |
| `ai_jobs` | **Durable job queue with retry** — `status`, `attempts`, `max_attempts`, `next_retry_at`, `payload`, `last_error` |
| `document_suggestions` | User-submitted doc edits — `status`, `ai_verdict`, `ai_reason`, `ai_reviewed_at`, `reviewed_by`, `reviewed_at` |

### Projects & graduation
| Table | Purpose |
|-------|---------|
| `projects` | Graduated ideas (team info) |
| `project_roles` | Open positions per project |
| `project_applicants` | Applications to roles |
| `project_github_cache` | Synced repo metadata |
| `project_issues_cache`, `project_milestones_cache`, `project_milestones`, `project_contributors_cache` | GitHub cache tables |
| `project_chat_messages` | **Project group chat** |

### Workspace scaffolding (partially used)
| Table | Purpose |
|-------|---------|
| `sprints` | Sprint metadata |
| `doc_pages` | TipTap-ready hierarchical doc pages |
| `mentions` | @mention tracking across sources |

### Communication
| Table | Purpose |
|-------|---------|
| `notifications` | In-app notifications with `url`/`link_url`, `source_type`, `source_id`, `read_at` |
| `telegram_links` | User ↔ telegram chat id mapping |
| `telegram_link_tokens` | Temporary tokens for `/start <token>` flow |
| `telegram_subscribers` | Unlinked channel subscribers |

### Platform
| Table | Purpose |
|-------|---------|
| `activity_log` | Event timeline (for admin panel + AI context) |
| `logs` | Structured application logs with level + context |
| `feedback` | User feedback form with attachments |
| `invitations` | Invite-code management |
| `github_categories` | Discussion category cache |

## Background systems (`instrumentation.ts`)

Two independent loops started when Node.js runtime boots:

1. **Agent cycle** — 30s initial delay, then every 15 min. Sync + analyze + review + digest.
2. **AI job retry loop** — 60s initial delay, then every 3 min. Picks up failed-but-retryable jobs.

Both wrap in `setTimeout(..., 0)` to yield to the event loop, and check a `running` flag to prevent overlap.

Also initializes the Telegram bot (polling in dev, webhook in prod) on startup.

## Performance characteristics

- **SQLite WAL mode** — concurrent reads during writes. Most reads <1 ms.
- **Cache headers** — Ideas 5s, Projects 30s, Stats 60s, Config 3600s, Workspace no-cache
- **SWR** — 2s deduplication interval on the client
- **Dynamic imports** — tab components + markdown editor lazy-loaded
- **AI never blocks UI** — fire-and-forget + 202+polling + 3-min retry loop
- See `docs/PERFORMANCE_AUDIT.md` for the full audit

## Security model

- Admin checks: `isAdmin(email)` (server) or `/api/auth/me` (client)
- Project management checks: `canManageProject(session, ideaId)` (admin OR lead)
- Input validation at API boundaries
- SQL injection impossible via parameterized queries (better-sqlite3)
- Rate limiting on help-offer (20/hr) and anonymous-suggest endpoints
- Comment edit/delete verifies `author_login` ownership
- Cascade deletes in transactions
- `.env.local` never committed
- Admin emails NEVER hardcoded — single source `_config/ai.json`

## Build & deployment

```bash
pnpm install
pnpm build    # Must pass with 0 errors
pnpm start    # Production
pnpm dev      # Development
```

- Build output: ~47 static pages, 88.2 kB shared JS, 70+ API routes
- TypeScript strict mode enforced
- ESLint/next-lint run as part of `pnpm build`
- Zero-error build is the bar for merge
