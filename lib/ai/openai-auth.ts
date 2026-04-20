/**
 * OpenAI OAuth Token Manager
 *
 * Reads tokens from ~/.codex/auth.json (same as Codex CLI).
 * Auto-refreshes when the access_token expires.
 * Falls back to OPENAI_OAUTH_TOKEN env var.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CODEX_AUTH_PATH = join(
  process.env.HOME || process.env.USERPROFILE || "/tmp",
  ".codex",
  "auth.json"
);

// OpenAI's OAuth endpoint — same as Codex CLI
const TOKEN_ENDPOINT = "https://auth0.openai.com/oauth/token";
const CLIENT_ID = "DRivsnm2Mu42T3KOpqdtwB3NYviHYzwD";

interface CodexAuth {
  OPENAI_API_KEY: string | null;
  tokens: {
    id_token: string;
    access_token: string;
    refresh_token: string;
    account_id: string;
  };
  last_refresh: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getOpenAIToken(): Promise<string | null> {
  // Memory cache
  if (cachedToken && Date.now() < tokenExpiresAt) {
    console.log("[OpenAI Auth] Using cached token");
    return cachedToken;
  }

  // Env var override
  if (process.env.OPENAI_OAUTH_TOKEN) {
    console.log("[OpenAI Auth] Using OPENAI_OAUTH_TOKEN env var");
    cachedToken = process.env.OPENAI_OAUTH_TOKEN;
    tokenExpiresAt = Date.now() + 50 * 60 * 1000;
    return cachedToken;
  }

  // Read Codex auth file
  console.log(`[OpenAI Auth] Looking for codex auth at: ${CODEX_AUTH_PATH}`);

  if (!existsSync(CODEX_AUTH_PATH)) {
    console.warn(`[OpenAI Auth] File not found: ${CODEX_AUTH_PATH}`);
    return null;
  }

  try {
    const raw = readFileSync(CODEX_AUTH_PATH, "utf-8");
    const auth: CodexAuth = JSON.parse(raw);

    if (!auth.tokens?.access_token) {
      console.warn("[OpenAI Auth] No access_token in codex auth file");
      return null;
    }

    console.log(`[OpenAI Auth] Found token (${auth.tokens.access_token.slice(0, 20)}...)`);
    console.log(`[OpenAI Auth] Last refresh: ${auth.last_refresh}`);

    // Check age
    const lastRefresh = new Date(auth.last_refresh).getTime();
    const ageMs = Date.now() - lastRefresh;
    const ageMinutes = Math.round(ageMs / 60000);
    console.log(`[OpenAI Auth] Token age: ${ageMinutes} minutes`);

    if (ageMs > 55 * 60 * 1000 && auth.tokens.refresh_token) {
      console.log("[OpenAI Auth] Token > 55 min old, refreshing...");
      const newToken = await refreshAccessToken(auth.tokens.refresh_token);
      if (newToken) {
        auth.tokens.access_token = newToken.access_token;
        if (newToken.refresh_token) auth.tokens.refresh_token = newToken.refresh_token;
        auth.last_refresh = new Date().toISOString();
        writeFileSync(CODEX_AUTH_PATH, JSON.stringify(auth, null, 2));
        console.log("[OpenAI Auth] Token refreshed and saved");
        cachedToken = newToken.access_token;
        tokenExpiresAt = Date.now() + 55 * 60 * 1000;
        return cachedToken;
      }
      console.warn("[OpenAI Auth] Refresh failed, using existing token anyway");
    }

    // Use existing token (even if old — let the API reject it)
    cachedToken = auth.tokens.access_token;
    tokenExpiresAt = Date.now() + 10 * 60 * 1000; // re-check in 10 min
    return cachedToken;
  } catch (e) {
    console.error("[OpenAI Auth] Error reading codex auth:", e);
    return null;
  }
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    console.log(`[OpenAI Auth] POST ${TOKEN_ENDPOINT}`);
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[OpenAI Auth] Refresh failed: ${res.status} — ${body}`);
      return null;
    }

    const data = await res.json();
    console.log("[OpenAI Auth] Refresh succeeded");
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
  } catch (e) {
    console.error("[OpenAI Auth] Refresh error:", e);
    return null;
  }
}
