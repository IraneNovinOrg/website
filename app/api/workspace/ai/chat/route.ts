import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callAI } from "@/lib/ai/router";
import { loadPlaybook } from "@/lib/ai/playbooks";
import { getDb } from "@/lib/db";
import {
  type AIContext,
  summarizeContext,
} from "@/lib/workspace/aiContext";

/**
 * Workspace V2 AI Sidebar chat endpoint.
 *
 * Thin, additive wrapper around the existing `lib/ai/router.ts` router. We
 * deliberately do NOT fork `chatWithContext` (which is tied to the legacy
 * idea-scoped chat table) — instead we compose the existing playbooks at
 * request time and pass the full message list straight through to `callAI`.
 *
 * Auth: NextAuth session required.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  context?: AIContext;
  messages?: ChatMessage[];
  newMessage?: string;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === "user" || v.role === "assistant") &&
    typeof v.content === "string"
  );
}

interface IdeaRow {
  id: string;
  title: string;
  body: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
}

/**
 * Enrich the caller-supplied context by hydrating titles and a brief blurb
 * from SQLite. This keeps the client lightweight (it only sends ids/slugs)
 * while still giving the LLM something concrete to reason about.
 */
function enrichContext(ctx: AIContext): {
  enriched: AIContext;
  details: string;
} {
  let enriched: AIContext = { ...ctx };
  const detailLines: string[] = [];

  try {
    const db = getDb();

    if (ctx.projectId) {
      const idea = db
        .prepare("SELECT id, title, body FROM ideas WHERE id = ?")
        .get(ctx.projectId) as IdeaRow | undefined;
      if (idea) {
        enriched = { ...enriched, projectTitle: idea.title };
        if (idea.body) {
          detailLines.push(
            `Project description (truncated): ${idea.body.slice(0, 500)}`
          );
        }
      }
    }

    if (ctx.kind === "task" && ctx.taskId) {
      const task = db
        .prepare(
          "SELECT id, title, description, status, priority FROM tasks WHERE id = ?"
        )
        .get(ctx.taskId) as TaskRow | undefined;
      if (task) {
        enriched = { ...enriched, taskTitle: task.title };
        detailLines.push(`Task title: ${task.title}`);
        if (task.status) detailLines.push(`Task status: ${task.status}`);
        if (task.priority) detailLines.push(`Task priority: ${task.priority}`);
        if (task.description) {
          detailLines.push(
            `Task description (truncated): ${task.description.slice(0, 800)}`
          );
        }
      }
    }

    // Note: doc context enrichment was removed along with the Workspace V2
    // docs subsystem. Legacy documents live inside the idea row or external
    // Google Docs — the task/project context below is sufficient for the
    // rewritten clone.
  } catch (err) {
    // Context enrichment is best-effort — never let a DB hiccup fail the chat.
    console.warn("[workspace/ai/chat] context enrichment failed:", err);
  }

  return {
    enriched,
    details: detailLines.join("\n"),
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newMessage = typeof body.newMessage === "string" ? body.newMessage.trim() : "";
  if (!newMessage) {
    return NextResponse.json({ error: "Missing newMessage" }, { status: 400 });
  }

  const context: AIContext = body.context ?? { kind: "dashboard", url: "/" };
  const rawHistory = Array.isArray(body.messages) ? body.messages : [];
  const history: ChatMessage[] = rawHistory
    .filter(isChatMessage)
    .slice(-20); // cap context window

  // Compose the existing playbooks with the current workspace context.
  let systemBase: string;
  try {
    const systemPrompt = loadPlaybook("system-prompt");
    const chatRules = loadPlaybook("chat-rules");
    systemBase = `${systemPrompt}\n\n---\n\n${chatRules}`;
  } catch (err) {
    console.error("[workspace/ai/chat] failed to load playbooks:", err);
    return NextResponse.json(
      { error: "AI configuration unavailable" },
      { status: 500 }
    );
  }

  const { enriched, details } = enrichContext(context);
  const contextBlock = [
    `Current context: ${summarizeContext(enriched)}`,
    enriched.url ? `Current URL: ${enriched.url}` : "",
    details,
    "Keep answers concise, actionable, and scoped to this context. If the user asks about something outside it, answer briefly and suggest they navigate there.",
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `${systemBase}\n\n---\n\nWorkspace context:\n${contextBlock}`;

  try {
    const { text } = await callAI("chat", systemPrompt, newMessage, {
      maxTokens: 2000,
      messages: history,
    });
    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("[workspace/ai/chat] router failed:", err);
    return NextResponse.json(
      {
        error: "AI request failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
