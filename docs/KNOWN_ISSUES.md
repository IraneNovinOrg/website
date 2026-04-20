# IranENovin — Known Issues & Pending Work

_Last updated: 2026-04-19 (v0.4.0)_

## Critical (P0) — would block public launch

_None currently open._ The template-placeholder bug, AI blocking, and notification delivery issues that were P0 in 0.3.x have all been fixed in 0.4.0.

## High (P1) — should fix before launch

1. **Admin UI to add/remove other admins**
   Backend ready (`lib/admin.ts → addAdmin/removeAdmin`), but no form in `/admin`. Admins currently have to edit `_config/ai.json` manually.
   _Effort: ~1 hour. Just a form + a POST route wrapping the existing functions._

2. **Site-wide announcement composer UI**
   `site_subscriptions` table + `site_announcement` template exist; no way for admins to send one. Useful for launch + new-feature announcements.
   _Effort: ~2 hours. Admin panel form + POST route + fanout._

3. **Email-channel opt-in UI**
   Dispatcher fires emails when `RESEND_API_KEY` is set and user opted in (`notification_prefs.email = true`), but the opt-in toggle isn't surfaced in the profile page. Default is OFF.
   _Effort: ~30 min. Checkbox in profile form._

## Medium (P2) — nice to have

1. **Real-time multi-user document editing** (Notion/Google-Docs-style)
   Would require Y.js/CRDT backend + WebSocket. The current suggestion flow covers asynchronous collaboration well; real-time is out of scope for v1.
   _Effort: 1-2 weeks. Defer unless it becomes a usage blocker._

2. **Word-level diff in document suggestions**
   Current diff is line-level (added lines green, removed struck-through red). Word-level diff would match Google Docs more closely and handle small typo fixes more precisely.
   _Effort: ~3 hours. Add `diff` or `diff-match-patch` library; update `renderDiff()` in `DocumentTab.tsx`._

3. **Notification preferences page**
   Users can technically set `notification_prefs` JSON fields (`telegram`, `email`, `mutedTypes`) but there's no UI. Dispatcher respects them if set.
   _Effort: ~2 hours. Form section in profile page._

4. **Hero logo image size**
   The `iranenovin_no_bg1_white.png` is served raw (~800 KB). Move to `next/image` with static import for auto-sizing.
   _Effort: ~15 min._

5. **Google sign-in "risky app" warning**
   Not a code issue — Google Cloud Console OAuth Consent Screen is unpublished. See `docs/GOOGLE_SIGNIN_SETUP.md`. Needs admin action, not a code change. Only non-sensitive scopes (`openid email profile`) so no Google verification required.
   _Effort: user action in Google Cloud Console — 10 min._

6. **Admin panel AI operations table pagination**
   Currently returns the last 100 rows. On busy days this could miss entries.
   _Effort: ~1 hour._

7. **Mobile polish pass**
   Layout has been tested but hasn't had a dedicated mobile polish pass on every page. Navbar wrapping at 375px needs a final check.
   _Effort: ~2 hours._

## Low (P3) — eventual

1. **Milestone UI** — schema has `sprints` + `project_milestones_cache`, no UI yet.
2. **Task dependency visualization** — `tasks.depends_on` column exists as JSON array; no graph view.
3. **Profile contribution history** — public profile doesn't show a contribution timeline.
4. **Sprint UI** — `sprints` table scaffolded, no UI.
5. **Multi-page project docs** — `doc_pages` table scaffolded (TipTap content tree), no UI.

## Fixed in 0.4.0

- ✅ AI template placeholders stored as real analysis (multi-layer fix)
- ✅ "Sorry, I couldn't process that" chat error (202 pattern reverted to synchronous for chat)
- ✅ Task comment view jumping to tasks list (no more `setSelectedTask(null)` in render)
- ✅ Admins didn't get doc-suggestion notifications (`includeAdmins: true` added to fanout)
- ✅ Profile red dot never cleared (now respects `profileCompleteness >= 40%`)
- ✅ "project.chat" raw text in tab (added i18n key)
- ✅ RTL trending ribbon overlapped IAB badge (now on opposite corner with `rtl:rotate-45`)
- ✅ AI replies showed "NULL" / "tokens used 3,016" (sanitizer + cleanup script)
- ✅ AI chat leaked system prompt (multi-pattern sanitization)
- ✅ "Try the new workspace" cutover banner (removed)
- ✅ Top search bar / Cmd+K (removed per user request)
- ✅ Hardcoded admin emails across 20+ files (centralized via `lib/admin.ts`)
- ✅ Workspace section (deleted)
- ✅ AI transient failures silently dropping work (job queue with retry + exponential backoff)

## Fixed in 0.3.0

- ✅ Old platform tabs ported (OverviewTab, TasksTab, DocumentTab, ContributorsTab, ActivityTab, FilesTab, ProjectWorkspace)
- ✅ `canManageProject` / `isProjectLead` helpers + member removal wired for leads
- ✅ `buildProjectContext` aggregator used in admin-chat
- ✅ "Follow project" subscription button + fanout
- ✅ Home link + JumpToTop

## Known limitations (not bugs, just scope)

- **Chat polls every 10s** instead of using WebSocket/SSE. Good enough for volunteer project usage (~dozens of messages/day).
- **Notifications poll every 60s** in the navbar. Instant delivery would require SSE/push.
- **AI tasks cap at 8** is intentional — keeps the board manageable for volunteers with limited time.
- **Max 3 retries** for AI jobs. After that, a job is marked permanently failed and needs admin intervention.
- **5 MB image upload limit**. Images go to the GitHub repo as raw files.
