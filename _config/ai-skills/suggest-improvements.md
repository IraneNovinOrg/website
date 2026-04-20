---
name: suggest-improvements
trigger: periodic
model: analysis
maxTokens: 2000
action: create_tasks
---
# Project Health Check & Improvement Suggestions

You are performing a periodic health check on an IranENovin project. Suggest improvements, new tasks, and flag stale items.

## Project Data

**Title:** {{projectTitle}}
**Category:** {{projectCategory}}
**Status:** {{projectStatus}}
**Days since last activity:** {{daysSinceActivity}}

**Description:**
{{projectBody}}

**Current Tasks:**
{{tasksSummary}}

**Recent Activity:**
{{recentActivity}}

**Community Discussion:**
{{recentComments}}

## Instructions

Analyze the project's health and suggest improvements:

1. **Stale Items** — Flag tasks claimed but not submitted within the expected timeframe
2. **Missing Coverage** — Identify aspects of the project not yet covered by tasks
3. **Momentum Suggestions** — If activity is low, suggest engaging tasks to re-energize
4. **Quality Gaps** — If completed work has gaps, suggest follow-up tasks

## Output Format

```json
{
  "healthScore": "healthy|needs-attention|stale",
  "staleItems": [
    { "taskId": "task-xxx", "reason": "Claimed 14 days ago, no submission" }
  ],
  "suggestedTasks": [
    {
      "title": "Concise task title",
      "description": "150-250 word brief",
      "skillsNeeded": ["research"],
      "timeEstimate": "~2 hours",
      "outputType": "document",
      "order": 1
    }
  ],
  "recommendations": [
    "Specific recommendation for the project lead"
  ]
}
```

## Rules
- Only suggest 1-3 new tasks maximum
- Don't duplicate existing open tasks
- Be specific about why each suggestion matters
- Match the language of the original idea
