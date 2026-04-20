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
    let cycleRunning = false;
    const cycle = () => {
      if (cycleRunning) return;
      cycleRunning = true;
      // setImmediate hands control back to the event loop before starting.
      setImmediate(async () => {
        try {
          const { runAgentCycle } = await import("./lib/agent/cycle");
          await runAgentCycle();
        } catch (e) {
          console.error("[Agent] Cycle error:", e);
        } finally {
          cycleRunning = false;
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
    let retrying = false;
    const retryLoop = () => {
      if (retrying) return;
      retrying = true;
      setImmediate(async () => {
        try {
          const { processPendingAIJobs, countRetryableJobs } = await import("./lib/ai-jobs");
          const queued = countRetryableJobs();
          if (queued > 0) {
            const n = await processPendingAIJobs();
            if (n > 0) console.log(`[AI Jobs] Retried ${n} job(s)`);
          }
        } catch (e) {
          console.error("[AI Jobs] Retry loop error:", e);
        } finally {
          retrying = false;
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
  }
}
