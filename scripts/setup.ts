/**
 * First-run setup script — idempotent, safe to re-run.
 *
 * - Creates required directories (_data, public/uploads, etc.)
 * - Initializes the SQLite database and applies the schema + migrations
 * - Copies .env.local.example -> .env.local if missing
 * - Prints a checklist of env vars that still need values
 *
 * Usage: pnpm setup
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync } from "fs";
import { join } from "path";

const root = process.cwd();

function step(title: string, fn: () => void) {
  process.stdout.write(`• ${title} ... `);
  try {
    fn();
    process.stdout.write("ok\n");
  } catch (e) {
    process.stdout.write("FAILED\n");
    console.error("   ", e instanceof Error ? e.message : e);
    throw e;
  }
}

function ensureDir(rel: string) {
  const p = join(root, rel);
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

async function main() {
  console.log("\nIranENovin — setup\n");

  step("Create _data/ directory", () => ensureDir("_data"));
  step("Create public/uploads/ directory", () => ensureDir("public/uploads"));
  step("Create public/uploads/feedback/ directory", () =>
    ensureDir("public/uploads/feedback")
  );
  step("Create public/brand/custom/ directory", () =>
    ensureDir("public/brand/custom")
  );

  step("Ensure .env.local exists", () => {
    const example = join(root, ".env.local.example");
    const target = join(root, ".env.local");
    if (!existsSync(target) && existsSync(example)) {
      copyFileSync(example, target);
      console.log("\n   Created .env.local from .env.local.example — fill in your secrets");
    }
  });

  step("Initialize SQLite database + run migrations", async () => {
    const { getDb } = await import("../lib/db/index");
    getDb(); // triggers schema + migrations
  });

  // Final checklist
  const envPath = join(root, ".env.local");
  const required = [
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "GITHUB_BOT_TOKEN",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ];

  if (existsSync(envPath)) {
    const envText = readFileSync(envPath, "utf8");
    const missing = required.filter((k) => {
      const re = new RegExp(`^${k}=.+`, "m");
      return !re.test(envText);
    });
    if (missing.length) {
      console.log("\nEnv vars still needing values in .env.local:");
      for (const k of missing) console.log(`   - ${k}`);
    } else {
      console.log("\nAll required env vars appear to be set.");
    }
  }

  console.log("\nDone. Next:");
  console.log("   pnpm dev       # start the dev server");
  console.log("   pnpm sync      # one-time GitHub Discussions sync (optional)");
  console.log("");
}

main().catch((e) => {
  console.error("\nSetup failed:", e);
  process.exit(1);
});
