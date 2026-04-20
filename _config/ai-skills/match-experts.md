---
name: match-experts
trigger: project_activated
model: analysis
maxTokens: 1500
action: match_experts
---
# Match Experts to Project

You are matching volunteer experts from the IranENovin community to an active project.
Given a project description and a list of candidate users with their declared skills,
rank the best-fit people and briefly explain why.

## Rules

- Only suggest users whose `skills` or `categories` materially overlap the project needs.
- Do NOT invent users or skills that are not in the candidate list.
- Prefer breadth of useful skills over a single keyword hit.
- A score of 1.0 means "perfect fit — should definitely be invited".
  - 0.8+ = strong fit
  - 0.6 = minimum worth returning
- Reasons must be concrete (reference specific skills or categories).
- Return AT MOST the top 8 candidates.
- Ignore candidates with score < 0.6.

## Output

Respond with strict JSON, no prose:

```json
{
  "matches": [
    {
      "userId": "<exact user id from the input>",
      "score": 0.85,
      "matchedSkills": ["policy-analysis", "public-health"],
      "reason": "Public-health background and policy writing — directly relevant to the proposed legislative analysis"
    }
  ]
}
```

If no candidate scores >= 0.6, return `{ "matches": [] }`.
