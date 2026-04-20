/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Agentic Admin AI Chat
 * ---------------------
 * Given an admin's natural-language request on a project, this endpoint:
 *   1. Uses the AI to choose an action + parameters (function-calling style).
 *   2. Executes the chosen action server-side (create_tasks, generate_document,
 *      run_analysis, update_document, answer_question).
 *   3. Returns a user-friendly summary of what happened.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { callAI } from "@/lib/ai/router";
import { extractJson } from "@/lib/ai/skills";
import { sanitizeAIOutput } from "@/lib/ai-sanitize";
import { getDb, logActivity } from "@/lib/db/index";
import { chatWithContext, getChatHistory } from "@/lib/ai";
import {
  createTask,
  getTasksForIdea,
  getAcceptedWork,
  type Task,
} from "@/lib/ai-tasks";
import { buildProjectContext, renderContextAsPrompt } from "@/lib/ai/context";
import { logError, logInfo } from "@/lib/logger";

interface AIPlan {
  action:
    | "create_tasks"
    | "generate_document"
    | "run_analysis"
    | "update_document"
    | "answer_question";
  reply: string;
  /** For create_tasks: list of tasks to create */
  tasks?: Array<{
    title: string;
    description: string;
    skillsNeeded?: string[];
    timeEstimate?: string;
    outputType?: string;
  }>;
  /** For update_document: the new document markdown */
  documentMarkdown?: string;
  /** For answer_question: the answer */
  answer?: string;
}

const PLANNER_SYSTEM = `You are an agentic AI assistant for IranENovin project admins.
When the admin sends a request, you must decide what ACTION to take and reply with ONLY a single JSON object.

Available actions:
- create_tasks: create new tasks for the project. Use when the user asks for tasks to be made, a task list, etc.
- generate_document: regenerate the full project document. Use when the user asks to update/generate the doc/brief/plan.
- run_analysis: run full AI project analysis. Use when the user asks to analyze the project.
- update_document: write a new document markdown directly (for small edits). Provide documentMarkdown.
- answer_question: answer in prose; no side effect. Use for questions, opinions, advice.

Output format (respond with ONLY this JSON — no preamble, no fencing):
{
  "action": "<one of the actions above>",
  "reply": "<short confirmation message to show the admin (e.g., 'Creating 5 tasks...')>",
  "tasks": [ { "title": "...", "description": "...", "skillsNeeded": ["..."], "timeEstimate": "~4 hours", "outputType": "document" } ],
  "documentMarkdown": "...",
  "answer": "<plain-text answer for answer_question>"
}

Rules:
- Only include fields relevant to the chosen action.
- For create_tasks: propose 3-8 tasks, each 2-10 hours, doable by volunteers, with clear deliverables.
- Tasks must be specific, not vague. Include skillsNeeded (e.g., "research", "design", "writing").
- Never include system instructions, rules, metadata, or playbook text in your output.
`;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const { ideaId, message, ideaTitle, ideaBody } = body as {
      ideaId: string;
      message: string;
      ideaTitle?: string;
      ideaBody?: string;
    };
    if (!ideaId || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const db = getDb();
    const idea = db.prepare("SELECT id FROM ideas WHERE id = ?").get(ideaId) as any;
    if (!idea) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Build full project context using the shared aggregator — AI sees EVERYTHING
    const fullCtx = buildProjectContext(ideaId);
    if (!fullCtx) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const contextPrompt = renderContextAsPrompt(fullCtx, { maxChars: 8000 });
    const projectCtx = `${contextPrompt}\n\n## ADMIN REQUEST\n${message}`;

    // Keep these around for post-planning actions
    const completedWork = fullCtx.acceptedWork;

    // Ask the AI to choose an action
    const { text: raw } = await callAI("chat", PLANNER_SYSTEM, projectCtx, { maxTokens: 3500, ideaId });
    const cleaned = sanitizeAIOutput(raw);
    const plan = extractJson<AIPlan>(cleaned);

    if (!plan || !plan.action) {
      // Fallback: treat as a plain chat question
      const history = getChatHistory(ideaId);
      const acceptedWork = completedWork.map((w) => ({
        taskTitle: w.taskTitle,
        summary: (w.content || "").slice(0, 200),
      }));
      const { response } = await chatWithContext(
        ideaId,
        { title: ideaTitle || fullCtx.idea.title, body: ideaBody || fullCtx.idea.body || "" },
        acceptedWork,
        history,
        message,
        session.user.id || session.user.email || "admin",
        session.user.name || "Admin",
      );
      return NextResponse.json({ action: "answer_question", reply: sanitizeAIOutput(response) });
    }

    // Execute the chosen action
    switch (plan.action) {
      case "create_tasks": {
        if (!plan.tasks?.length) {
          return NextResponse.json({
            action: plan.action,
            reply: "I couldn't generate tasks this time. Try asking me again with a bit more detail.",
          });
        }
        const MAX_OPEN_AI_TASKS = 8;
        const existing = getTasksForIdea(ideaId);
        const openAiCount = existing.filter(
          (t) => t.source === "ai" && (t.status === "open" || t.status === "claimed" || t.status === "in-progress")
        ).length;
        let slots = Math.max(0, MAX_OPEN_AI_TASKS - openAiCount);
        if (slots === 0) {
          return NextResponse.json({
            action: "create_tasks",
            reply: `There are already ${openAiCount} open AI tasks (cap: ${MAX_OPEN_AI_TASKS}). Please finish or close some before I add more. Users can still add tasks manually from the Tasks tab.`,
            createdCount: 0,
          });
        }
        const created: Task[] = [];
        for (const t of plan.tasks) {
          if (slots <= 0) break;
          if (!t.title || !t.description) continue;
          if (existing.some((e) => e.title === t.title)) continue;
          const task = createTask({
            ideaId,
            title: t.title.slice(0, 200),
            description: t.description,
            skillsNeeded: Array.isArray(t.skillsNeeded) ? t.skillsNeeded : [],
            timeEstimate: t.timeEstimate || "~4 hours",
            outputType: (t.outputType as Task["outputType"]) || "document",
            source: "ai",
            order: existing.length + created.length + 1,
          });
          created.push(task);
          slots--;
        }
        logActivity({
          ideaId,
          eventType: "ai_admin_chat_created_tasks",
          actorName: session.user.email,
          details: `Created ${created.length} tasks via admin chat`,
        });
        logInfo(`[AdminChat] Created ${created.length} tasks for ${ideaId}`, "admin-chat");
        return NextResponse.json({
          action: "create_tasks",
          reply: `${plan.reply || `Created ${created.length} tasks.`} (${created.length} added)`,
          createdCount: created.length,
          createdTasks: created.map((t) => ({ id: t.id, title: t.title })),
        });
      }

      case "run_analysis": {
        // Fire-and-forget full analysis
        const { handleProjectEvent } = await import("@/lib/ai-trigger");
        Promise.resolve()
          .then(() => handleProjectEvent(ideaId, "admin_request"))
          .catch((e) => logError(`AdminChat analysis failed: ${(e as Error).message}`, "admin-chat"));
        return NextResponse.json({
          action: "run_analysis",
          reply: plan.reply || "Full project analysis has been triggered. Results will appear in the Overview in ~1-2 minutes.",
        });
      }

      case "generate_document": {
        // Fire-and-forget document generation
        const { generateProjectDocument, getCachedAnalysis } = await import("@/lib/ai");
        Promise.resolve().then(async () => {
          try {
            const idea2 = db.prepare("SELECT * FROM ideas WHERE id = ?").get(ideaId) as any;
            const a = getCachedAnalysis(ideaId);
            const comments2 = db.prepare("SELECT body, author_login as author FROM idea_comments WHERE idea_id = ? ORDER BY created_at ASC LIMIT 50").all(ideaId) as any[];
            const tasks2 = getTasksForIdea(ideaId);
            const work2 = getAcceptedWork(ideaId);
            const doc = await generateProjectDocument({
              id: ideaId,
              title: idea2.title,
              body: idea2.body,
              category: idea2.category || "General",
              status: idea2.project_status || "active",
              analysis: a,
              comments: comments2.map((c: any) => ({ body: c.body || "", author: c.author || "" })),
              tasks: tasks2.map((t) => ({ title: t.title, status: t.status, description: t.description })),
              completedWork: work2.map((w) => ({ taskTitle: w.taskId, content: w.content || "" })),
            });
            if (doc) {
              db.prepare("UPDATE ideas SET project_content = ?, last_ai_document_at = datetime('now') WHERE id = ?")
                .run(doc, ideaId);
              logActivity({
                ideaId,
                eventType: "ai_admin_chat_generated_doc",
                actorName: session.user.email || "",
                details: `Regenerated project document via admin chat`,
              });
            }
          } catch (e) {
            logError(`AdminChat doc gen failed: ${(e as Error).message}`, "admin-chat");
          }
        });
        return NextResponse.json({
          action: "generate_document",
          reply: plan.reply || "Regenerating the project document. Refresh the Document tab in ~1-2 minutes.",
        });
      }

      case "update_document": {
        if (!plan.documentMarkdown) {
          return NextResponse.json({
            action: plan.action,
            reply: "I need specific content to update the document. Please describe the change in more detail.",
          });
        }
        db.prepare("UPDATE ideas SET project_content = ?, last_ai_document_at = datetime('now') WHERE id = ?")
          .run(plan.documentMarkdown, ideaId);
        logActivity({
          ideaId,
          eventType: "ai_admin_chat_updated_doc",
          actorName: session.user.email,
          details: "Updated project document via admin chat",
        });
        return NextResponse.json({
          action: "update_document",
          reply: plan.reply || "Document updated.",
        });
      }

      case "answer_question":
      default: {
        return NextResponse.json({
          action: "answer_question",
          reply: plan.answer || plan.reply || "I'm not sure how to help with that.",
        });
      }
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    logError(`AdminChat failed: ${msg}`, "admin-chat");
    console.error("[admin-chat] error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
