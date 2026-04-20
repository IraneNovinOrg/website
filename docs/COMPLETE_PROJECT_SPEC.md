# IranENovin — Complete Project Specification

> **Purpose:** This document describes every feature, behavior, data model, API, and integration of the IranENovin platform in sufficient detail for an engineering team to build it from scratch.

---

## 1. VISION & MISSION

IranENovin is a **mission-driven collaboration operating system** for Iranians worldwide to collaborate on rebuilding Iran. It is NOT a social network, NOT a GitHub wrapper, and NOT a forum. It is a platform where:

1. **Ideas are submitted** by anyone (programer or not, in English or Farsi)
2. **The community validates** ideas through voting, discussion, and AI analysis
3. **Ideas become structured projects** with actionable tasks, teams, and timelines
4. **Volunteers claim tasks** and submit work (research, design, code, analysis)
5. **AI reviews submissions**, suggests next steps, and maintains project documents
6. **Everything is transparent** — discussions, votes, completed work, project progress

The community is distributed across the globe (Europe, North America, Australia, Middle East), includes both technical and non-technical contributors, communicates in Farsi and English, and works on everything from software to policy to infrastructure to healthcare to education reform.

### Relationship with IranAzadAbad
IranENovin **builds on** the IranAzadAbad community (https://github.com/IranAzadAbad/ideas). IranAzadAbad is where ideas originate as GitHub Discussions. IranENovin syncs those ideas, adds project management infrastructure, AI analysis, and collaboration tools. IranENovin is NOT a competitor — it is the execution layer. Full attribution to IranAzadAbad is mandatory everywhere.

---

## 2. TECH STACK

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| Framework | Next.js (App Router) | 14.2+ | TypeScript strict mode |
| Database | SQLite | via better-sqlite3 | WAL mode, local-first |
| Auth | NextAuth.js | v5 beta | GitHub + Google OAuth + email/password |
| i18n | next-intl | ^4.8 | EN + FA with full RTL |
| UI | Tailwind CSS + shadcn/ui | ^3.4 / Radix-based | Green color scheme |
| AI Models | Codex CLI + Anthropic Claude | gpt-5.4 / claude-sonnet-4 | Multi-model with fallback |
| GitHub API | @octokit/rest + @octokit/graphql | ^22 / ^9 | Discussions, repos, orgs |
| Email | Resend | ^6.9 | Transactional emails |
| Telegram | Telegraf | ^4.16 | Bot + notifications |
| Google | googleapis | ^148 | Docs API (optional) |
| Markdown | react-markdown + remark-gfm + rehype | various | Full GFM + syntax highlighting |
| Editor | @uiw/react-md-editor | latest | Split-pane editor/preview |
| Search | cmdk | ^1.1 | Command palette (Cmd+K) |
| Data Fetching | SWR | ^2.4 | Client-side caching |
| Fonts | Inter (EN) + Vazirmatn (FA) | via next/font | Farsi-optimized typography |

---

## 3. DATA MODEL

### 3.1 Ideas Table (the central entity)

Every idea IS a project. The `ideas` table contains both synced GitHub discussions and locally-submitted ideas, with project-specific columns added via migrations.

```sql
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,              -- "iae-51" (IranAzadAbad) or "ien-5" (native)
  native_id INTEGER NOT NULL,       -- GitHub discussion number
  title TEXT NOT NULL,
  body TEXT NOT NULL,               -- Full markdown content
  body_preview TEXT,                -- First 200 chars, stripped of markdown
  category TEXT,                    -- "Technology", "Education", "Health", etc.
  category_emoji TEXT,              -- GitHub emoji for category
  source TEXT NOT NULL,             -- "iranazadabad" or "iranenovin"
  source_url TEXT,                  -- Link to original GitHub discussion
  author_login TEXT,
  author_avatar TEXT,
  author_name TEXT,
  author_profile_url TEXT,
  github_vote_count INTEGER DEFAULT 0,  -- Upvotes from GitHub
  comment_count INTEGER DEFAULT 0,      -- Top-level comment count
  stage TEXT DEFAULT 'submitted',       -- Pipeline: submitted → gaining → validated → team-forming → active-project → launched
  graduated_to TEXT,                    -- Link if idea graduated to project

  -- Project-specific columns (added via migrations)
  project_status TEXT DEFAULT 'idea',   -- "idea" | "active" | "completed" | "needs-contributors" | "rejected"
  project_content TEXT DEFAULT '',      -- AI-generated project document (markdown)
  project_docs TEXT DEFAULT '[]',       -- JSON array of {id, title, body, authorName, createdAt}
  project_resources TEXT DEFAULT '[]',  -- JSON array of {id, title, url, type, description, authorName}
  project_leads TEXT DEFAULT '[]',      -- JSON array of lead user IDs
  project_doc_meta TEXT DEFAULT '{}',   -- {lastEditedBy, lastEditedAt, version}
  ai_open_questions TEXT DEFAULT '[]',  -- JSON array from AI analysis
  ai_analyzed_at TEXT,                  -- Timestamp of last AI analysis
  google_doc_url TEXT,                  -- Embedded Google Doc URL (if set)
  github_repo_url TEXT,                 -- Auto-created GitHub repo URL
  teaser_image_url TEXT,               -- Project hero image
  rejection_reason TEXT,               -- Reason if rejected by admin
  similar_idea_id TEXT,                -- Link to similar idea (for rejections)

  created_at TEXT,
  updated_at TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);
```

### 3.2 Comments Table

```sql
CREATE TABLE idea_comments (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  body TEXT NOT NULL,               -- Markdown content
  author_login TEXT,
  author_avatar TEXT,
  author_id TEXT,                   -- Local user ID (if registered)
  created_at TEXT,
  source TEXT DEFAULT 'github',     -- "github" (synced) or "local" (posted on platform)
  reply_to TEXT,                    -- Parent comment ID for threading (NULL = top-level)
  edited_at TEXT,                   -- Timestamp if edited
  synced_at TEXT DEFAULT (datetime('now'))
);
```

### 3.3 Tasks Table

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,         -- 150-250 words with structured brief
  skills_needed TEXT DEFAULT '[]',   -- JSON array: ["research", "design", "technical"]
  time_estimate TEXT,                -- "~2 hours"
  output_type TEXT,                  -- "document" | "code" | "design" | "data" | "analysis"
  status TEXT DEFAULT 'open',        -- "open" | "proposed" | "claimed" | "in-progress" | "submitted" | "accepted" | "changes-requested"
  assignee_id TEXT,
  assignee_name TEXT,
  claimed_at TEXT,
  due_date TEXT,                     -- Auto-calculated from time estimate
  source TEXT DEFAULT 'ai',          -- "ai" | "user" | "lead"
  parent_task_id TEXT,
  task_order INTEGER DEFAULT 0,
  depends_on TEXT DEFAULT '[]',      -- JSON array of task IDs
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 3.4 Task Notes (comments on tasks)

```sql
CREATE TABLE task_notes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 3.5 Submissions (work submitted for tasks)

```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT,
  type TEXT NOT NULL,                -- "link" | "document" | "inline"
  content TEXT NOT NULL,
  ai_review TEXT,                    -- JSON: AI evaluation
  status TEXT DEFAULT 'pending',     -- "pending" | "accepted" | "changes-requested"
  accepted_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 3.6 Users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  github_login TEXT,
  bio TEXT,
  skills TEXT DEFAULT '[]',          -- JSON array
  location TEXT,
  timezone TEXT,
  languages TEXT DEFAULT '[]',
  hours_per_week TEXT,
  provider TEXT DEFAULT 'email',     -- "email" | "github" | "google"
  password_hash TEXT,
  trust_level INTEGER DEFAULT 1,     -- 1=New, 2=Contributor, 3=Reviewer, 4=Lead
  profile_completed INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 3.7 Other Tables

```sql
-- Votes (local upvotes, GitHub votes are on the ideas table)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote_reason TEXT,                   -- Optional "why do you support this?"
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(idea_id, user_id)
);

-- Comment reactions
CREATE TABLE comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,        -- "upvote" | "heart" | "rocket" | "eyes" | "party"
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(comment_id, user_id, reaction_type)
);

-- Help offers
CREATE TABLE help_offers (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  skills TEXT DEFAULT '[]',
  message TEXT,
  hours_per_week TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI analyses
CREATE TABLE ai_analyses (
  idea_id TEXT PRIMARY KEY,
  feasibility TEXT,                   -- "green" | "yellow" | "orange" | "red"
  feasibility_explanation TEXT,
  summary TEXT,
  full_analysis TEXT,                 -- Complete JSON of the analysis
  model_used TEXT,
  generated_at TEXT DEFAULT (datetime('now'))
);

-- Activity log
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  idea_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feedback
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  user_name TEXT,
  type TEXT DEFAULT 'general',        -- "bug" | "feature" | "general"
  message TEXT NOT NULL,
  url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Structured logs
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,                -- "info" | "warn" | "error" | "critical"
  message TEXT NOT NULL,
  context TEXT,
  actor_name TEXT,
  idea_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. PAGES & ROUTES

### 4.1 Public Pages

| Route | Description |
|-------|-------------|
| `/[locale]` | Homepage: hero, stats, pipeline visualization, ideas feed, onboarding banner |
| `/[locale]/projects` | Projects listing (unified ideas feed, all ideas are projects) |
| `/[locale]/projects/[id]` | **THE CORE PAGE** — 7-tab project workspace |
| `/[locale]/submit` | Submit new idea form (auth required) |
| `/[locale]/members` | Community members directory |
| `/[locale]/invite` | Invite system (developer + non-programmer paths) |
| `/[locale]/join` | Onboarding page for newcomers |
| `/[locale]/profile` | User profile with completion percentage |
| `/[locale]/tasks/[id]` | Individual task workspace with submission form |
| `/[locale]/admin` | Admin panel (admin-only, email whitelist) |

### 4.2 The Project Page (7 Tabs)

This is the central feature. Every idea at `/projects/{id}` has these tabs:

**Tab 1: Overview**
- Project hero image (or gradient placeholder)
- Full description (Markdown rendered)
- AI Analysis card: feasibility badge (green/yellow/orange/red) with explanation, summary, project scope, key insights
- Stats grid: members, tasks, comments, files, estimated hours
- Progress bar: X/Y tasks completed with percentage
- "How to Contribute" 3-step guide
- Open tasks preview (top 3)
- Vote reasons (why people support this)
- Full GitHub Discussion at bottom (threaded, with replies)
- Admin toolbar: Activate, Analyze, Reject buttons

**Tab 2: Discussion**
- Unified chronological thread of ALL comments (GitHub + local + AI)
- GitHub Discussions-style cards with color-coded left borders (indigo=GitHub, emerald=local, purple=AI)
- Threaded replies up to 3 levels with indentation
- Author badges: "From GitHub", "Author", "AI Assistant"
- Emoji reactions per comment (👍 ❤️ 🚀 👀 🎉) with toggle
- Sort toggle: Oldest / Newest
- Comment input with Write/Preview toggle, user avatar, category selector
- Edit/delete own comments
- Reply button on every comment (including GitHub-synced ones)
- AI auto-replies to substantial comments (>30 chars, non-blocking)

**Tab 3: Tasks**
- Board view (Kanban: Open → In Progress → In Review → Done) or List view toggle
- Task cards: title, priority dot, assignee, skill badges, time estimate
- Create task form: title, description (min 50 chars), time estimate, skill type
- Task detail view:
  - Full description, status/priority badges
  - "Take This Task" button (claims task, sets due date)
  - "Release Task" button (unclaim)
  - "Submit for Review" button with submission form (textarea, min 200 chars)
  - Submissions list with AI review status
  - Task comments/notes with AI replies
  - Admin: edit, delete, mark complete
- Community-proposed tasks shown with badge

**Tab 4: Document**
- Rich Markdown editor (@uiw/react-md-editor) with toolbar + live preview
- OR Google Docs embed (if admin sets a Google Doc URL)
- Admin: "Regenerate with AI" button
- Version tracking (last edited by, date, version number)
- Non-admins see read-only rendered Markdown

**Tab 5: Files & Resources**
- Upload files (images, PDFs up to 2MB)
- Link external resources (URLs, GitHub repos, Google Docs, Figma)
- Inline documents (Markdown)
- Type icons for each resource

**Tab 6: Contributors**
- Three roles: Owner (gold Crown), Lead (blue Shield), Contributor (gray User)
- Admin can promote/demote leads
- Members sorted: owner → leads → contributors

**Tab 7: Activity**
- Timeline of all events with timestamps and actor names

### 4.3 API Routes (47 total)

**Ideas:**
- `GET /api/ideas` — paginated, filtered, sorted. Batch queries for votes/help/feasibility. Returns 19 columns (excludes body for performance).
- `GET /api/ideas/[id]` — single idea with comments
- `POST /api/ideas` — create idea (posts to GitHub + SQLite)
- `POST /api/ideas/[id]/vote` — toggle local upvote, optional reason
- `GET /api/ideas/stage-counts` — pipeline stage counts (cached 60s)

**Projects:**
- `GET /api/projects` — active projects with task counts
- `GET /api/projects/[id]` — full project data (idea, tasks, comments, analysis, contributors, docs, resources, activity)
- `PATCH /api/projects/[id]` — update project fields (admin controls)
- `POST /api/projects/[id]/comment` — add comment with AI auto-reply
- `PUT /api/projects/[id]/content` — update project document
- `POST /api/projects/[id]/generate-doc` — AI generates project document (admin)
- `GET/POST /api/projects/[id]/tasks` — list/create tasks

**Tasks:**
- `POST /api/tasks/[id]/claim` — claim a task (sets assignee + due date)
- `POST /api/tasks/[id]/unclaim` — release a claimed task
- `POST /api/tasks/[id]/submit` — submit work (triggers AI review)
- `POST /api/tasks/[id]/notes` — add comment on task (triggers AI reply)

**Comments:**
- `POST /api/comments` — create comment with threading (reply_to)
- `PUT /api/comments` — edit own comment (sets edited_at)
- `DELETE /api/comments` — delete own comment (admin can delete any)
- `POST/GET /api/comments/reactions` — toggle/get emoji reactions

**Admin:**
- `POST /api/admin/ai-action` — actions: sync, analyze, activate, reject-idea, delete-task, complete-task, edit-task, create-repo, set-trust-level
- `GET /api/admin/stats` — detailed platform statistics
- `GET/PUT /api/admin/config` — read/write agent.json
- `GET /api/admin/logs` — structured logs with level filter

**Auth:** NextAuth handlers + email registration
**Other:** notifications, feedback, stats, categories, sync, members, profile, invite, telegram, upload-image

---

## 5. AI AGENT SYSTEM

### 5.1 Architecture

```
Event → AI Trigger → Agent Orchestrator → Skill Selection → LLM Call → Action Execution → SQLite
```

### 5.2 Models (configured in _config/ai.json)

- **Primary:** Codex CLI (gpt-5.4) via ChatGPT Pro subscription — no API key needed
- **Fallback:** Claude Sonnet 4 via Anthropic API
- **Optional:** ChatGPT API, Gemini (can be enabled)

The router tries models in priority order with automatic fallback on failure.

### 5.3 Background Agent Cycle (every 15 minutes)

1. **GitHub Sync** — fetch ideas + comments + replies from IranAzadAbad and IranENovin repos via GraphQL. Includes reply threading and reaction counts. Full sync every 10th cycle.
2. **Auto-Activate** — ideas with 5+ votes get `project_status = 'active'` (threshold configurable)
3. **Analyze** — top 2 unanalyzed ideas get full AI analysis + task generation. Yields to event loop between each.
4. **Review** — up to 3 pending submissions get AI review

All operations are non-blocking (async exec, setImmediate yields).

### 5.4 Event Triggers

| Event | Trigger | AI Action |
|-------|---------|-----------|
| Comment posted (>30 chars) | API route | AI auto-reply as threaded comment |
| Task note posted (>30 chars) | API route | AI reply to task discussion |
| Task claimed | API route | Activity logged |
| Task submitted | API route | AI reviews submission quality |
| Project activated | Admin action | Full analysis + tasks + document |

### 5.5 Playbooks (7 prompt templates in _config/ai-playbooks/)

1. **system-prompt.md** — Core personality: diaspora-focused analyst, honest about feasibility
2. **analyze-idea.md** — Produces: summary, feasibility, scope, 3-5 tasks (150-250 word briefs), risks, questions, insights
3. **review-submission.md** — Evaluates: accept/improve/reject with constructive feedback
4. **suggest-next-steps.md** — Generates follow-up tasks from completed work
5. **generate-project-doc.md** — Creates 9-section project document
6. **chat-rules.md** — Chat co-pilot behavior
7. **expert-match.md** — Skill-based expert matching

### 5.6 Skills (6 action-capable skills in _config/ai-skills/)

Each skill has YAML frontmatter (trigger, model, conditions) and executes specific actions:
- reply-to-comment, reply-to-task-note, create-tasks, review-submission, update-document, suggest-improvements

### 5.7 Quality Validation

Post-generation, every AI analysis is validated:
- Time estimates capped at 3 hours per task
- Deliverable word counts capped at 500 words
- Missing fields (keyInsights, projectScope) auto-filled

---

## 6. PERMISSION SYSTEM

### Trust Levels (Discourse-inspired)

| Level | Name | Can Do | Auto-Promotion |
|-------|------|--------|----------------|
| 1 | New Member | Submit ideas, vote, comment | Default for all users |
| 2 | Contributor | + Claim tasks, propose tasks | After 3 comments or 1 help offer |
| 3 | Reviewer | + Review submissions, edit docs | After 5 completed tasks |
| 4 | Lead | + Manage projects, assign leads | Admin-promoted only |

### Admin Access

Admin emails configured in `_config/ai.json` under `adminEmails`. Admins can:
- Activate/reject projects
- Trigger AI analysis (force)
- Create GitHub repos
- Set user trust levels
- Configure AI agent settings
- View structured logs
- Chat with AI about any project

---

## 7. GITHUB INTEGRATION

### Sync (every 15 minutes + manual trigger)

Uses GitHub GraphQL API to fetch from `IranAzadAbad/ideas` and `IraneNovinOrg/ideas`:
- Discussion title, body, author, votes (upvoteCount + reactions)
- Comments with `replies(first: 20)` — stores threading via `reply_to`
- Category and emoji
- Incremental (only fetches updated since last sync) with periodic full refresh

### Repo Creation (admin action)

Creates repos in IraneNovinOrg:
- Auto-generated README with project description, task list, contributing guide
- Topics: iranenovin, community-project, category
- URL stored in project data, shown on project page
- Requires GitHub token with `administration:write` scope

### Idea Submission

When a user submits an idea:
1. Created as a GitHub Discussion in IraneNovinOrg/ideas
2. Cross-posted to IranAzadAbad
3. Stored in local SQLite
4. Appears in unified feed

---

## 8. GOOGLE DOCS INTEGRATION (Optional)

When configured with a Google Cloud service account:
- Auto-creates a Google Doc per project when AI analysis runs
- AI writes the project document directly to Google Docs
- Doc embedded in the Document tab via iframe
- Admin can set/change/remove Google Doc URL

Requires: `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_PRIVATE_KEY` env vars.

---

## 9. NOTIFICATIONS

### In-App
- `notifications` table stores per-user notifications
- Types: ai_reply, task_claimed, submission_reviewed
- Notification bell in navbar with unread count badge
- Mark as read via PUT /api/notifications

### Telegram
- Critical errors → Telegram channel notification (via bot API)
- User feedback → Telegram channel notification
- Requires: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` env vars

### Email (via Resend)
- Invite emails
- Anonymous suggestion confirmations

---

## 10. FRONTEND UX REQUIREMENTS

### Performance
- Homepage loads in <1s (batch queries, 88kB shared JS)
- Project page: no-cache API response for instant updates after actions
- SWR on client with 2s deduplication, forced revalidation on user actions
- Loading skeletons on initial load only (not on refetch — prevents tab reset)
- Dynamic imports for tab components (code splitting)
- Task page bundle: <140kB

### Responsiveness
- Mobile-first responsive design with Tailwind (sm:, md:, lg:)
- Feedback button: max-width calc for small screens
- Cards: min-w-0 (no forced horizontal scroll)
- Dialogs: full-width on mobile

### RTL Support
- `dir="rtl"` for Farsi locale
- Logical properties (start/end instead of left/right)
- Vazirmatn font with increased line-height for Farsi
- Both 648-line translation files (en.json + fa.json) must be complete and identical in structure

### Error Handling
- Error boundaries (error.tsx) for graceful crash recovery
- Toast notifications (sonner) on all user actions
- No silent catch blocks — all errors reported
- Structured logging to SQLite + Telegram for critical errors

### Instant Feedback
- Toast on every action (claim, comment, vote, submit)
- Optimistic updates where possible
- Loading states (spinners, disabled buttons) during async operations
- Tab state preserved during data refresh (no unmount on SWR revalidation)

---

## 11. ADMIN PANEL

Located at `/admin` (email whitelist access):

1. **Platform Stats** — 12 stat cards (ideas analyzed/unanalyzed, tasks open/completed, users, comments, hours)
2. **AI Control** — Sync Now, Analyze single idea, Bulk Analyze All (with progress), system status
3. **Agent Configuration** — Toggle and number inputs for all agent.json settings, save button
4. **AI Co-Pilot** — Project selector + chat interface with quick actions
5. **Data Management** — SQLite table row counts, AI connection test
6. **Logs** — Structured log viewer with level filter (All/Info/Warn/Error/Critical), auto-refresh

---

## 12. CONFIGURATION FILES

| File | Format | Purpose | Editable By |
|------|--------|---------|-------------|
| `_config/ai.json` | JSON | AI models, fallback chain, admin emails, task routing | Developer |
| `_config/agent.json` | JSON | Agent cycle period, thresholds, triggers, skills | Admin panel |
| `_config/ai-playbooks/*.md` | Markdown | AI prompt templates (7 files) | Developer |
| `_config/ai-skills/*.md` | Markdown+YAML | Agent skill definitions (6 files) | Developer |
| `.env.local` | Key=Value | Secrets, API keys, service accounts | Server admin |

---

## 13. DEPLOYMENT

### Local Development
```bash
pnpm install
pnpm dev          # http://localhost:3000
```

### Production Build
```bash
pnpm build        # Must pass with 0 errors
```

### Environment Variables (Required)
```
NEXTAUTH_SECRET=<random-32-chars>
NEXTAUTH_URL=https://iranenovin.com
GITHUB_BOT_TOKEN=<github-pat-with-discussions-repo-scope>
GITHUB_CLIENT_ID=<github-oauth-app>
GITHUB_CLIENT_SECRET=<github-oauth-secret>
```

### Environment Variables (Optional)
```
ANTHROPIC_API_KEY=<for-claude-fallback>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<for-google-docs>
GOOGLE_SERVICE_PRIVATE_KEY=<for-google-docs>
GOOGLE_DOCS_FOLDER_ID=<shared-drive-folder>
TELEGRAM_BOT_TOKEN=<for-telegram-bot>
TELEGRAM_CHANNEL_ID=<for-admin-notifications>
```

### Hosting
- Current: Cloudflare Tunnel from local machine
- Recommended: Vercel (zero-config for Next.js) or any Node.js host
- Database: SQLite file in `_data/` directory (must be persistent across deploys)

---

## 14. TESTING

### Unit Tests
- Vitest configuration
- Test files in `__tests__/` directory

### E2E Tests
- Playwright configuration
- Test critical flows: idea submission, voting, task claiming, commenting

### Build Verification
- `pnpm build` must pass with 0 errors
- All 35+ pages must generate successfully
- No unused variables or imports (ESLint strict)

---

## 15. KEY BEHAVIORS TO GET RIGHT

1. **Vote counts must match** between the project card (homepage) and the project page. Formula: `ideas.github_vote_count + COUNT(votes WHERE idea_id = X)`.

2. **Tab state must persist** during data refresh. Do NOT show loading skeleton when SWR refetches — only on initial load when data is undefined.

3. **Comments must appear instantly** after posting. No server-side caching on the project detail API.

4. **AI must never block HTTP requests.** All AI calls use async exec (not execSync) and fire-and-forget patterns with dynamic imports.

5. **GitHub sync must capture replies.** The GraphQL query must include `replies(first: 20)` on each comment, stored with `reply_to` linking to parent.

6. **Trust levels should NOT block basic actions** by default. Level 1 users can claim tasks and propose tasks. Higher levels unlock review and management.

7. **Every button must do something.** No dead buttons, no silent failures. All actions show toast feedback and refresh data.

8. **Bilingual from day 1.** Every UI string must be in both en.json and fa.json. Test RTL layout with native Farsi speakers.
