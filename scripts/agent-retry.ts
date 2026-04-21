/**
 * AI-jobs retry pass. Called from the web process (forked) every few
 * minutes so a transient AI failure doesn't require a full agent cycle
 * to recover.
 *
 *   npx tsx scripts/agent-retry.ts
 */

import { processPendingAIJobs, countRetryableJobs } from "../lib/ai-jobs";

(async () => {
  const pending = countRetryableJobs();
  if (pending === 0) {
    // Exit cleanly without churn — parent logs nothing for empty runs.
    process.exit(0);
  }
  try {
    const n = await processPendingAIJobs();
    if (n > 0) console.log(`[AI Jobs] Retried ${n} job(s)`);
    process.exit(0);
  } catch (e) {
    console.error("[AI Jobs] Retry failed:", (e as Error).message);
    process.exit(1);
  }
})();
