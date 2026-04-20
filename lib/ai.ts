/* eslint-disable @typescript-eslint/no-explicit-any */
import { callAI } from "./ai/router";
import { loadSystemPrompt, buildPrompt } from "./ai/playbooks";
import { extractJson } from "./ai/skills";
import { sanitizeAIOutput, sanitizeDocumentOutput } from "./ai-sanitize";
import { getDb } from "./db/index";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AIAnalysis {
  ideaId: string;
  feasibility: "green" | "yellow" | "orange" | "red";
  feasibilityExplanation: string;
  summary: string;
  suggestedTasks: SuggestedTask[];
  dependencies: { ideaTitle: string; type: string }[];
  risks: string[];
  generatedAt: string;
  modelUsed: string;
  keyInsights?: string[];
  projectScope?: string;
}

export interface SuggestedTask {
  title: string;
  description: string;
  skillsNeeded: string[];
  timeEstimate: string;
  outputType: "document" | "code" | "design" | "data" | "analysis";
  order: number;
}

export interface AIReview {
  summary: string;
  coversRequirements: boolean;
  missingPoints: string[];
  qualityAssessment: string;
  suggestedImprovements: string[];
  generatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  authorId?: string;
  authorName?: string;
  timestamp: string;
}

function parseJSON<T>(text: string): T {
  const result = extractJson<T>(text);
  if (result === undefined) {
    throw new Error(
      `AI returned unparseable JSON. Start: ${text.slice(0, 200)}`
    );
  }
  return result;
}

// ─── Analysis: Read/Write from SQLite ────────────────────────────────────────

export function getCachedAnalysis(ideaId: string): AIAnalysis | null {
  const row = getDb()
    .prepare("SELECT * FROM ai_analyses WHERE idea_id = ?")
    .get(ideaId) as any;
  if (!row) return null;

  // full_analysis stores the complete JSON
  if (row.full_analysis) {
    try {
      return JSON.parse(row.full_analysis);
    } catch {
      // Fall through to construct from columns
    }
  }

  return {
    ideaId: row.idea_id,
    feasibility: row.feasibility || "yellow",
    feasibilityExplanation: row.feasibility_explanation || "",
    summary: row.summary || "",
    suggestedTasks: [],
    dependencies: [],
    risks: [],
    generatedAt: row.generated_at || "",
    modelUsed: row.model_used || "",
  };
}

function saveAnalysisToDb(analysis: AIAnalysis): void {
  getDb().prepare(`
    INSERT INTO ai_analyses (idea_id, feasibility, feasibility_explanation, summary, full_analysis, model_used, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(idea_id) DO UPDATE SET
      feasibility = excluded.feasibility,
      feasibility_explanation = excluded.feasibility_explanation,
      summary = excluded.summary,
      full_analysis = excluded.full_analysis,
      model_used = excluded.model_used,
      generated_at = excluded.generated_at
  `).run(
    analysis.ideaId,
    analysis.feasibility,
    analysis.feasibilityExplanation,
    analysis.summary,
    JSON.stringify(analysis),
    analysis.modelUsed,
    analysis.generatedAt
  );
}

// ─── Analyze Idea ───────────────────────────────────────────────────────────

export async function analyzeIdea(idea: {
  id: string;
  title: string;
  body: string;
  category: string;
  voteCount: number;
  commentBodies?: string[];
}): Promise<AIAnalysis> {
  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildPrompt("analyze-idea", {
    title: idea.title,
    body: idea.body.slice(0, 6000),
    category: idea.category,
    voteCount: String(idea.voteCount),
    comments: idea.commentBodies?.join("\n---\n") || "",
  });

  const { text, model } = await callAI("analysis", systemPrompt, userPrompt, { ideaId: idea.id });
  const parsed = parseJSON<Omit<AIAnalysis, "ideaId" | "generatedAt" | "modelUsed">>(text);

  // Validate that AI returned real analysis, not a template
  if (!parsed.summary || !parsed.feasibility ||
      parsed.feasibility.includes("|") ||
      parsed.summary.includes("A 2-3 sentence") ||
      parsed.summary.includes("executive summary of the idea") ||
      (parsed.feasibilityExplanation && parsed.feasibilityExplanation.includes("Explain specifically"))) {
    throw new Error(
      `AI returned template placeholder instead of real analysis. Model echoed prompt. Raw start: ${text.slice(0, 300)}`
    );
  }

  // Validate and fix task quality
  if (parsed.suggestedTasks) {
    for (const task of parsed.suggestedTasks) {
      const hoursMatch = task.timeEstimate?.match(/(\d+)/);
      const hours = hoursMatch ? parseInt(hoursMatch[1]) : 4;
      if (hours > 10) task.timeEstimate = "~8 hours";
      if (hours < 1) task.timeEstimate = "~2 hours";

      task.description = task.description.replace(
        /(\d{3,})\s*[-–to]+\s*(\d{3,})\s*[-\s]?word/gi,
        (match: string, _low: string, high: string) => {
          const highNum = parseInt(high);
          if (highNum > 500) return "300-500 word";
          return match;
        }
      );
      task.description = task.description.replace(/(\d{4,})\s*[-\s]?word/gi, "300-500 word");
    }
  }

  if (!parsed.keyInsights) parsed.keyInsights = [];
  if (!parsed.projectScope) parsed.projectScope = parsed.summary || "";

  const analysis: AIAnalysis = {
    ...parsed,
    ideaId: idea.id,
    generatedAt: new Date().toISOString(),
    modelUsed: model,
  };

  // Save to SQLite (single source of truth)
  saveAnalysisToDb(analysis);

  return analysis;
}

// ─── Review Submission ──────────────────────────────────────────────────────

export async function reviewSubmission(task: {
  title: string;
  description: string;
  outputType: string;
}, submission: {
  content: string;
  type: string;
}): Promise<AIReview> {
  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildPrompt("review-submission", {
    taskTitle: task.title,
    taskDescription: task.description,
    outputType: task.outputType,
    submissionType: submission.type,
    submissionContent: submission.content.slice(0, 8000),
  });

  const { text } = await callAI("review", systemPrompt, userPrompt, { maxTokens: 1500 });
  const parsed = parseJSON<Omit<AIReview, "generatedAt">>(text);
  return { ...parsed, generatedAt: new Date().toISOString() };
}

// ─── Suggest Next Tasks ─────────────────────────────────────────────────────

export async function suggestNextTasks(
  idea: { title: string; body: string },
  completedTasks: { title: string; submissionSummary: string }[]
): Promise<SuggestedTask[]> {
  const systemPrompt = loadSystemPrompt();
  const completedWork = completedTasks
    .map((t, i) => `${i + 1}. "${t.title}" — ${t.submissionSummary}`)
    .join("\n");

  const userPrompt = buildPrompt("suggest-next-steps", {
    title: idea.title,
    body: idea.body.slice(0, 3000),
    completedWork,
  });

  const { text } = await callAI("suggest", systemPrompt, userPrompt, { maxTokens: 2000 });
  return parseJSON<SuggestedTask[]>(text);
}

// ─── Chat (SQLite) ──────────────────────────────────────────────────────────

export async function chatWithContext(
  ideaId: string,
  idea: { title: string; body: string },
  completedWork: { taskTitle: string; summary: string }[],
  chatHistory: ChatMessage[],
  newMessage: string,
  authorId: string,
  authorName: string
): Promise<{ response: string; updatedHistory: ChatMessage[] }> {
  const systemPrompt = buildPrompt("chat-rules", {
    title: idea.title,
    body: idea.body.slice(0, 4000),
    completedWork: completedWork.length > 0
      ? completedWork.map((w) => `- ${w.taskTitle}: ${w.summary}`).join("\n")
      : "No work completed yet.",
  });

  const recentHistory = chatHistory.slice(-20).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const { text: rawResponse, model } = await callAI("chat", systemPrompt, newMessage, {
    maxTokens: 2000,
    messages: recentHistory,
    ideaId,
  });

  const response = sanitizeAIOutput(rawResponse);

  const now = new Date().toISOString();
  const userMsg: ChatMessage = { role: "user", content: newMessage, authorId, authorName, timestamp: now };
  const assistantMsg: ChatMessage = { role: "assistant", content: response, timestamp: now };
  const updatedHistory = [...chatHistory, userMsg, assistantMsg];

  // Save both messages to SQLite
  const db = getDb();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  db.prepare(
    "INSERT INTO ai_chat_messages (id, idea_id, role, content, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(genId(), ideaId, "user", newMessage, authorId, authorName, now);
  db.prepare(
    "INSERT INTO ai_chat_messages (id, idea_id, role, content, model_used, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(genId(), ideaId, "assistant", response, model, now);

  return { response, updatedHistory };
}

export function getChatHistory(ideaId: string): ChatMessage[] {
  const rows = getDb()
    .prepare("SELECT role, content, author_id, author_name, created_at FROM ai_chat_messages WHERE idea_id = ? ORDER BY created_at ASC")
    .all(ideaId) as any[];

  if (rows.length > 0) {
    return rows.map((r: any) => ({
      role: r.role,
      content: r.content,
      authorId: r.author_id || undefined,
      authorName: r.author_name || undefined,
      timestamp: r.created_at,
    }));
  }

  // Fallback: try to read from old JSON file (one-time migration)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsMod = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pathMod = require("path");
    const chatsDir = pathMod.join(process.cwd(), "_data", "ai-chats");
    const filePath = pathMod.join(chatsDir, `${ideaId}.json`);
    if (fsMod.existsSync(filePath)) {
      const history: ChatMessage[] = JSON.parse(fsMod.readFileSync(filePath, "utf-8"));
      // Migrate to SQLite
      const db = getDb();
      const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      for (const msg of history) {
        db.prepare(
          "INSERT OR IGNORE INTO ai_chat_messages (id, idea_id, role, content, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(genId(), ideaId, msg.role, msg.content, msg.authorId || null, msg.authorName || null, msg.timestamp);
      }
      return history;
    }
  } catch {
    // Fallback failed, return empty
  }

  return [];
}

export function saveChatHistory(ideaId: string, history: ChatMessage[]) {
  // No-op: chat messages are now saved individually in chatWithContext()
  // This function exists for backward compatibility but does nothing
  void ideaId;
  void history;
}

// ─── AI Auto-Reply to Comments ──────────────────────────────────────────────

export async function generateAIReply(
  idea: { title: string; body: string },
  comment: { body: string; authorName: string },
  recentComments: { body: string; authorName: string }[]
): Promise<string | null> {
  const systemPrompt = loadSystemPrompt();
  const context = `You are the AI assistant for the project "${idea.title}".
A community member just posted a comment. Your job is to:
1. If the comment asks a question → provide a brief, helpful answer based on the project description
2. If the comment suggests something → acknowledge it briefly and note if it aligns with the project goals
3. If the comment is just social (greeting, thanks) → DO NOT reply (return null)
4. If the comment is very short (<20 words) → DO NOT reply

Keep your reply to 2-3 sentences MAX. Be helpful, concise, and professional.
Do NOT be chatty or overly friendly. Do NOT repeat information already in the project description.
If you have nothing useful to add, respond with exactly: NULL

Project: ${idea.title}
Project description (first 2000 chars): ${idea.body.slice(0, 2000)}

Recent discussion:
${recentComments.slice(-5).map(c => `${c.authorName}: ${c.body.slice(0, 200)}`).join("\n")}
`;

  const userMsg = `${comment.authorName} wrote: "${comment.body}"

Respond with a brief, helpful reply or exactly "NULL" if no reply is needed.`;

  try {
    const { text } = await callAI("chat", context + "\n" + systemPrompt, userMsg, { maxTokens: 300 });
    const trimmed = text.trim();
    if (trimmed === "NULL" || trimmed.length < 10) return null;
    return trimmed;
  } catch {
    return null;
  }
}

// ─── Generate Project Document ──────────────────────────────────────────────

export async function generateProjectDocument(project: {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  analysis: AIAnalysis | null;
  comments: { body: string; author: string }[];
  tasks: { title: string; status: string; description: string }[];
  completedWork: { taskTitle: string; content: string }[];
}): Promise<string> {
  const systemPrompt = loadSystemPrompt();

  const commentsSummary = project.comments.length > 0
    ? project.comments.slice(0, 20).map((c, i) => `${i + 1}. ${c.author}: ${c.body.slice(0, 200)}`).join("\n")
    : "No community discussion yet.";

  const tasksSummary = project.tasks.length > 0
    ? project.tasks.map(t => `- [${t.status}] ${t.title}`).join("\n")
    : "No tasks generated yet.";

  const completedWork = project.completedWork.length > 0
    ? project.completedWork.map(w => `### ${w.taskTitle}\n${w.content.slice(0, 500)}`).join("\n\n")
    : "No work completed yet.";

  const userPrompt = buildPrompt("generate-project-doc", {
    title: project.title,
    body: project.body.slice(0, 6000),
    category: project.category,
    status: project.status,
    analysis: project.analysis ? JSON.stringify({
      feasibility: project.analysis.feasibility,
      summary: project.analysis.summary,
      risks: project.analysis.risks,
    }) : "Not analyzed yet.",
    commentsSummary,
    tasksSummary,
    completedWork,
  });

  const { text } = await callAI("summary", systemPrompt, userPrompt, { maxTokens: 4000 });
  return sanitizeDocumentOutput(text);
}
