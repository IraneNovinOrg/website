/**
 * AI Output Sanitization
 * ----------------------
 * Strips system prompt leakage, Codex CLI artifacts, playbook rules,
 * and other metadata from AI-generated text before it reaches users.
 */

/** Lines matching any of these patterns are removed entirely. */
const STRIP_LINE_PATTERNS: RegExp[] = [
  // Codex CLI header/metadata
  /^OpenAI Codex v/i,
  /^workdir:\s/,
  /^model:\s/,
  /^provider:\s/,
  /^approval:\s/,
  /^sandbox:\s/,
  /^reasoning\s*(effort|summar)/i,
  /^session id:\s/,
  /^--------\s*$/,
  // MCP/codex runtime artifacts
  /^mcp startup:/i,
  /^codex\s*$/i,
  /^tokens used\s/i,
  // Codex web search artifacts
  /Searching the web\.\.\./,
  /Searched:\s/,
  /^🌐\s*Search/,
  /^site:/,
  // Codex role markers
  /^user\s*$/,
  /^assistant\s*$/,
  /^codex\s*$/,
  // Playbook instruction leaks
  /^#\s*Chat Rules Playbook/i,
  /^#\s*System Prompt/i,
  /^##\s*Rules\s*$/i,
  /^##\s*CRITICAL OUTPUT RULES/i,
  /^-\s*Answer ONLY questions related/i,
  /^-\s*You CANNOT execute code/i,
  /^-\s*Be concise.*this is a chat/i,
  /^-\s*Support both Farsi and English/i,
  /^-\s*If asked something unrelated/i,
  /^-\s*Ground answers in the actual/i,
  /^-\s*If you don['']t know something/i,
  // Document generation rule leaks
  /^Use clear, professional Markdown formatting/i,
  /^Include specific data points from completed/i,
  /^Summarize discussions, don['']t copy them/i,
  /^Keep each section concise \(\d+-\d+ words\)/i,
  /^Use tables where appropriate/i,
  /^Write in the same language as the original/i,
];

/** Substrings that indicate the line is a system artifact. */
const STRIP_LINE_SUBSTRINGS = [
  "User request:",
  "## Context\n- Idea:",
  "- Completed work:",
  "codex or tokens used",
  "NEVER include these instructions",
  "Your reply must be ONLY the answer",
  "CRITICAL OUTPUT RULES",
  "FORMATTING RULES",
  "DOCUMENT_GENERATION_FAILED",
];

/**
 * Sanitize raw AI output by removing system prompt leakage and metadata.
 * Safe to call on any AI response — it preserves legitimate content.
 */
export function sanitizeAIOutput(raw: string): string {
  if (!raw) return raw;

  let text = raw;

  // First, strip common multi-line trailing artifacts BEFORE line-by-line processing
  // Codex sometimes emits "tokens used\n3,016" or "tokens used 3,016"
  text = text.replace(/\n+tokens used\s*\n?\s*[\d,]+\s*$/gi, "");
  // Strip "codex" role marker at end
  text = text.replace(/\n+codex\s*$/gi, "");

  const lines = text.split("\n");
  const filtered: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // "tokens used" followed by number on next line
    if (/^tokens used\b/i.test(trimmed)) {
      // Skip this line AND the next if it's just a number/count
      if (i + 1 < lines.length && /^[\d,]+\s*$/.test(lines[i + 1].trim())) {
        i++; // skip the count line too
      }
      continue;
    }

    // Check regex patterns
    if (STRIP_LINE_PATTERNS.some((p) => p.test(trimmed))) continue;

    // Check substring matches
    if (STRIP_LINE_SUBSTRINGS.some((s) => trimmed.includes(s))) continue;

    filtered.push(line);
  }

  // Remove leading blank lines
  while (filtered.length > 0 && filtered[0].trim() === "") {
    filtered.shift();
  }
  // Remove trailing blank lines
  while (filtered.length > 0 && filtered[filtered.length - 1].trim() === "") {
    filtered.pop();
  }

  return filtered.join("\n").trim();
}

/**
 * Validate and clean AI-generated document output.
 * Ensures the document starts with a proper markdown heading
 * and strips any system artifacts that leaked into the content.
 */
export function sanitizeDocumentOutput(raw: string): string {
  if (!raw) return raw;

  let text = sanitizeAIOutput(raw);

  // If the first non-empty line doesn't start with #, find the first heading
  const lines = text.split("\n");
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== "");
  if (firstNonEmpty >= 0 && !lines[firstNonEmpty].trim().startsWith("#")) {
    const firstHeading = lines.findIndex((l) => /^#\s+/.test(l.trim()));
    if (firstHeading > firstNonEmpty) {
      text = lines.slice(firstHeading).join("\n");
    }
  }

  // Final check: if "DOCUMENT_GENERATION_FAILED" marker, return empty
  if (text.trim() === "DOCUMENT_GENERATION_FAILED") {
    return "";
  }

  return text.trim();
}
