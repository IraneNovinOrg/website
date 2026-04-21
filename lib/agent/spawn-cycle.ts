/**
 * Off-thread agent cycle runner.
 *
 * WHY A CHILD PROCESS, NOT A FUNCTION CALL?
 * ──────────────────────────────────────────
 * `better-sqlite3` is fully synchronous — every `.run()` / `.get()` blocks the
 * Node event loop until the SQL completes. During an agent cycle we do
 * hundreds of inserts (GitHub sync) plus AI subprocess calls. Even with
 * setImmediate yields between chunks, the main HTTP thread still stalls
 * enough to make the UI feel frozen.
 *
 * Forking a child process sidesteps this entirely: the child has its own
 * event loop and its own better-sqlite3 connection. WAL mode on the shared
 * DB file lets them write concurrently without corruption. The parent (the
 * HTTP server) stays 100% free for request handling.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChildProcess } from "child_process";

let child: ChildProcess | null = null;
let lastRunAt = 0;
let lastExitCode: number | null = null;
let lastDurationMs = 0;

// Avoid stacking cycles when one is already running OR finished < 30s ago —
// useful for dev where instrumentation can fire the schedule twice on reload.
const MIN_GAP_MS = 30_000;

export function isCycleRunning(): boolean {
  return !!child && child.exitCode === null && child.signalCode === null;
}

export function lastCycleStatus(): {
  running: boolean;
  lastRunAt: number;
  lastExitCode: number | null;
  lastDurationMs: number;
} {
  return {
    running: isCycleRunning(),
    lastRunAt,
    lastExitCode,
    lastDurationMs,
  };
}

export type CycleScript = "agent" | "agent-retry";

/**
 * Fire a cycle in a forked child. Fire-and-forget: returns immediately.
 * `script` picks which entry point: "agent" = full cycle, "agent-retry" =
 * fast AI-jobs retry pass. `label` is a log prefix so cron + boot + retry
 * cycles are distinguishable in the parent's stdout.
 */
export async function spawnAgentCycle(
  label = "agent",
  script: CycleScript = "agent"
): Promise<void> {
  if (isCycleRunning()) {
    console.log(`[${label}] Cycle already running (pid ${child?.pid}) — skip`);
    return;
  }
  if (lastRunAt > 0 && Date.now() - lastRunAt < MIN_GAP_MS) {
    console.log(`[${label}] Cycle finished ${Math.round((Date.now() - lastRunAt) / 1000)}s ago — skip`);
    return;
  }

  const { spawn } = await import("child_process");
  const { join } = await import("path");

  // Use the repo-local tsx so production deploys don't need `npx` to phone
  // home. `node_modules/.bin/tsx` is created when tsx is installed as a dep.
  const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
  const scriptPath = join(process.cwd(), "scripts", `${script}.ts`);

  const startedAt = Date.now();
  console.log(`[${label}] Spawning ${script} via tsx`);

  child = spawn(tsxBin, [scriptPath], {
    cwd: process.cwd(),
    env: { ...process.env, IE_CYCLE_SOURCE: label },
    // Inherit stdio so child's console.log shows up in server logs in real
    // time — matches the UX of the old in-process cycle.
    stdio: ["ignore", "inherit", "inherit"],
    // Detach so a parent Ctrl-C doesn't forcibly kill an in-flight GitHub
    // sync mid-transaction. We still track the handle to avoid overlap.
    detached: false,
  });

  child.on("error", (err) => {
    console.error(`[${label}] Spawn error:`, err.message);
  });

  child.on("exit", (code, signal) => {
    lastRunAt = Date.now();
    lastExitCode = code;
    lastDurationMs = Date.now() - startedAt;
    child = null;
    if (code === 0) {
      console.log(`[${label}] Cycle finished OK in ${Math.round(lastDurationMs / 1000)}s`);
    } else {
      console.error(
        `[${label}] Cycle exited code=${code} signal=${signal} duration=${Math.round(lastDurationMs / 1000)}s`
      );
    }
  });
}

/** Gracefully stop any running cycle (called from SIGINT/SIGTERM handlers). */
export function stopAgentCycle(): void {
  if (child && child.exitCode === null) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already dead */
    }
  }
}
