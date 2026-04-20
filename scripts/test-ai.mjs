#!/usr/bin/env node
/**
 * IranENovin AI Backend Test (Node.js)
 *
 * Tests all AI backends with detailed diagnostics.
 * Usage:
 *   node scripts/test-ai.mjs              # Run all tests
 *   node scripts/test-ai.mjs --refresh    # Force-refresh OAuth token
 *   node scripts/test-ai.mjs --codex-only # Test only Codex CLI
 *   node scripts/test-ai.mjs --claude-only # Test only Anthropic Claude
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { homedir } from "os";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CODEX_AUTH_PATH = join(homedir(), ".codex", "auth.json");
const PROJECT_DIR = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const AI_CONFIG_PATH = join(PROJECT_DIR, "_config", "ai.json");
const ENV_PATH = join(PROJECT_DIR, ".env.local");

// OpenAI OAuth (same client_id as Codex CLI)
const TOKEN_ENDPOINT = "https://auth0.openai.com/oauth/token";
const CLIENT_ID = "DRivsnm2Mu42T3KOpqdtwB3NYviHYzwD";

const args = process.argv.slice(2);
const REFRESH_ONLY = args.includes("--refresh");
const CODEX_ONLY = args.includes("--codex-only");
const CLAUDE_ONLY = args.includes("--claude-only");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

let passCount = 0, failCount = 0, warnCount = 0;
function pass(msg) { passCount++; console.log(`${GREEN}  PASS${NC} ${msg}`); }
function fail(msg) { failCount++; console.log(`${RED}  FAIL${NC} ${msg}`); }
function warn(msg) { warnCount++; console.log(`${YELLOW}  WARN${NC} ${msg}`); }
function info(msg) { console.log(`${BLUE}  INFO${NC} ${msg}`); }
function dim(msg)  { console.log(`${DIM}       ${msg}${NC}`); }

function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function loadEnvFile() {
  const env = {};
  if (!existsSync(ENV_PATH)) return env;
  const lines = readFileSync(ENV_PATH, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[match[1]] = val;
    }
  }
  return env;
}

// ---------------------------------------------------------------------------
// Test: JWT Token Analysis
// ---------------------------------------------------------------------------
function testTokenAnalysis() {
  console.log("\n--- Token Analysis ---");

  if (!existsSync(CODEX_AUTH_PATH)) {
    fail(`Auth file not found: ${CODEX_AUTH_PATH}`);
    info("Run: codex auth login");
    return null;
  }

  pass(`Auth file found: ${CODEX_AUTH_PATH}`);

  const auth = JSON.parse(readFileSync(CODEX_AUTH_PATH, "utf-8"));
  info(`Auth mode: ${auth.auth_mode || "unknown"}`);
  info(`Last refresh: ${auth.last_refresh || "unknown"}`);
  info(`OPENAI_API_KEY in file: ${auth.OPENAI_API_KEY ? "set" : "null"}`);

  const tokens = auth.tokens || {};

  // access_token analysis
  if (tokens.access_token) {
    const decoded = decodeJWT(tokens.access_token);
    if (decoded) {
      const expDate = new Date(decoded.exp * 1000);
      const now = new Date();
      const diffMs = expDate - now;
      const diffHours = Math.round(diffMs / 3600000 * 10) / 10;

      if (diffMs > 0) {
        pass(`access_token valid for ${diffHours} hours (expires: ${expDate.toISOString()})`);
      } else {
        fail(`access_token EXPIRED ${Math.abs(diffHours)} hours ago (expired: ${expDate.toISOString()})`);
      }

      // Show scopes
      if (decoded.scp) {
        dim(`  Scopes: ${decoded.scp.join(", ")}`);
      }
      // Show session_id
      if (decoded.session_id) {
        dim(`  Session: ${decoded.session_id}`);
      }
    } else {
      warn("Could not decode access_token JWT");
    }
  } else {
    fail("No access_token in auth file");
  }

  // id_token analysis
  if (tokens.id_token) {
    const decoded = decodeJWT(tokens.id_token);
    if (decoded) {
      const expDate = new Date(decoded.exp * 1000);
      const now = new Date();
      const diffMs = expDate - now;

      if (diffMs > 0) {
        pass("id_token still valid");
      } else {
        // id_token has ~1 hour expiry -- this is NORMAL
        warn("id_token expired (this is normal -- it has a ~1h lifetime)");
      }

      // Subscription info
      const authInfo = decoded["https://api.openai.com/auth"] || {};
      info(`ChatGPT plan: ${authInfo.chatgpt_plan_type || "unknown"}`);
      info(`Subscription active until: ${authInfo.chatgpt_subscription_active_until || "unknown"}`);
      info(`User: ${decoded.name || "unknown"} (${decoded.email || "unknown"})`);
    }
  }

  // refresh_token
  if (tokens.refresh_token) {
    pass("refresh_token present (can auto-refresh)");
    dim(`  Token prefix: ${tokens.refresh_token.slice(0, 10)}...`);
  } else {
    fail("No refresh_token -- cannot auto-refresh, must re-login");
  }

  return auth;
}

// ---------------------------------------------------------------------------
// Test: OAuth Token Refresh
// ---------------------------------------------------------------------------
async function testTokenRefresh(auth, saveToFile = false) {
  console.log("\n--- OAuth Token Refresh ---");

  if (!auth?.tokens?.refresh_token) {
    fail("No refresh_token available");
    return null;
  }

  info("Calling auth0.openai.com/oauth/token ...");

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: auth.tokens.refresh_token,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      fail(`Token refresh failed: HTTP ${res.status}`);
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = null; }
      if (parsed) {
        info(`Error: ${parsed.error_description || parsed.error || body.slice(0, 200)}`);
      } else {
        info(`Response: ${body.slice(0, 200)}`);
      }
      info("");
      info("The refresh_token may be expired or revoked.");
      info("Fix: codex auth login   (re-authenticates via browser)");
      return null;
    }

    const data = await res.json();
    pass("Token refresh succeeded");

    // Analyze the new access_token
    if (data.access_token) {
      const decoded = decodeJWT(data.access_token);
      if (decoded) {
        const expDate = new Date(decoded.exp * 1000);
        info(`New access_token expires: ${expDate.toISOString()}`);
      }
    }

    if (saveToFile) {
      auth.tokens.access_token = data.access_token;
      if (data.refresh_token) auth.tokens.refresh_token = data.refresh_token;
      if (data.id_token) auth.tokens.id_token = data.id_token;
      auth.last_refresh = new Date().toISOString();
      writeFileSync(CODEX_AUTH_PATH, JSON.stringify(auth, null, 2));
      pass(`Saved refreshed tokens to ${CODEX_AUTH_PATH}`);
    } else {
      info("(Dry run -- use --refresh to save to file)");
    }

    return data;
  } catch (e) {
    fail(`Token refresh error: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Test: Codex CLI
// ---------------------------------------------------------------------------
async function testCodexCLI() {
  console.log("\n--- Codex CLI ---");

  // Check if codex is installed
  try {
    const { stdout: whichOut } = await execAsync("which codex", { timeout: 5000 });
    pass(`codex found: ${whichOut.trim()}`);
  } catch {
    fail("codex CLI not found in PATH");
    info("Install: npm install -g @openai/codex");
    return;
  }

  // Get version
  try {
    const { stdout: versionOut } = await execAsync("codex --version", { timeout: 5000 });
    info(`Version: ${versionOut.trim()}`);
  } catch (e) {
    warn(`Could not get version: ${e.message}`);
  }

  // Check available subcommands
  try {
    const { stdout: helpOut } = await execAsync("codex --help 2>&1", { timeout: 5000 });
    const hasExec = helpOut.includes("exec");
    const hasAuth = helpOut.includes("auth");
    info(`Has 'exec' command: ${hasExec}`);
    info(`Has 'auth' command: ${hasAuth}`);

    if (!hasExec) {
      warn("codex does not have 'exec' subcommand -- this may be a different codex binary");
      info("The OpenAI Codex CLI is: npm install -g @openai/codex");
      return;
    }
  } catch (e) {
    warn(`Could not parse help output: ${e.message}`);
  }

  // Try a simple call
  info("Testing: codex exec -m gpt-4.1 'Say hello'");

  try {
    const { stdout } = await execAsync(
      `codex exec -m gpt-4.1 'Say hello in exactly one word' 2>&1`,
      { timeout: 60000, maxBuffer: 1024 * 1024 }
    );

    if (stdout.trim()) {
      pass("Codex CLI call succeeded");
      // Show output (strip header)
      const lines = stdout.split("\n");
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("provider:")) {
          startIdx = i + 1;
          break;
        }
      }
      const response = lines.slice(startIdx).join("\n").trim() || stdout.trim();
      dim(`  Response: ${response.slice(0, 200)}`);
    } else {
      fail("Codex CLI returned empty output");
    }
  } catch (e) {
    fail(`Codex CLI call failed: ${e.message.slice(0, 300)}`);

    // Diagnose common errors
    if (e.message.includes("401") || e.message.includes("Unauthorized") || e.message.includes("auth")) {
      info("Authentication error -- run: codex auth login");
    } else if (e.message.includes("timeout") || e.message.includes("ETIMEDOUT")) {
      info("Request timed out -- check network connectivity");
    } else if (e.message.includes("model")) {
      info("Model may not be available -- try a different model (gpt-4.1, gpt-4o)");
    } else if (e.message.includes("ENOENT")) {
      info("codex binary not found -- check PATH");
    }
  }
}

// ---------------------------------------------------------------------------
// Test: OpenAI API (direct, using OAuth token)
// ---------------------------------------------------------------------------
async function testOpenAIDirect(auth) {
  console.log("\n--- OpenAI API (direct OAuth) ---");

  const token = auth?.tokens?.access_token;
  if (!token) {
    warn("No access_token available to test");
    return;
  }

  info("Testing direct OpenAI API with OAuth access_token...");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        max_tokens: 20,
        messages: [{ role: "user", content: "Say hello in one word" }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "(empty)";
      pass(`OpenAI API succeeded (HTTP ${res.status})`);
      dim(`  Model: ${data.model || "unknown"}`);
      dim(`  Response: ${content}`);
      dim(`  Usage: ${data.usage?.total_tokens || "?"} tokens`);
    } else {
      const body = await res.json().catch(() => ({}));
      fail(`OpenAI API failed: HTTP ${res.status}`);
      info(`Error: ${body.error?.message || JSON.stringify(body).slice(0, 200)}`);

      if (res.status === 401) {
        info("Token invalid/expired. Fix: codex auth login  OR  node scripts/test-ai.mjs --refresh");
      } else if (res.status === 429) {
        info("Rate limited. Wait and retry.");
      } else if (res.status === 403) {
        info("Access denied. Your plan may not include API access.");
      }
    }
  } catch (e) {
    fail(`OpenAI API error: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Test: Anthropic Claude
// ---------------------------------------------------------------------------
async function testAnthropic() {
  console.log("\n--- Anthropic Claude API ---");

  // Load API key from .env.local or env
  const fileEnv = loadEnvFile();
  const apiKey = fileEnv.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    warn("ANTHROPIC_API_KEY not found in .env.local or environment");
    info("Set it in .env.local: ANTHROPIC_API_KEY=sk-ant-...");
    return;
  }

  pass(`ANTHROPIC_API_KEY found (${apiKey.slice(0, 10)}...)`);

  // Load model from config
  let model = "claude-sonnet-4-20250514";
  if (existsSync(AI_CONFIG_PATH)) {
    try {
      const config = JSON.parse(readFileSync(AI_CONFIG_PATH, "utf-8"));
      model = config.models?.claude?.model || model;
    } catch { /* use default */ }
  }

  info(`Testing model: ${model}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 30,
        messages: [{ role: "user", content: "Say hello in one word" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content = data.content?.[0]?.text || "(empty)";
      pass(`Anthropic API succeeded (HTTP ${res.status})`);
      dim(`  Model: ${data.model || "unknown"}`);
      dim(`  Response: ${content}`);
      dim(`  Usage: input=${data.usage?.input_tokens || "?"}, output=${data.usage?.output_tokens || "?"}`);
    } else {
      const body = await res.json().catch(() => ({}));
      fail(`Anthropic API failed: HTTP ${res.status}`);
      info(`Error: ${body.error?.message || JSON.stringify(body).slice(0, 200)}`);

      if (res.status === 401) {
        info("API key invalid. Check ANTHROPIC_API_KEY in .env.local");
      } else if (res.status === 400 && body.error?.message?.includes("model")) {
        info(`Model "${model}" may be invalid. Check _config/ai.json`);
      } else if (res.status === 429) {
        info("Rate limited. Wait and retry, or check billing.");
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      fail("Anthropic API timed out after 30s");
    } else {
      fail(`Anthropic API error: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Test: AI Config Validation
// ---------------------------------------------------------------------------
function testConfig() {
  console.log("\n--- AI Config Validation ---");

  if (!existsSync(AI_CONFIG_PATH)) {
    fail(`ai.json not found: ${AI_CONFIG_PATH}`);
    return;
  }

  const config = JSON.parse(readFileSync(AI_CONFIG_PATH, "utf-8"));
  pass("ai.json loaded successfully");

  info(`Default model: ${config.defaultModel}`);
  info(`Fallback order: ${config.fallbackOrder?.join(" -> ")}`);

  // Check each model
  for (const [name, model] of Object.entries(config.models || {})) {
    const status = model.enabled ? GREEN + "ENABLED" + NC : DIM + "disabled" + NC;
    info(`  ${name}: ${status} (${model.provider}/${model.model})`);

    if (model.enabled && model.provider !== "codex-cli") {
      const fileEnv = loadEnvFile();
      const keyEnv = model.apiKeyEnv;
      const hasKey = !!(fileEnv[keyEnv] || process.env[keyEnv]);
      if (!hasKey) {
        warn(`  ${name} is enabled but ${keyEnv} is not set!`);
      }
    }
  }

  // Check default model exists and is enabled
  if (!config.models?.[config.defaultModel]) {
    fail(`Default model "${config.defaultModel}" not found in models`);
  } else if (!config.models[config.defaultModel].enabled) {
    warn(`Default model "${config.defaultModel}" is disabled`);
  } else {
    pass(`Default model "${config.defaultModel}" is configured and enabled`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("");
  console.log("=============================================");
  console.log("  IranENovin AI Backend Diagnostics (Node)");
  console.log(`  ${new Date().toISOString()}`);
  console.log("=============================================");

  // Always run token analysis
  const auth = testTokenAnalysis();

  if (REFRESH_ONLY) {
    await testTokenRefresh(auth, true);
    console.log("\n--- Done (refresh only) ---\n");
    process.exit(0);
  }

  // Test token refresh (dry run unless --refresh)
  const refreshResult = await testTokenRefresh(auth, args.includes("--refresh"));

  if (!CLAUDE_ONLY) {
    // Test Codex CLI
    await testCodexCLI();

    // Test direct OpenAI API
    // If we just refreshed, use the new token
    if (refreshResult?.access_token) {
      const updatedAuth = { ...auth };
      updatedAuth.tokens = { ...auth.tokens, access_token: refreshResult.access_token };
      await testOpenAIDirect(updatedAuth);
    } else {
      await testOpenAIDirect(auth);
    }
  }

  if (!CODEX_ONLY) {
    // Test Anthropic
    await testAnthropic();
  }

  // Config validation
  testConfig();

  // Summary
  console.log("\n=============================================");
  console.log(`  Results: ${GREEN}${passCount} passed${NC}, ${RED}${failCount} failed${NC}, ${YELLOW}${warnCount} warnings${NC}`);
  console.log("=============================================");

  if (failCount > 0) {
    console.log(`
${YELLOW}Quick Fixes:${NC}

  ${BLUE}Token expired / auth error:${NC}
    codex auth login                        # Re-authenticate via browser
    node scripts/test-ai.mjs --refresh      # Refresh using refresh_token

  ${BLUE}Codex CLI not installed:${NC}
    npm install -g @openai/codex

  ${BLUE}Codex CLI fails but direct API works:${NC}
    The codex binary may be outdated or misconfigured.
    Consider using openai-oauth provider instead of codex-cli.
    Edit _config/ai.json to enable chatgpt with openai-oauth.

  ${BLUE}Skip Codex, use Claude only:${NC}
    In _config/ai.json: set codex.enabled = false
    Ensure ANTHROPIC_API_KEY is set in .env.local
`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(2);
});
