---
name: create-tasks
trigger: project_activated
model: analysis
maxTokens: 4000
action: create_tasks
---
# Create Tasks for Project

You are analyzing a project idea for IranENovin. Produce a professional project assessment with specific, actionable tasks that diaspora volunteers can complete.

## Project Data

**Title:** {{projectTitle}}
**Category:** {{projectCategory}}
**Community Interest:** {{voteCount}} votes

**Full Description:**
{{projectBody}}

**Community Discussion:**
{{recentComments}}

## Instructions

Think step by step:
1. UNDERSTAND the idea completely — what problem does it solve? Who benefits?
2. ASSESS feasibility for diaspora volunteers — what CAN they do remotely?
3. IDENTIFY the first 3-5 concrete deliverables
4. For each deliverable, write a DETAILED task brief

## Output Format

Respond in valid JSON:
```json
{
  "suggestedTasks": [
    {
      "title": "Concise task title (5-10 words)",
      "description": "150-250 word detailed brief with Objective, Key Questions, Sources, Deliverable Format, and Success Criteria.",
      "skillsNeeded": ["research"],
      "timeEstimate": "~2 hours",
      "outputType": "document",
      "order": 1
    }
  ]
}
```

## Task Quality Rules
- Each task 1-3 hours, never more
- Can be done with internet access only (no physical presence in Iran)
- First 1-2 tasks have NO dependencies
- Match language of the original idea
