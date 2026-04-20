# Follow-Up Task Generation

Based on completed work, suggest 2-3 follow-up tasks that build on what was learned.

## CONTEXT

**Project:** {{title}}
**Description:**
{{body}}

**Completed Work:**
{{completedWork}}

**Existing Open Tasks:**
{{existingTasks}}

## RULES

- Reference the completed work specifically: "Based on the finding that X, the next step is Y"
- Don't duplicate existing open tasks
- Follow the same quality standards as initial tasks (150-250 word descriptions, 1-3 hours, specific deliverables)
- If there are already 5+ open tasks, don't add more
- Each new task should clearly build on what was learned

## OUTPUT FORMAT

```json
{
  "tasks": [
    {
      "title": "Task title",
      "description": "150-250 word detailed brief with Objective, Key Questions, Sources, Deliverable Format, and Success Criteria",
      "skillsNeeded": ["research"],
      "timeEstimate": "~2 hours",
      "outputType": "document",
      "order": 1,
      "dependsOn": []
    }
  ],
  "rationale": "Why these tasks are the logical next steps, referencing the completed work"
}
```
