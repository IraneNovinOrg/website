// NOTE: the `if (process.env.NEXT_RUNTIME === "nodejs")` wrapper below is
// what lets Next.js strip node-only imports (fs, path, better-sqlite3, etc.)
// out of the edge bundle. Webpack replaces `process.env.NEXT_RUNTIME` with
// a literal at build time, which turns the block into dead code in the
// edge build. DO NOT refactor this into an early-return — that breaks the
// static elimination and the edge bundle tries to resolve `fs`.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Per-process latch so a Next.js hot-reload (dev) or a second worker
    // (prod) never double-starts the background workers.
    const g = globalThis as unknown as { __IE_BG_STARTED?: boolean };
    if (g.__IE_BG_STARTED) return;
    g.__IE_BG_STARTED = true;

    // Allow disabling all background work for local dev where you just want a
    // responsive UI: `DISABLE_BACKGROUND=1 pnpm dev`
    if (process.env.DISABLE_BACKGROUND === "1") {
      console.log("[BG] DISABLE_BACKGROUND=1 — skipping all background workers");
      return;
    }

    // Longer first-run delay so the server can fully boot, compile, and serve
    // the first requests before we start touching the main thread for anything
    // non-user-facing. Previously was 30s, which in dev fired during the first
    // page compile and starved incoming requests.
    const FIRST_DELAY_MS = Number(process.env.BG_FIRST_DELAY_MS || 2 * 60_000);
    const CYCLE_INTERVAL_MS = Number(process.env.BG_CYCLE_INTERVAL_MS || 15 * 60_000);
    const RETRY_INTERVAL_MS = Number(process.env.BG_RETRY_INTERVAL_MS || 3 * 60_000);

    // Telegram — fire-and-forget, low CPU.
    setTimeout(async () => {
      try {
        const { initializeBot } = await import("./lib/telegram/bot");
        await initializeBot();
      } catch (e) {
        console.error("[Telegram] Bot init failed:", e);
      }
    }, 10_000);
    console.log("[Telegram] Bot initialization scheduled (10s delay)");

    // ── Agent cycle ─────────────────────────────────────────────────────────
    // Spawned in a CHILD PROCESS, not imported into this one. better-sqlite3
    // is synchronous, so running the cycle in-process pauses HTTP handling
    // briefly per SQL call — the user reported a fully-frozen UI during
    // sync. A child has its own event loop; WAL mode keeps the DB file
    // safe under concurrent writes. See lib/agent/spawn-cycle.ts.
    const cycle = () => {
      setImmediate(async () => {
        try {
          const { spawnAgentCycle } = await import("./lib/agent/spawn-cycle");
          await spawnAgentCycle("agent");
        } catch (e) {
          console.error("[Agent] Spawn error:", e);
        }
      });
    };

    const firstCycle = setTimeout(cycle, FIRST_DELAY_MS);
    const intervalCycle = setInterval(cycle, CYCLE_INTERVAL_MS);
    if (typeof firstCycle.unref === "function") firstCycle.unref();
    if (typeof intervalCycle.unref === "function") intervalCycle.unref();
    console.log(
      `[Agent] Background sync scheduled (first in ${Math.round(FIRST_DELAY_MS / 1000)}s, then every ${Math.round(CYCLE_INTERVAL_MS / 60_000)}m)`
    );

    // ── AI job retry loop ───────────────────────────────────────────────────
    // Same off-thread story as the cycle: retry logic touches better-sqlite3
    // + AI subprocess spawns, both of which stall the main event loop.
    // The retry script exits fast when there's nothing to do, so spinning
    // up a child every 3min is cheap.
    const retryLoop = () => {
      setImmediate(async () => {
        try {
          const { spawnAgentCycle } = await import("./lib/agent/spawn-cycle");
          await spawnAgentCycle("ai-jobs", "agent-retry");
        } catch (e) {
          console.error("[AI Jobs] Spawn error:", e);
        }
      });
    };
    const firstRetry = setTimeout(retryLoop, FIRST_DELAY_MS + 30_000);
    const intervalRetry = setInterval(retryLoop, RETRY_INTERVAL_MS);
    if (typeof firstRetry.unref === "function") firstRetry.unref();
    if (typeof intervalRetry.unref === "function") intervalRetry.unref();
    console.log(
      `[AI Jobs] Retry loop scheduled (first in ${Math.round((FIRST_DELAY_MS + 30_000) / 1000)}s, then every ${Math.round(RETRY_INTERVAL_MS / 60_000)}m)`
    );

    // If the server shuts down, kill any running child cycle so we don't
    // leak a zombie. The child's exit handler logs the outcome.
    const shutdown = async () => {
      try {
        const { stopAgentCycle } = await import("./lib/agent/spawn-cycle");
        stopAgentCycle();
      } catch {
        /* shutdown path — best effort */
      }
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }
}
