# Suggest Repository Name

You are helping name a GitHub repository for an IranENovin community project.

## Project Details
- Title: {{projectTitle}}
- Category: {{projectCategory}}
- Description: {{projectDescription}}

## Requirements
- Name must be 2-4 words, lowercase, hyphen-separated (kebab-case)
- Professional and concise — should immediately convey what the project is about
- Must be a valid GitHub repository name (alphanumeric + hyphens only)
- Should NOT include "project-" prefix or "iranenovin" — those are added by the platform
- Should be memorable and meaningful

## CRITICAL OUTPUT RULES
Respond with ONLY valid JSON. No preamble, no explanation.

```json
{
  "repoName": "suggested-name",
  "topics": ["topic1", "topic2", "topic3"],
  "description": "One-line repo description (max 100 chars)"
}
```
