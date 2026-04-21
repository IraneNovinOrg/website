/**
 * Standalone Codex CLI smoke test.
 *
 * Exercises the same spawn path the web app uses so we can reproduce
 * failures outside Next.js. Runs three checks:
 *
 *   1. `which codex` — is the binary installed?
 *   2. `codex --version` — does it respond at all?
 *   3. `codex exec -m <model> "<prompt>"` — does it actually answer?
 *
 * Usage:
 *   npx tsx scripts/test-codex.ts                 # uses defaults
 *   npx tsx scripts/test-codex.ts -m gpt-5-codex  # pick a specific model
 *   npx tsx scripts/test-codex.ts --raw           # print full stdout/stderr
 *
 * Exit codes:
 *   0 — Codex answered successfully
 *   1 — Binary missing or unreachable
 *   2 — Binary ran but the response was empty / exit non-zero
 */

import { spawn, exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const execAsync = promisify(exec);

const argv = process.argv.slice(2);
function arg(flag: string, fallback = ""): string {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const RAW = argv.includes("--raw");
const MODEL =
  arg("-m") ||
  arg("--model") ||
  process.env.CODEX_MODEL ||
  "gpt-5-codex";
const PROMPT =
  arg("-p") ||
  arg("--prompt") ||
  'Reply with exactly the word "PONG" and nothing else.';
const TIMEOUT_MS = Number(arg("--timeout", "90000"));

function h(s: string) {
  console.log(`\n\x1b[1m── ${s} ──\x1b[0m`);
}

async function step1BinaryExists(): Promise<boolean> {
  h("1. codex binary on PATH");
  try {
    const { stdout } = await execAsync("which codex", { timeout: 3000 });
    console.log(`  ✓ ${stdout.trim()}`);
    return true;
  } catch {
    console.log("  ✗ codex not found in PATH");
    console.log("    install: npm install -g @openai/codex");
    return false;
  }
}

async function step2Version(): Promise<void> {
  h("2. codex --version");
  try {
    const { stdout, stderr } = await execAsync("codex --version", { timeout: 5000 });
    console.log(`  ${stdout.trim() || stderr.trim() || "(no output)"}`);
  } catch (e) {
    console.log(`  ✗ ${(e as Error).message}`);
  }
}

function step3AuthFile(): void {
  h("3. ~/.codex/auth.json sanity");
  const authPath = join(homedir(), ".codex", "auth.json");
  if (!existsSync(authPath)) {
    console.log(`  ✗ No auth file at ${authPath}`);
    console.log("    run: codex auth login");
    return;
  }
  try {
    const raw = readFileSync(authPath, "utf-8");
    const parsed = JSON.parse(raw);
    const accessToken = parsed?.tokens?.access_token;
    if (!accessToken) {
      console.log("  ✗ auth.json exists but has no tokens.access_token");
      return;
    }
    const parts = accessToken.split(".");
    if (parts.length < 2) {
      console.log("  ~ access_token present (not a JWT, can't decode exp)");
      return;
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    const expMs = (payload.exp || 0) * 1000;
    const remainingMin = Math.round((expMs - Date.now()) / 60000);
    if (expMs > 0 && expMs < Date.now()) {
      console.log(`  ✗ access_token EXPIRED ${Math.abs(remainingMin)} min ago — refresh with: codex auth login`);
    } else {
      console.log(`  ✓ access_token valid for ${remainingMin} min`);
    }
  } catch (e) {
    console.log(`  ✗ failed to parse auth.json: ${(e as Error).message}`);
  }
}

async function step4Invoke(): Promise<number> {
  h(`4. codex exec -m ${MODEL} "${PROMPT.slice(0, 40)}${PROMPT.length > 40 ? "…" : ""}"`);

  const args = [
    "exec",
    "-m",
    MODEL,
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    PROMPT,
  ];

  return new Promise<number>((resolve) => {
    const started = Date.now();
    const child = spawn("codex", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    try {
      child.stdin?.end();
    } catch { /* ignore */ }
    child.stdin?.on("error", () => { /* ignore */ });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf-8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf-8"); });

    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
    }, TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      console.log(`  ✗ spawn error: ${err.message}`);
      resolve(1);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      const exit = code ?? -1;
      console.log(`  exit code: ${exit}  (${elapsed}ms)`);
      console.log(`  stdout bytes: ${stdout.length}   stderr bytes: ${stderr.length}`);

      if (RAW) {
        console.log("\n  ── raw stdout ─────────────────────────");
        console.log(stdout);
        console.log("  ── raw stderr ─────────────────────────");
        console.log(stderr);
      } else {
        if (stdout) {
          console.log("\n  stdout tail:");
          console.log("  " + stdout.slice(-400).split("\n").join("\n  "));
        }
        if (stderr) {
          console.log("\n  stderr tail:");
          console.log("  " + stderr.slice(-400).split("\n").join("\n  "));
        }
      }

      // In Codex 0.111+, stdout is the clean answer (can be as short as
      // "PONG\n") and stderr holds the ceremony. A successful run has
      // non-empty stdout and exit 0.
      const cleanStdout = stdout.trim();
      const hasAnswer = cleanStdout.length > 0;
      if (exit === 0 && hasAnswer) {
        console.log(`\n  ✓ Codex answered successfully: ${JSON.stringify(cleanStdout.slice(0, 200))}`);
        resolve(0);
      } else if (hasAnswer) {
        console.log(`\n  ~ Codex answered (exit ${exit}): ${JSON.stringify(cleanStdout.slice(0, 200))}`);
        resolve(0);
      } else {
        console.log("\n  ✗ Codex did not return a usable answer");
        resolve(2);
      }
    });
  });
}

(async () => {
  console.log(`Codex test harness — model=${MODEL}, timeout=${TIMEOUT_MS}ms`);
  const ok = await step1BinaryExists();
  if (!ok) process.exit(1);
  await step2Version();
  step3AuthFile();
  const exit = await step4Invoke();
  process.exit(exit);
})();
