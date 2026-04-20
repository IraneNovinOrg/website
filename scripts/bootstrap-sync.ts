/**
 * Bootstrap sync — initializes DB, loads env, runs full GitHub sync once.
 * Usage: npx tsx scripts/bootstrap-sync.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  console.log("GITHUB_ORG:", process.env.GITHUB_ORG);
  console.log("GITHUB_IDEAS_REPO:", process.env.GITHUB_IDEAS_REPO);
  console.log("GITHUB_BOT_TOKEN set:", !!process.env.GITHUB_BOT_TOKEN, "(" + (process.env.GITHUB_BOT_TOKEN?.length || 0) + " chars)");

  const { runFullSync } = await import("../lib/sync/index");
  await runFullSync();

  // Count what we got
  const { getDb } = await import("../lib/db/index");
  const db = getDb();
  const ideas = (db.prepare("SELECT COUNT(*) as c FROM ideas").get() as { c: number }).c;
  const comments = (db.prepare("SELECT COUNT(*) as c FROM idea_comments").get() as { c: number }).c;
  console.log(`\nDB now has: ${ideas} ideas, ${comments} comments`);
}

main().catch((e) => {
  console.error("Bootstrap failed:", e);
  process.exit(1);
});
