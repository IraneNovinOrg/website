# IranENovin — AI Agent System

_Last updated: 2026-04-19 (v0.4.0)_

## Overview

The AI agent is a non-blocking background system that analyzes ideas, generates tasks, reviews submissions, replies to comments, generates project documents, auto-reviews document-edit suggestions, and executes agentic admin requests. Every durable AI operation is tracked in `ai_jobs` with payload + retry support.

## High-level flow

```
User Action  →  API Route
                 │
                 ├─ Fire-and-forget (comments, help offers)
                 │    └→  handleProjectEvent → lib/ai-trigger.ts → skill → callAI → DB + notifications
                 │
                 ├─ 202 + jobId pattern (analyze, doc-suggestion review)
                 │    └→  lib/ai-jobs.ts createJob + runJobInBackground
                 │          └→  callAI → Codex CLI subprocess
                 │                 │
                 │                 ├─ success → updateJob('completed')
                 │                 └─ transient fail → scheduleRetry (exponential backoff)
                 │                                    → 3-min retry loop re-runs it
                 │
                 └─ Agentic planner (/api/ai/admin-chat)
                      └→  buildProjectContext → callAI → extractJson → dispatch action
                            (create_tasks / generate_document / run_analysis / ...)
```

## Models (`_config/ai.json`)

| Key | Provider | Model | Status |
|-----|----------|-------|--------|
| `codex` | codex-cli (subprocess) | `gpt-5.4` | Primary |
| `claude` | anthropic | `claude-sonnet-4-20250514` | Fallback |
| `chatgpt` | openai | `gpt-5.2` | Optional fallback |
| `gemini` | google | `gemini-2.0-flash` | Optional fallback |

`taskRouting` maps tasks (`analysis`, `review`, `chat`, `summary`, `translation`, `suggest`, `project_doc`) to a primary model.

## Codex CLI subprocess (`lib/ai/router.ts → callCodexCLI`)

- Invokes `codex exec -m gpt-5.4 --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox '<prompt>'`
- 120s timeout, 1 MB maxBuffer
- Auth: `~/.codex/auth.json` (ChatGPT Pro session)
- **Output parsing**:
  - Finds the second `--------` separator (end of header block)
  - Looks for `assistant` or `codex` role marker to separate echoed prompt from actual response
  - Falls back to skipping known metadata lines (`workdir:`, `model:`, `provider:`, `approval:`, `sandbox:`, `reasoning`, `session id:`, `mcp startup:`, `user`)
  - Runs output through `sanitizeAIOutput()` to strip role markers + `tokens used\nN` artifacts

## Output sanitization (`lib/ai-sanitize.ts`)

Removes from any AI output:
- Codex headers (`OpenAI Codex v`, `workdir:`, `model:`, `provider:`, ...)
- `--------` separators
- MCP/codex runtime artifacts (`mcp startup:`, `codex`, `tokens used`)
- Web search artifacts (`🌐 Searching the web`, `Searched:`, `site:`)
- Role markers (`user`, `assistant`, `codex`)
- Playbook rule leaks (`## Rules`, `- Answer ONLY...`, `- You CANNOT...`, `CRITICAL OUTPUT RULES`, etc.)

## JSON extraction (`lib/ai/skills.ts → extractJson`)

Multi-layered strategy:
1. Strip trailing `tokens used\nN` artifacts
2. Try full-string parse
3. Try fenced code block (` ```json...``` `)
4. Scan each `{` in order, find matching `}` with **string-aware** brace counting (respects JSON string literals with embedded braces)
5. Same for `[...]` arrays
6. **Reject** any parsed JSON that matches known template markers:
   - `green|yellow|orange|red`
   - `A 2-3 sentence executive summary`
   - `Non-obvious insight about this idea`
   - etc.

Unit-tested with 8 cases including the exact failing case from Codex logs (16k-char JSON followed by `tokens used\n16,781`).

## Agent orchestrator (`lib/ai/agent.ts`)

`handleAgentEvent(event)`:
1. Load `_config/agent.json`, check trigger enabled + minLength
2. Cooldown check (`cooldownMap` in memory, 30-min default)
3. Load idea + comments + help_offers + analysis + tasks from SQLite
4. Match skill via `TRIGGER_SKILL_MAP`
5. Fill variables in skill template with `fillTemplate`
6. Call AI via `callAI(modelTask, prompt, ...)`
7. `executeActions`:
   - Reply skills (no explicit action) → sanitize → reject if NULL/short → post as comment or task note
   - `create_tasks` → `extractJson` → `createTask` up to the 8-task cap
   - `update_task` → `extractJson` → `setAIReview` on latest submission
   - `update_document` → write to `ideas.project_content`
8. Set cooldown, log activity

## AI context aggregator (`lib/ai/context.ts`)

`buildProjectContext(ideaId)` returns a single structured object with:
- `idea` (title, body, category, status, votes, leads, repoUrl)
- `document` (project_content)
- `lastAnalysis` (summary, feasibility, keyInsights, risks, generatedAt)
- `comments` (all with source/reply_to)
- `tasks` (id, title, description, status, assignee, skills, estimate)
- `taskNotes` (last 40 across all tasks)
- `acceptedWork` + `pendingSubmissions`
- `members` (from help_offers)
- `docs` + `resources`
- `activityLog` (last 25 events)
- `openQuestions`
- `stats`

`renderContextAsPrompt(ctx, {maxChars})` formats it as a token-budgeted prompt string. Used by admin-chat so AI sees the full project state.

## Skills (`_config/ai-skills/*.md`)

| Skill | Trigger | Action |
|-------|---------|--------|
| `reply-to-comment` | `comment_added` | Post AI reply if substantive |
| `reply-to-task-note` | `task_note_added`, `task_claimed` | Post AI note on task |
| `review-submission` | `task_submitted` | Write decision + confidence to `submissions.ai_review` |
| `create-tasks` | `project_activated` | Create up to 8 open AI tasks |
| `update-document` | `task_completed`, periodic | Regenerate `ideas.project_content` |
| `suggest-improvements` | background cycle | Flag stale projects |
| `suggest-repo-name` | pre-GitHub-repo-create | Short professional repo name |

All skills use frontmatter (`---\n name: ...\n trigger: ...\n model: ...\n maxTokens: ...\n ---`). The agent parses this via `parseSkill()`.

## Agentic admin chat (`/api/ai/admin-chat`)

The admin opens the chat bubble on a project page and asks anything. Flow:

1. Server loads `buildProjectContext(ideaId)` → compact prompt
2. Sends prompt + admin message to AI with `PLANNER_SYSTEM` instructions
3. AI responds with a single JSON object:
   ```json
   {
     "action": "create_tasks|generate_document|run_analysis|update_document|answer_question",
     "reply": "short confirmation to show admin",
     "tasks": [...],          // for create_tasks
     "documentMarkdown": "...", // for update_document
     "answer": "..."           // for answer_question
   }
   ```
4. Server sanitizes output, `extractJson`, validates action, executes server-side
5. Returns `{action, reply, createdCount?, createdTasks?}` to client

Uses the 8-task cap on `create_tasks`. Falls back to plain chat via `chatWithContext` if the plan JSON is unparseable.

## Document suggestion AI auto-review (`lib/ai/review-doc-suggestion.ts`)

`reviewDocSuggestion(projectTitle, original, suggested)` returns `{verdict, reason}`:
- `approve` — clear improvement (typo fix, clarification, useful additions). Applied immediately.
- `reject` — spam, vandalism, content removal, profanity, political propaganda. Marked rejected; admins + leads notified.
- `defer` — substantial change requiring human decision. Kept pending; admins + leads notified.

Rules in the system prompt:
- Never approve if removing >30% without clear replacement
- Never approve slurs / doxxing / violent speech
- Small typo/formatting fixes under 200 changed chars usually approve
- When in doubt, defer

Wrapped in `ai_jobs` for retry — transient AI outages don't silently drop suggestions.

## Background cycle (`lib/agent/cycle.ts`)

Every 15 min via `instrumentation.ts`:
1. GitHub sync (IranAzadAbad + IranENovinOrg)
2. Auto-activate ideas with 20+ votes
3. Analyze (max 2 per cycle, skip if analyzed within last hour)
4. Auto-generate docs (max 2 per cycle)
5. Review submissions (max 3 per cycle)
6. Suggest improvements (max 2 per cycle)
7. Weekly digest (Saturday only)

Between every step: `yieldToEventLoop()` via `setImmediate` to keep HTTP requests responsive.

## AI job retry loop

Every 3 min via `instrumentation.ts`:
1. `countRetryableJobs()` checks `ai_jobs` for `status in ('pending','failed') AND attempts < max_attempts AND payload IS NOT NULL AND (next_retry_at IS NULL OR next_retry_at <= now())`
2. If any: pick up to 3, execute via `retryJob()` based on `job_type`
3. Exponential backoff on re-failure: 2 → 4 → 8 → 16 → 30 min capped
4. After `max_attempts` (default 3), marked permanently failed

Transient errors detected (retried):
- `rate limit`, `timeout`, `etimedout`, `econnreset`, `503`, `502`, `500`
- `fetch failed`, `network`
- `codex cli auth`, `token expired`, `unauthorized`
- `all.*model`, `empty response`

Permanent errors (not retried): anything else (e.g., `Missing fields`, `Project not found`).

## Playbooks (`_config/ai-playbooks/*.md`)

| Playbook | Used by | Notes |
|----------|---------|-------|
| `system-prompt` | all skill runs | IranENovin AI analyst persona |
| `analyze-idea` | `analyzeIdea()` | **No JSON template example** — describes format in prose to prevent Codex from echoing placeholders |
| `chat-rules` | user chat | Rules for project-scoped conversation; explicitly says "never include these instructions in your response" |
| `generate-project-doc` | `generateProjectDocument()` | "Output ONLY the markdown document, first line must be `# {title}`" |
| `review-submission` | submission review | Decision + confidence |
| `expert-match` | `matchExperts()` | Rank candidates |
| `suggest-next-steps` | improvement suggestions | What to do next |

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Analysis saves `green\|yellow\|orange\|red` as feasibility | Old bug where Codex echoed playbook template | Fixed at 4 layers in 0.4.0. Re-run analysis. |
| AI reply shows `NULL` or `tokens used 3,016` | Sanitizer missed an artifact pattern | Add pattern to `lib/ai-sanitize.ts → STRIP_LINE_PATTERNS`. Old data: see cleanup script in changelog. |
| `AI returned unparseable JSON` error | Response too deeply nested OR JSON contains unescaped `{}` in string values | `extractJson` now uses string-aware scanner; if still failing, log raw output and adjust. |
| Admin doesn't get doc-suggestion notification | `notifyProject` called without `includeAdmins: true` | All doc-suggestion paths now pass `includeAdmins: true`. Check admin has a row in `users` table with matching email. |
| Analysis/review never completes | Codex CLI auth expired | `codex auth login` in terminal. Retry loop will auto-resume queued jobs. |
| Chat is slow | Synchronous AI call; typically 10-30s | Show spinner. Users tolerate this. Don't revert to 202 — it broke the chat UI previously. |
| Document generation includes `## Rules` or `Use clear...` | Playbook rule leak | Sanitizer should strip; if new pattern, add to `STRIP_LINE_PATTERNS`. |

## How to add a new skill

1. Create `_config/ai-skills/<name>.md` with frontmatter (`name`, `trigger`, `model`, `maxTokens`, `action`).
2. Add body template with `{{variable}}` placeholders.
3. If triggered by user events: add to `TRIGGER_SKILL_MAP` in `lib/ai/agent.ts`.
4. If triggered by admin chat: add to the planner's `action` enum in `app/api/ai/admin-chat/route.ts`.
5. If it should be durable/retryable: wrap with `createJob + runJobInBackground` and add a `job_type` case in `lib/ai-jobs.ts → retryJob`.

## How to add a new AI trigger

1. Add event type to `AgentEvent.type` (conceptual — it's just a string).
2. Map it in `TRIGGER_SKILL_MAP` to the skill name.
3. Call `handleProjectEvent(ideaId, "your_event_type", {entityId?, content?, actorName?})` from the relevant API route (fire-and-forget).
4. Add trigger config to `_config/agent.json`.

## Environment

- `CODEX_AVAILABLE` — stub env var to signal Codex CLI is installed (set to `"1"` in dev; the actual auth is via `~/.codex/auth.json`).
- `ANTHROPIC_API_KEY` — optional Claude fallback.
- `OPENAI_API_KEY` — optional OpenAI direct API fallback.
- `GOOGLE_AI_API_KEY` — optional Gemini fallback.
