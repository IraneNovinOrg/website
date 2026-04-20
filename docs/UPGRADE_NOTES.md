# IranENovin — Lion & Sun Upgrade Notes

This document captures the comprehensive upgrade applied to the IranENovin platform: a complete visual redesign with the Lion & Sun (Shir-o-Khorshid) Iranian theme, plus full functional wiring of features that were previously incomplete.

**Build status:** PASSING (47 static pages, 88.2 kB shared JS, 63 API routes)

**Database state:** 306 ideas + 352 comments synced from `IraneNovinOrg/ideas`

---

## Quick Test Guide

```bash
# Start dev server
npm run dev
# → http://localhost:3000

# Trigger AI analysis manually (admin only)
curl -X POST http://localhost:3000/api/ai/skills/reply-to-comment \
  -H 'Content-Type: application/json' \
  -d '{"commentId":"<comment-id>"}' \
  -b 'next-auth.session-token=<your-cookie>'

# Re-sync GitHub
curl -X POST http://localhost:3000/api/sync \
  -b 'next-auth.session-token=<your-cookie>'
```

---

## What Was Upgraded

### Phase 1 — Lion & Sun Design System Foundation

**New brand assets** (`public/brand/`):
- `lion-and-sun.svg` — Detailed emblem with lion silhouette, mane, sword, 12 sun rays, gold gradient
- `lion-and-sun-mini.svg` — Compact version for favicons and small UI
- `girih-pattern.svg` — Persian geometric tiling pattern (seamless)
- `sun-rays.svg` — Decorative sun burst with 24 rays at varying lengths

**New brand components** (`components/brand/`):
- `LionSunLogo.tsx` — Sized variants: xs/sm/md/lg/xl/2xl, full or mini, optional `animate` (float)
- `GirihPattern.tsx` — Positioned overlay with opacity and color control
- `SunMotif.tsx` — Decorative sun with optional spin animation

**New animation library** (`lib/motion.ts`):
- Framer Motion variants: `fadeUp`, `fadeIn`, `scaleIn`, `slideInLeft/Right`
- `staggerContainer(stagger, delay)` for orchestrating child animations
- `cardHover`, `buttonTap`, `float` — interactive state objects
- `pageTransition` for route changes
- `respectReducedMotion` helper

**Color palette** (`tailwind.config.ts` + `app/globals.css`):
- **Iran flag**: `iran-green` (#009B3A), `iran-deep-green` (#006B2D), `iran-bright-green`, `iran-red` (#C8102E), `iran-gold` (#D4A843), `iran-saffron` (#F4B43C)
- **Persian heritage**: `persia-turquoise` (#20B2AA), `persia-indigo` (#2E3B5C), `persia-terracotta` (#B85C38), `persia-clay`, `persia-ivory`, `persia-sand`
- All colors have light + dark mode variants via CSS custom properties

**Typography**:
- `Inter` for English body
- `Plus Jakarta Sans` for English display/hero (NEW)
- `Vazirmatn` for Farsi
- New display sizes: `text-display-xl/lg/md` with tight line-height

**CSS utilities** added to `globals.css`:
- Gradients: `gradient-iran`, `gradient-iran-gold`, `gradient-hero`, `gradient-sun`, `gradient-persia`
- Text gradients: `text-gradient-iran`, `text-gradient-gold`, `text-gradient-sunset`
- Glow: `glow-green`, `glow-gold`, `glow-red`
- Cards: `card-hover`, `card-hover-gold`
- Patterns: `pattern-girih`, `pattern-girih-subtle`
- Misc: `divider-ornament`, `display-text`, `skeleton`
- Custom shadows: `shadow-iran-green`, `shadow-iran-green-lg`, `shadow-iran-gold`, etc.
- Animations: `animate-fade-up`, `animate-float`, `animate-glow-pulse`, `animate-gold-pulse`, `animate-sun-spin`, `animate-bounce-subtle`, `animate-scale-in`

**Theme persistence** (`app/[locale]/layout.tsx`):
- Inline script before hydration sets `dark` class from localStorage to prevent FOUC
- Respects `prefers-color-scheme` media query as fallback

---

### Phase 2 — Hero, Navigation, Homepage

**Navbar** (`components/layout/Navbar.tsx`):
- `LionSunLogo` replaces the `✦` star (mini variant on mobile)
- Brand text in `text-gradient-iran` with `font-display`
- 2px gold gradient divider below the navbar
- Active nav links have a 3px gradient underline (green→gold)
- Mobile sheet has its own logo + gold divider
- Sign-in button: green with `shadow-iran-green`, hover gold glow
- Avatar ring: `ring-iran-gold/30`
- Notification badge: `bg-iran-red shadow-iran-red`
- `ThemeToggle` added next to LocaleSwitcher (NEW)

**Footer** (`components/layout/Footer.tsx`):
- Subtle Girih pattern background (4% opacity, green)
- 4-column grid: Brand / Community / Resources / Connect
- LionSunLogo + tagline + LocaleSwitcher in brand column
- Social icons (Github, Telegram, Twitter) as circular chips with gold hover
- Persian ornamental divider above copyright (3 rotated gold diamonds + lines)

**Homepage** (`app/[locale]/page.tsx` + `HomeHero.tsx` + `StatsBar.tsx`):
- New hero: 70vh, sun motif spin background, Girih pattern overlay
- Centered floating LionSunLogo (2xl) with gold drop-shadow
- Headline with "Iran" highlighted in `text-gradient-gold`
- Two CTA buttons (primary green, secondary gold outline)
- Staggered Framer Motion entrance
- Stats bar fetches real data from `/api/stats` with gold dot separators
- "Journey to Impact" section: 4 cards with numbered gold gradient circles, Girih pattern subtle background
- Final CTA banner: full-width green gradient with gold ribbons

---

### Phase 3 — Discussion UI (User's Top Priority)

**`components/comments/CommentItem.tsx`** (rewritten):
- New `RoleBadge` component: Owner (Crown + iran-gold), Lead (Shield + iran-green), Contributor (UserCircle2 + persia-turquoise), AI Assistant (LionSunLogo mini + gold-pulse ring)
- New `TreeConnector` SVG component for nested replies with curved iran-green line
- AI comments get `bg-gradient-to-r from-iran-gold/5 to-transparent border-s-2 border-iran-gold`
- Owner comments get green equivalent
- GitHub badge re-themed to iran-gold
- Edit/delete buttons ALWAYS visible on own comments (not hover-hidden)
- Delete uses inline Check/X confirm-cancel (no native confirm)
- Markdown auto-detection — uses MarkdownRenderer if content looks like markdown
- Reply button with `CornerDownRight` icon

**`components/comments/ReactionBar.tsx`** (rewritten):
- Reactions ALWAYS visible (no hover-hidden)
- Each reaction is a pill: outline-only when count=0, gold-tinted when active
- Animated emoji on click (scale + rotate via Framer Motion)
- Tooltip shows "X people reacted"
- Optimistic updates with rollback

**`components/comments/CommentInput.tsx`** (rewritten):
- Character counter (0/4000) with color escalation: muted → saffron (>3800) → red (>4000)
- Draft autosave to `localStorage` with key `draft:comment:${ideaId}`
- Restored on mount, cleared on submit
- Submit button green with `shadow-iran-green`
- Card has `focus-within:shadow-iran-green` effect

**`components/comments/CommentThread.tsx`** (rewritten):
- Per-category accent colors: general=green, ideas=gold, qa=turquoise, announcements=red
- New view filter tabs: "All" / "With AI replies" / "Most reactions" with icons
- Expand/Collapse all toggle
- Branded empty state: floating LionSunLogo (lg) + welcoming message
- Framer Motion staggered list animation

**`components/projects/tabs/DiscussionTab.tsx`** (edited, structure preserved):
- "Start a discussion" call-out card at top
- GitHub header card recolored to iran-gold palette
- Sort toggle extended: Oldest / Most Recent / Most Reactions / AI Highlights
- Edit/delete always visible
- Character counter on comment input

**`app/api/comments/route.ts`** (edited):
- AI auto-reply trigger lowered from 100→30 chars
- Now passes `{ commentId: id }` to `handleProjectEvent('new_comment', ...)`
- Skips when author is AI to prevent feedback loops

---

### Phase 4 — Workspace Tabs Polished

All 5 tabs (`components/projects/tabs/`) themed with Lion & Sun:
- **DocumentTab**: gold-bordered Edit, green Save with shadow, regenerate gold-bordered, empty state with LionSunLogo
- **FilesTab**: brand-colored type badges, dashed green dropzone, LionSunLogo empty state
- **ContributorsTab**: card-hover-gold, Crown icon for owners, brand-colored role badges, gold Help Offers card, Sun icon header
- **OverviewTab**: AI analysis in gold-bordered card with Sun icon, brand feasibility colors, gradient stats values, divider-ornament headers
- **ActivityTab**: alternating green/gold tinted timeline items, colored event icons, Girih background empty state

---

### Phase 5+6 — AI Skills Wiring

**`lib/ai/skills.ts`** (NEW, 7 skill executors):
- `runSkill<T>()` — Generic runner: loads playbook + skill markdown, calls AI, parses JSON
- `replyToComment(commentId)` — Auto-reply when comment > 30 chars
- `replyToTaskNote(noteId)` — Auto-reply on task notes
- `reviewSubmission(submissionId)` — AI review with decision/confidence/feedback
- `matchExperts(ideaId)` — Match users to projects by skills
- `suggestImprovements(ideaId)` — Periodic suggestions for stale projects
- `generateWeeklyDigest()` — Saturday community digest
- `updateDocument(ideaId)` — Refresh project doc on task completion
- 30-minute per-entity cooldown (in-memory Map)

**`lib/ai-trigger.ts`** (extended):
- Added `task_submitted` and `task_note_added` events
- New skill-dispatch block fires BEFORE the 1-hour analysis cooldown
- Wire-ups:
  - `new_comment` → `replyToComment` (5s delay)
  - `task_note_added` → `replyToTaskNote` (5s delay)
  - `task_submitted` → `reviewSubmission` (immediate)
  - `project_activated` → `matchExperts` + logs
  - `task_completed` → `updateDocument` (immediate)

**`lib/agent/cycle.ts`** (extended):
- Step 5: `suggestImprovements` for up to 2 stale active projects per cycle
- Step 6: Weekly digest on Saturdays (only if not run in last 6 days)

**Migrations** (`lib/db/index.ts`):
- New columns: `ideas.last_ai_suggestion_at`, `ideas.last_ai_document_at`
- New index: `idx_activity_log_event` on (event_type, created_at)

**New endpoint** (`app/api/ai/skills/[skillName]/route.ts`):
- POST: admin-only manual trigger of any skill
- GET: lists known skills

**Wired into routes**:
- `app/api/comments/route.ts`, `app/api/projects/[id]/comment/route.ts` → trigger `new_comment`
- `app/api/tasks/[id]/submit/route.ts` → triggers `task_submitted` and `task_completed`
- `app/api/tasks/[id]/notes/route.ts` → triggers `task_note_added`

---

### Phase 7 — Notifications Pipeline

**NEW files** in `lib/notifications/`:
- `dispatcher.ts` — `sendNotification({userId, type, title, body, linkUrl, channels})` routes to in-app + telegram + email
- `telegram.ts` — Wraps existing `notifyUser` with markdown formatting
- `email.ts` — Resend wrapper with branded HTML template (skips silently if no key)
- `templates.ts` — i18n templates (EN+FA) for 9 notification types

**Trigger points wired**:
- `comments/route.ts` → `comment_reply` to parent author
- `tasks/[id]/claim/route.ts` → `task_assigned` to project lead
- `tasks/[id]/submit/route.ts` → `task_submitted` to project lead
- `lib/ai/skills.ts` `replyToComment` → `ai_reply` to commenter

All sends are fire-and-forget (`.catch(console.error)`), never block responses.

---

### Phase 9 — Admin Panel Expansion

**Polished** `app/[locale]/admin/page.tsx` (864 lines):
- LionSunLogo header + Girih pattern overlay
- 6-tab navigation: Overview / AI Operations / Analytics / Users / Data / Logs
- Tab active state: gold underline (`bg-gradient-iran-gold`)
- Brand-themed forms, buttons, badges, status dots
- AgentConfigEditor toggle now green with shadow

**NEW sub-components** in `app/[locale]/admin/_components/`:
- `AIOperationsLog.tsx` — Filterable table with totals + cost estimate
- `SkillTriggerPanel.tsx` — Manual trigger of any of 7 skills
- `AdminCharts.tsx` — 3 Recharts: activity over 30 days, top 10 categories, AI usage by type
- `UserManagement.tsx` — Searchable users table with promote/demote, profile links

**NEW API routes** in `app/api/admin/`:
- `ai-operations/route.ts` — Filter by model/type/success/range, returns ops + aggregates
- `charts/activity/route.ts` — Daily comments/votes/tasks (zero-filled)
- `charts/categories/route.ts` — Top 10 categories by votes
- `charts/ai-usage/route.ts` — Operations grouped by type with success rate + latency
- `users/route.ts` — GET (search/sort) + PATCH (update trust_level, admin only)

**Migration**: New `ai_operations` table with 3 indexes
**Instrumentation**: `lib/ai/router.ts` now logs every AI call via `logAIOperation()`

---

### Phase 10 — UI Polish

**NEW** `components/ui/ThemeToggle.tsx`:
- Sun/Moon icon swap with Framer Motion rotate animation
- Persists to localStorage, respects prefers-color-scheme initially
- SSR-safe (no hydration mismatch)
- Added to Navbar (desktop + mobile)

**Polished** `components/CommandPalette.tsx`:
- LionSunLogo at top
- Brand-colored input border + focus ring
- Items with green hover and active states
- Group headings in gold display font
- Footer keyboard hints

**Polished** `components/feedback/FeedbackButton.tsx`:
- Floating button uses `gradient-iran-gold` with `shadow-iran-gold`
- Hover triggers `animate-bounce-subtle`
- Dialog with green border and gold accent bar
- Type pills brand-colored: Bug=red, Feature=green, General=gold
- Submit button gradient-iran with shadow

---

### Phase 11 — Profile + Members

**Polished** `app/[locale]/profile/page.tsx`:
- LionSunLogo header with gradient name
- Section cards with `card-hover bg-card border border-iran-green/15`
- Form inputs with brand focus ring
- Profile completion meter with gold gradient fill
- Trust level badges (4 tiers with brand colors)
- Reputation score in `text-gradient-iran font-display`
- LionSunLogo as avatar fallback when no image

**Polished** `app/[locale]/members/page.tsx`:
- Brand-colored filter pills
- Member cards with `card-hover-gold`
- Empty state with LionSunLogo

**NEW** `app/api/users/[id]/endorse/route.ts` + `skill_endorsements` table

---

### Cards Polish (parallel work)

**Polished** `components/ideas/IdeaCard.tsx`:
- New `getCategoryColor()` helper mapping categories to brand palette
- Trending cards get gold ribbon with Flame icon and gold-pulse glow
- Vote count in `text-gradient-iran`
- Stage badges fully brand-colored
- Help pill in gold styling with Sparkles icon

**Polished** `components/projects/ProjectCard.tsx`, `ProjectsFeed.tsx`:
- card-hover-gold with gold border
- Hammer icon for open tasks
- Gold-tinted progress bars

**Polished** `components/ideas/CategoryFilter.tsx`, `IdeasFeed.tsx`:
- Active pills bg-iran-green text-white shadow-iran-green
- Empty states with LionSunLogo + gradient title
- Pagination with brand colors

---

## Configuration Changes

**`tsconfig.json`**: added `"target": "ES2020"` to support `for-of` over Maps/Sets

**`_config/agent.json`**: thresholds were already at 5/40 votes from the previous session

**`lib/db/schema.sql`**: removed inline `idx_ideas_project_status` index that referenced a column added by migrations (caused fresh-DB bootstrap failure)

---

## Known Issues / Followups

1. `lib/ai/agent.ts` line 325 has an INSERT into `idea_comments` referencing a non-existent `is_ai_reply` column (legacy code path). The new skills system bypasses this, but it should be cleaned up.

2. `app/api/comments/route.ts` has dead-code AI reply branch behind `if (false && ...)` to prevent duplicate replies; can be removed when confident.

3. Mobile Navbar at 375px may wrap (LocaleSwitcher + ThemeToggle + hamburger). If users complain, move ThemeToggle into the mobile sheet.

4. Author → user lookup for notifications is fuzzy (matches name OR email OR github_login). Long-term, add `author_id` directly to `idea_comments`.

5. `app/[locale]/onboarding/page.tsx` had an unused LionSunLogo import that was removed during build verification.

---

## Files Modified (summary count)

- **Created**: 22+ files (brand assets, components, library files, API routes, docs)
- **Heavily modified**: 18 files (tabs, comments, navbar, footer, page.tsx, admin page, skills wiring)
- **Lightly polished**: 12+ files (cards, feeds, profile, members, etc.)
- **Schema migrations added**: 5 columns + 4 indexes + 2 new tables (ai_operations, skill_endorsements)
