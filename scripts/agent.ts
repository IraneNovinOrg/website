/**
 * IranENovin Background Agent
 *
 * Run with: npx tsx scripts/agent.ts
 * Or via GitHub Actions cron every 5 minutes.
 */

import { runAgentCycle } from "../lib/agent/cycle";

runAgentCycle()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
