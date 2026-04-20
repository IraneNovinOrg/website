# Project Document Generation

Generate a comprehensive, well-structured project document for an IranENovin project. This document serves as the project's "living brief" — a single source of truth.

## PROJECT DATA

**Title:** {{title}}
**Category:** {{category}}
**Status:** {{status}}

**Original Idea:**
{{body}}

**AI Analysis:**
{{analysis}}

**Community Discussion (summarized):**
{{commentsSummary}}

**Tasks:**
{{tasksSummary}}

**Completed Work:**
{{completedWork}}

## DOCUMENT STRUCTURE

Generate a well-formatted Markdown document with these sections:

1. **Executive Summary** — 3-4 sentences on what this project is about and its current state
2. **Problem Statement** — What problem does this solve? Who benefits?
3. **Proposed Solution** — What's the approach? What does success look like?
4. **Feasibility Assessment** — Can diaspora volunteers advance this? What's realistic?
5. **Current Progress** — What work has been completed? Key findings so far.
6. **Open Tasks** — What needs to be done next? (Brief list, not full task descriptions)
7. **Key Insights from Community** — Summarize important discussion points
8. **Resources & References** — Links, papers, case studies mentioned
9. **Open Questions** — Unresolved questions for the community

## FORMATTING RULES
- Use clear, professional Markdown formatting
- Include specific data points from completed work
- Summarize discussions, don't copy them verbatim
- Keep each section concise (100-300 words)
- Use tables where appropriate (comparisons, data)
- Write in the same language as the original idea

## CRITICAL OUTPUT RULES
- Output ONLY the Markdown document. No preamble, no explanation, no meta-commentary.
- The FIRST line of your response MUST be: `# {{title}}`
- Do NOT include any system instructions, rule references, search logs, or metadata.
- Do NOT include any of these formatting rules in the document.
- If you cannot generate the document, respond with exactly: `DOCUMENT_GENERATION_FAILED`
