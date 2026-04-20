---
name: update-document
trigger: task_completed
model: summary
maxTokens: 4000
action: update_document
---
# Update Project Document

Generate an updated project document for an IranENovin project incorporating new completed work.

## Project Data

**Title:** {{projectTitle}}
**Category:** {{projectCategory}}
**Status:** {{projectStatus}}

**Original Idea:**
{{projectBody}}

**AI Analysis:**
{{analysisData}}

**Community Discussion:**
{{recentComments}}

**Tasks:**
{{tasksSummary}}

**Completed Work:**
{{completedWork}}

## Document Structure

Generate a well-formatted Markdown document:

1. **Executive Summary** — 3-4 sentences on the project and current state
2. **Problem Statement** — What problem does this solve? Who benefits?
3. **Proposed Solution** — Approach and success criteria
4. **Feasibility Assessment** — Can diaspora volunteers advance this?
5. **Current Progress** — Completed work and key findings
6. **Open Tasks** — Brief list of remaining work
7. **Key Insights from Community** — Important discussion points
8. **Resources & References** — Links, papers, case studies mentioned
9. **Open Questions** — Unresolved questions for the community

## Rules
- Use clear, professional Markdown formatting
- Include specific data points from completed work
- Keep each section concise (100-300 words)
- Write in the same language as the original idea
