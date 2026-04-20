/**
 * Initial Sync: Fetch all ideas from GitHub and store in SQLite.
 * Run once: npx tsx scripts/initial-sync.ts
 *
 * Takes 2-3 minutes for ~233 ideas.
 * After that, the agent's incremental sync takes seconds.
 */

import { syncIABIdeas, syncNativeIdeas, syncCategories } from "../lib/sync/index";
import { getDb } from "../lib/db/index";

async function main() {
  console.log("=== IranENovin Initial Sync ===\n");
  console.log("This will fetch all ideas from GitHub and store in SQLite.");
  console.log("May take a few minutes due to API rate limits.\n");

  const db = getDb();

  // Check current state
  const ideaCount = (db.prepare("SELECT COUNT(*) as c FROM ideas").get() as { c: number }).c;
  if (ideaCount > 0) {
    console.log(`Database already has ${ideaCount} ideas.`);
    console.log("Running incremental sync (only fetching updates)...\n");
  } else {
    console.log("Empty database. Running full sync...\n");
  }

  const iabCount = await syncIABIdeas();
  const nativeCount = await syncNativeIdeas();
  await syncCategories();

  const totalIdeas = (db.prepare("SELECT COUNT(*) as c FROM ideas").get() as { c: number }).c;
  const totalComments = (db.prepare("SELECT COUNT(*) as c FROM idea_comments").get() as { c: number }).c;
  const totalCategories = (db.prepare("SELECT COUNT(*) as c FROM github_categories").get() as { c: number }).c;

  console.log("\n=== Sync Complete ===");
  console.log(`Ideas in database: ${totalIdeas}`);
  console.log(`Comments cached: ${totalComments}`);
  console.log(`Categories: ${totalCategories}`);
  console.log(`\nDatabase: _data/iranenovin.db`);
  console.log("Future syncs will only fetch updates (incremental).");
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
