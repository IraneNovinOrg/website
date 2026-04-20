/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { GITHUB_ORG, GITHUB_IDEAS_REPO, GITHUB_BOT_TOKEN, GITHUB_IDEAS_CATEGORY_ID } from "@/lib/constants";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(request: NextRequest) {
  const testAI = request.nextUrl.searchParams.get("test") === "ai";

  const results: Record<string, unknown> = {
    github: {
      org: GITHUB_ORG,
      repo: GITHUB_IDEAS_REPO,
      tokenSet: !!GITHUB_BOT_TOKEN,
      tokenPrefix: GITHUB_BOT_TOKEN ? GITHUB_BOT_TOKEN.slice(0, 10) + "..." : "NOT SET",
      categoryId: GITHUB_IDEAS_CATEGORY_ID || "NOT SET",
    },
    ai: {
      anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
      openaiKeySet: !!process.env.OPENAI_API_KEY,
      openaiOauthSet: !!process.env.OPENAI_OAUTH_TOKEN,
      openaiOauthPrefix: process.env.OPENAI_OAUTH_TOKEN
        ? process.env.OPENAI_OAUTH_TOKEN.slice(0, 15) + "..."
        : "NOT SET",
    },
    telegram: {
      botTokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || "NOT SET",
    },
  };

  // Load AI config
  try {
    const aiConfig = JSON.parse(
      readFileSync(join(process.cwd(), "_config", "ai.json"), "utf-8")
    );
    results.aiConfig = {
      defaultModel: aiConfig.defaultModel,
      fallbackOrder: aiConfig.fallbackOrder,
      enabledModels: Object.entries(aiConfig.models)
        .filter(([, v]: [string, any]) => v.enabled)
        .map(([k, v]: [string, any]) => `${k} (${v.provider}/${v.model})`),
      disabledModels: Object.entries(aiConfig.models)
        .filter(([, v]: [string, any]) => !v.enabled)
        .map(([k, v]: [string, any]) => `${k} (${v.provider}/${v.model})`),
    };
  } catch (e) {
    results.aiConfigError = String(e);
  }

  // Test AI if requested
  if (testAI) {
    const startMs = Date.now();
    try {
      const { callAI } = await import("@/lib/ai/router");
      const { text, model } = await callAI(
        "chat",
        "You are a helpful assistant. Respond in one sentence.",
        "Say hello and confirm you are working.",
        { maxTokens: 100 }
      );
      results.aiTest = {
        success: true,
        model,
        response: text,
        latencyMs: Date.now() - startMs,
      };
    } catch (e) {
      results.aiTest = {
        success: false,
        error: (e as Error)?.message || String(e),
        stack: (e as Error)?.stack?.split("\n").slice(0, 5),
        latencyMs: Date.now() - startMs,
      };
    }
  }

  return NextResponse.json(results);
}
