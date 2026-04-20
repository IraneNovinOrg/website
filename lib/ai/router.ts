import { readFileSync } from "fs";
import { join } from "path";
import { getOpenAIToken } from "./openai-auth";
import { sanitizeAIOutput } from "../ai-sanitize";

const CONFIG_PATH = join(process.cwd(), "_config", "ai.json");

interface AIConfig {
  defaultModel: string;
  models: Record<string, ModelConfig>;
  fallbackOrder: string[];
  taskRouting: Record<string, string>;
}

interface ModelConfig {
  enabled: boolean;
  provider: "anthropic" | "openai" | "openai-oauth" | "codex-cli" | "google";
  model: string;
  apiKeyEnv: string;
  endpoint: string;
  maxTokens: number;
  priority: number;
}

function loadConfig(): AIConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

export async function callAI(
  task: string,
  systemPrompt: string,
  userMessage: string,
  options?: {
    preferModel?: string;
    maxTokens?: number;
    messages?: { role: "user" | "assistant"; content: string }[];
    ideaId?: string;
  }
): Promise<{ text: string; model: string }> {
  // Pass task type through so providers can adjust behavior
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__currentAITask = task;
  const config = loadConfig();

  const modelKey =
    options?.preferModel || config.taskRouting[task] || config.defaultModel;

  const chain = [
    modelKey,
    ...config.fallbackOrder.filter((m) => m !== modelKey),
  ];

  // Rough token estimation: ~4 chars per token
  const estInputTokens = Math.ceil(
    (systemPrompt.length + userMessage.length +
      (options?.messages?.reduce((s, m) => s + m.content.length, 0) || 0)) / 4
  );

  console.log(`[AI Router] Task="${task}", preferred="${modelKey}", chain=[${chain.join(",")}], est_input_tokens=${estInputTokens}`);

  let lastError: Error | null = null;
  let triedCount = 0;

  for (const key of chain) {
    const model = config.models[key];
    if (!model?.enabled) {
      console.log(`[AI Router] Skipping ${key}: disabled`);
      continue;
    }

    let apiKey: string | null = null;
    if (model.provider === "codex-cli") {
      // Codex CLI subprocess handles its own auth (~/.codex/auth.json via
      // ChatGPT Pro OAuth session). No token lookup required — use sentinel
      // so the null-check below doesn't skip this model.
      apiKey = "codex-cli";
    } else if (model.provider === "openai-oauth") {
      console.log(`[AI Router] Trying ${key} (${model.model}) via OAuth...`);
      apiKey = await getOpenAIToken();
    } else {
      apiKey = process.env[model.apiKeyEnv] || null;
    }

    if (!apiKey) {
      console.warn(`[AI Router] Skipping ${key}: no token/key available (env: ${model.apiKeyEnv || "OPENAI_OAUTH_TOKEN"})`);
      continue;
    }

    triedCount++;
    console.log(`[AI Router] Calling ${key} (${model.model}, provider=${model.provider})...`);

    const startedAt = Date.now();
    try {
      const result = await callProvider(
        model,
        apiKey,
        systemPrompt,
        userMessage,
        options?.maxTokens || model.maxTokens,
        options?.messages
      );
      const latencyMs = Date.now() - startedAt;
      console.log(`[AI Router] ${key} succeeded (${result.length} chars, ${latencyMs}ms)`);
      // Log AI operation (best-effort; don't break on failure)
      try {
        const { logAIOperation } = await import("../db/index");
        logAIOperation({
          operationType: task,
          ideaId: options?.ideaId,
          modelUsed: key,
          tokensInput: estInputTokens,
          tokensOutput: Math.ceil(result.length / 4),
          latencyMs,
          success: true,
        });
      } catch { /* ignore */ }
      return { text: result, model: key };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      lastError = error as Error;
      console.error(`[AI Router] ${key} FAILED (${latencyMs}ms):`, (error as Error)?.message || error);
      try {
        const { logAIOperation } = await import("../db/index");
        logAIOperation({
          operationType: task,
          ideaId: options?.ideaId,
          modelUsed: key,
          tokensInput: estInputTokens,
          tokensOutput: 0,
          latencyMs,
          success: false,
          errorMessage: (error as Error)?.message?.slice(0, 500) || String(error).slice(0, 500),
        });
      } catch { /* ignore */ }
      continue;
    }
  }

  const errorDetail = triedCount === 0
    ? "No AI models available — check that ANTHROPIC_API_KEY is set in .env.local and claude model is enabled in _config/ai.json"
    : lastError
      ? `All ${triedCount} AI model(s) failed. Last error: ${lastError.message}`
      : "All AI models failed or no API keys configured";

  console.error(`[AI Router] FINAL FAILURE: ${errorDetail}`);
  throw new Error(errorDetail);
}

async function callProvider(
  model: ModelConfig,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  extraMessages?: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  switch (model.provider) {
    case "anthropic":
      return callAnthropic(model, apiKey, systemPrompt, userMessage, maxTokens, extraMessages);
    case "openai":
    case "openai-oauth":
      return callOpenAI(model, apiKey, systemPrompt, userMessage, maxTokens, extraMessages);
    case "codex-cli":
      // Subprocess path — uses the local `codex` binary with ChatGPT Pro
      // OAuth session (~/.codex/auth.json). Separate quota from OpenAI API.
      return callCodexCLI(model, systemPrompt, userMessage);
    case "google":
      return callGemini(model, apiKey, systemPrompt, userMessage, maxTokens);
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

async function callAnthropic(
  model: ModelConfig,
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
  extraMessages?: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const messages = extraMessages
    ? [...extraMessages, { role: "user" as const, content: user }]
    : [{ role: "user" as const, content: user }];

  // Validate API key format
  if (!apiKey || apiKey.length < 10) {
    throw new Error("Anthropic API key is missing or too short");
  }

  // Build the basic request body (no extended thinking first — it is fragile)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    model: model.model,
    max_tokens: maxTokens,
    system,
    messages,
  };

  console.log(`[AI Router] Anthropic request: model=${model.model}, max_tokens=${maxTokens}, messages=${messages.length}, system_len=${system.length}`);

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  // Simple call without extended thinking (reliable path).
  // AbortController enforces a 90-second timeout so we don't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let res: Response;
  try {
    res = await fetch(model.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeout);
    if ((fetchErr as Error)?.name === "AbortError") {
      throw new Error("Anthropic request timed out after 90 seconds");
    }
    throw new Error(`Anthropic fetch failed: ${(fetchErr as Error)?.message || fetchErr}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let errorMsg = `Anthropic ${res.status}`;
    let errorType = "";
    try {
      const data = await res.json();
      errorMsg = data.error?.message || errorMsg;
      errorType = data.error?.type || "";
      console.error(`[AI Router] Anthropic error response:`, JSON.stringify(data.error || data));
    } catch {
      const textBody = await res.text().catch(() => "");
      console.error(`[AI Router] Anthropic error (non-JSON): ${res.status} ${textBody.slice(0, 500)}`);
    }

    // Specific guidance for common errors
    if (res.status === 401) {
      throw new Error(`Anthropic authentication failed — check ANTHROPIC_API_KEY (${errorMsg})`);
    }
    if (res.status === 400 && errorType === "invalid_request_error" && errorMsg.includes("model")) {
      // Model name might be invalid — log clearly
      throw new Error(`Anthropic rejected model "${model.model}": ${errorMsg}`);
    }
    if (res.status === 429) {
      throw new Error(`Anthropic rate limit reached: ${errorMsg}`);
    }
    if (res.status === 529 || res.status === 503) {
      throw new Error(`Anthropic service overloaded (${res.status}): ${errorMsg}`);
    }

    throw new Error(errorMsg);
  }

  const data = await res.json();

  // Extract text from response content array
  if (Array.isArray(data.content)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = data.content.find((b: any) => b.type === "text");
    if (textBlock) return textBlock.text;
    // Fallback to first block
    if (data.content.length > 0 && data.content[0]?.text) {
      return data.content[0].text;
    }
    console.error("[AI Router] Anthropic returned content array with no text block:", JSON.stringify(data.content).slice(0, 500));
    throw new Error("Anthropic returned empty content");
  }

  // Unexpected response shape
  console.error("[AI Router] Anthropic unexpected response shape:", JSON.stringify(data).slice(0, 500));
  throw new Error("Unexpected Anthropic response format");
}

// Works for both standard API keys (sk-...) and OAuth session tokens
// The endpoint and auth header format is the same — OpenAI accepts both
async function callOpenAI(
  model: ModelConfig,
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
  extraMessages?: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const messages = [
    { role: "system" as const, content: system },
    ...(extraMessages || []),
    { role: "user" as const, content: user },
  ];

  const res = await fetch(model.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: maxTokens,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI ${res.status}`);
  return data.choices[0].message.content;
}

// Uses Codex CLI as a subprocess — works with ChatGPT Pro subscription
// (separate quota from OpenAI API). Auth is handled by the CLI itself via
// ~/.codex/auth.json.
//
// Before shelling out, we validate:
//  1. codex binary exists in PATH
//  2. ~/.codex/auth.json exists with a non-expired access_token
//  3. If the token is near-expiry, we auto-refresh it first
async function callCodexCLI(
  model: ModelConfig,
  system: string,
  user: string
): Promise<string> {
  // Dynamic imports so top-level node-only modules don't break edge runtime
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const { existsSync, readFileSync, writeFileSync } = await import("fs");
  const { join } = await import("path");
  const { homedir } = await import("os");
  const execAsync = promisify(exec);

  // --- Pre-flight: check codex binary exists ---
  try {
    await execAsync("which codex", { timeout: 5000 });
  } catch {
    throw new Error(
      "Codex CLI not found in PATH. Install with: npm install -g @openai/codex"
    );
  }

  // --- Pre-flight: check auth token freshness ---
  const authPath = join(homedir(), ".codex", "auth.json");
  if (existsSync(authPath)) {
    try {
      const authData = JSON.parse(readFileSync(authPath, "utf-8"));
      const accessToken = authData?.tokens?.access_token;

      if (accessToken) {
        // Decode JWT exp claim without external deps
        const parts = accessToken.split(".");
        if (parts.length >= 2) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf-8")
          );
          const expMs = (payload.exp || 0) * 1000;
          const nowMs = Date.now();
          const remainingMin = Math.round((expMs - nowMs) / 60000);

          if (expMs > 0 && expMs < nowMs) {
            console.warn(
              `[AI Router] Codex access_token EXPIRED ${Math.abs(remainingMin)} min ago — attempting auto-refresh...`
            );
            await refreshCodexAuth(authPath, authData, readFileSync, writeFileSync);
          } else if (expMs > 0 && (expMs - nowMs) < 10 * 60 * 1000) {
            console.log(
              `[AI Router] Codex access_token expires in ${remainingMin} min — proactive refresh...`
            );
            await refreshCodexAuth(authPath, authData, readFileSync, writeFileSync);
          } else if (remainingMin > 0) {
            console.log(
              `[AI Router] Codex access_token valid for ${remainingMin} min`
            );
          }
        }
      }
    } catch (authErr) {
      console.warn(
        `[AI Router] Could not check codex auth: ${(authErr as Error).message}`
      );
      // Continue anyway — let the CLI handle it
    }
  } else {
    console.warn(
      `[AI Router] No codex auth file at ${authPath}. Run: codex auth login`
    );
  }

  // --- Build and execute command ---
  const fullPrompt = `${system}\n\n---\n\nUser request:\n${user}`;
  // Escape single quotes for POSIX shell single-quoted string
  const escaped = fullPrompt.replace(/'/g, "'\\''");

  // --skip-git-repo-check: project dir may not be a git repo
  // --dangerously-bypass-approvals-and-sandbox: non-interactive mode
  // stderr is captured (not suppressed) for diagnostics
  const cmd = `codex exec -m ${model.model} --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox '${escaped}'`;

  console.log(`[AI Router] Calling Codex CLI with model ${model.model} (async)...`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      encoding: "utf-8",
      timeout: 120000, // 2 min timeout
      maxBuffer: 1024 * 1024, // 1MB
    });

    if (stderr) {
      console.warn(`[AI Router] Codex CLI stderr: ${stderr.slice(0, 300)}`);
    }

    // Codex CLI prints a header block then the response. The output looks like:
    //   OpenAI Codex v0.111.0 (research preview)
    //   --------
    //   workdir: /path
    //   model: gpt-5.4
    //   provider: openai
    //   ... more headers ...
    //   --------
    //   user
    //   [echoed prompt]
    //   mcp startup: ...
    //   [actual assistant response]
    //
    // We strip everything up to and including the second "--------" separator,
    // then skip the echoed user prompt and "mcp startup" lines.
    const combined = stdout + (stderr ? "\n" + stderr : "");
    const lines = combined.split("\n");

    // Find the second "--------" separator (end of header block)
    let separatorCount = 0;
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "--------") {
        separatorCount++;
        if (separatorCount >= 2) {
          startIdx = i + 1;
          break;
        }
      }
    }

    // The output after the second separator looks like:
    //   user
    //   [full echoed prompt - system + user message]
    //   mcp startup: ...
    //   assistant (or codex)
    //   [actual AI response]
    //
    // Strategy: find the "assistant" or "codex" role marker line that
    // separates the echoed prompt from the actual response.
    let responseLines = lines.slice(startIdx);

    // Find the "assistant" or "codex" marker that begins the actual response
    let assistantIdx = -1;
    for (let i = 0; i < responseLines.length; i++) {
      const line = responseLines[i].trim().toLowerCase();
      if (line === "assistant" || line === "codex") {
        assistantIdx = i + 1;
        break;
      }
    }

    if (assistantIdx > 0) {
      // Found the marker — everything after it is the actual response
      responseLines = responseLines.slice(assistantIdx);
    } else {
      // No explicit marker — fall back to skipping known metadata lines
      while (responseLines.length > 0) {
        const line = responseLines[0].trim();
        if (line === "user" || line.startsWith("mcp startup") || line === "" ||
            line.startsWith("approval:") || line.startsWith("sandbox:") ||
            line.startsWith("reasoning") || line.startsWith("session id:")) {
          responseLines.shift();
          continue;
        }
        // Skip lines that look like part of the echoed system prompt
        if (line.startsWith("# ") || line.startsWith("## ") ||
            line.startsWith("**Title:**") || line.startsWith("**Category:**") ||
            line.startsWith("You are analyzing") || line.startsWith("Think step by step")) {
          responseLines.shift();
          continue;
        }
        // If we see the echoed user prompt, skip it
        if (user.startsWith(line.slice(0, 30)) && line.length > 10) {
          responseLines.shift();
          continue;
        }
        break;
      }
    }

    // Strip any remaining "mcp startup" and blank lines at the start
    while (responseLines.length > 0) {
      const line = responseLines[0].trim();
      if (line === "" || line.startsWith("mcp startup")) {
        responseLines.shift();
        continue;
      }
      break;
    }

    // Also try the old approach as fallback
    if (responseLines.join("\n").trim() === "") {
      let providerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("provider:")) {
          providerIdx = i + 1;
          break;
        }
      }
      if (providerIdx >= 0) {
        responseLines = lines.slice(providerIdx);
      }
    }

    const rawResponse = responseLines.join("\n").trim();
    const response = sanitizeAIOutput(rawResponse);

    if (!response) throw new Error("Empty response from Codex CLI");
    return response;
  } catch (e) {
    const msg = (e as Error).message || String(e);
    // Also check stderr which may contain the actual error from codex
    const stderr = (e as { stderr?: string }).stderr || "";
    const combined = `${msg}\n${stderr}`;

    // Provide actionable diagnostics
    if (combined.includes("401") || combined.includes("Unauthorized") || combined.includes("auth error")) {
      throw new Error(
        `Codex CLI auth error: token expired or revoked. Run: codex auth login`
      );
    }
    if (combined.includes("usage limit") || combined.includes("rate limit") || combined.includes("429") || combined.includes("try again at")) {
      throw new Error(
        `Codex CLI rate limit: ${stderr.trim() || msg.slice(0, 300)}`
      );
    }
    if (combined.includes("not supported") || combined.includes("not found")) {
      throw new Error(
        `Codex CLI model "${model.model}" not supported with this account. ${stderr.trim().slice(0, 200)}`
      );
    }
    if (combined.includes("ETIMEDOUT") || combined.includes("timeout") || combined.includes("killed")) {
      throw new Error(
        `Codex CLI timed out after 120s. The model "${model.model}" may be slow or unavailable.`
      );
    }
    if (combined.includes("ENOENT")) {
      throw new Error(
        "Codex CLI binary disappeared during execution. Check: which codex"
      );
    }

    throw new Error(`Codex CLI failed: ${stderr.trim() || msg.slice(0, 500)}`);
  }
}

/**
 * Refresh the Codex CLI OAuth token using the refresh_token.
 * Same mechanism as openai-auth.ts but operates directly on the auth file
 * to ensure the CLI picks up the new token.
 */
async function refreshCodexAuth(
  authPath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authData: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readFileSync: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeFileSync: any
): Promise<void> {
  const refreshToken = authData?.tokens?.refresh_token;
  if (!refreshToken) {
    console.warn("[AI Router] No refresh_token — cannot auto-refresh codex auth");
    return;
  }

  try {
    const res = await fetch("https://auth0.openai.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: "DRivsnm2Mu42T3KOpqdtwB3NYviHYzwD",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[AI Router] Codex token refresh failed: HTTP ${res.status} — ${body.slice(0, 300)}`
      );
      return;
    }

    const data = await res.json();

    // Re-read auth file (in case it changed) and update
    const freshAuth = JSON.parse(readFileSync(authPath, "utf-8"));
    freshAuth.tokens.access_token = data.access_token;
    if (data.refresh_token) freshAuth.tokens.refresh_token = data.refresh_token;
    if (data.id_token) freshAuth.tokens.id_token = data.id_token;
    freshAuth.last_refresh = new Date().toISOString();
    writeFileSync(authPath, JSON.stringify(freshAuth, null, 2));

    console.log("[AI Router] Codex auth token refreshed and saved to disk");
  } catch (e) {
    console.error(
      `[AI Router] Codex token refresh error: ${(e as Error).message}`
    );
  }
}

async function callGemini(
  model: ModelConfig,
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const url = `${model.endpoint}/${model.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini ${res.status}`);
  return data.candidates[0].content.parts[0].text;
}
