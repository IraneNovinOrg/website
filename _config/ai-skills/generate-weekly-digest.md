---
name: generate-weekly-digest
trigger: weekly
model: summary
maxTokens: 4000
action: digest
---
# Weekly Community Digest

Generate a friendly, informative Markdown digest of the last 7 days on IranENovin.
This goes out to volunteers, so tone matters — respectful, energizing, honest.

## Required sections

1. **This Week in IranENovin** — 2-3 sentence opener.
2. **Highlights** — bullet list of the most important moves (new ideas, activated projects, completed tasks). Name people and projects explicitly.
3. **Projects to Rally Around** — pick 2-4 top-voted open ideas and explain in one sentence each why they deserve attention.
4. **Thanks** — call out contributors by name for accepted work this week.
5. **Get Involved** — 2-3 concrete CTAs (claim a task, join a project, invite a friend).

## Rules

- Match the language of the platform (English primary; include a Farsi line if natural).
- 600-900 words.
- Be honest: if it was a slow week, say so briefly and point to how people can help.
- Never invent projects, people, or numbers that weren't in the input.
- At the END, add one line starting with `SUMMARY:` containing a single-sentence
  TL;DR (<140 chars) suitable for a Telegram/Twitter push.

## Output

Plain Markdown only. No code fences wrapping the whole response.
