/**
 * AI-powered auto-review for user-submitted document edit suggestions.
 * Returns one of three verdicts:
 *   - "approve": the edit is clearly good (typo fix, clarification, new useful info)
 *   - "reject":  the edit is clearly bad (vandalism, spam, content removal without reason, off-topic)
 *   - "defer":   unclear — leave for a human admin/lead to decide
 */

import { callAI } from "./router";
import { extractJson } from "./skills";
import { sanitizeAIOutput } from "../ai-sanitize";

export interface DocSuggestionReview {
  verdict: "approve" | "reject" | "defer";
  reason: string;
}

const SYSTEM_PROMPT = `You are reviewing an edit suggestion to a community project document on IranENovin.
Compare the ORIGINAL and SUGGESTED versions. Decide one of:
- "approve": a clear improvement (typo/grammar fix, added useful info, better structure, correct formatting). Safe to apply automatically.
- "reject": clearly harmful (spam, vandalism, removing important content without reason, off-topic, profanity, political propaganda).
- "defer": substantial change that needs a human decision (new sections, significant rewrites, debatable claims, disputed facts).

Respond with ONLY a single JSON object, no preamble:
{"verdict":"approve|reject|defer","reason":"one-sentence explanation"}

Rules:
- Never approve if the change removes >30% of the original content without clearly replacing it.
- Never approve content containing slurs, doxxing, or violent speech — reject those.
- Small typo/formatting/clarification fixes under 200 changed characters should usually approve.
- When in doubt, defer.`;

export async function reviewDocSuggestion(
  projectTitle: string,
  original: string,
  suggested: string
): Promise<DocSuggestionReview> {
  const prompt = `Project: ${projectTitle}

ORIGINAL (${original.length} chars):
${original.slice(0, 6000)}

SUGGESTED (${suggested.length} chars):
${suggested.slice(0, 6000)}`;

  try {
    const { text } = await callAI("review", SYSTEM_PROMPT, prompt, { maxTokens: 400 });
    const cleaned = sanitizeAIOutput(text);
    const parsed = extractJson<DocSuggestionReview>(cleaned);
    if (!parsed || !["approve", "reject", "defer"].includes(parsed.verdict)) {
      return { verdict: "defer", reason: "AI response was not parseable; deferring to human review." };
    }
    return {
      verdict: parsed.verdict,
      reason: (parsed.reason || "").slice(0, 500),
    };
  } catch (e) {
    return {
      verdict: "defer",
      reason: `AI review failed (${(e as Error).message?.slice(0, 100) || "unknown"}); deferring to human review.`,
    };
  }
}
