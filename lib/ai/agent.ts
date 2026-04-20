/**
 * AI Agent Orchestrator
 *
 * Handles agent events triggered by user actions (comments, task notes,
 * claims, submissions). Loads skill templates from _config/ai-skills/,
 * fills variables, calls the AI router, and executes resulting actions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { callAI } from "./router";
import { loadSkill } from "./playbooks";
import { extractJson } from "./skills";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentEvent {
  type: string; // "comment_added" | "task_note_added" | "task_submitted" | "task_claimed" | "help_offered" | "project_activated"
  ideaId: string;
  entityId?: string;   // task id, comment id, etc.
  actorId?: string;
  actorName?: string;
  content?: string;
}

export interface AgentAction {
  type: "post_comment" | "create_task" | "update_task" | "update_document" | "create_analysis";
  payload: Record<string, unknown>;
}

interface TriggerConfig {
  enabled: boolean;
  minLength?: number;
  aiReply?: boolean;
  autoReview?: boolean;
  runAnalysis?: boolean;
}

interface AgentConfig {
  version: number;
  enabled: boolean;
  cyclePeriodMinutes: number;
  maxAnalysesPerCycle: number;
  maxReviewsPerCycle: number;
  cooldownMinutes: number;
  triggers: Record<string, TriggerConfig>;
  skills: string[];
}

// ─── Cooldown tracking (in-memory per process) ─────────────────────────────

const cooldownMap = new Map<string, number>();

function isCoolingDown(ideaId: string, cooldownMinutes: number): boolean {
  const key = ideaId;
  const lastRun = cooldownMap.get(key);
  if (!lastRun) return false;
  return Date.now() - lastRun < cooldownMinutes * 60 * 1000;
}

function setCooldown(ideaId: string): void {
  cooldownMap.set(ideaId, Date.now());
}

// ─── Config & Skill Loading ────────────────────────────────────────────────

const CONFIG_PATH = join(process.cwd(), "_config", "agent.json");

function loadAgentConfig(): AgentConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error("Agent config not found at " + CONFIG_PATH);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

interface SkillMeta {
  name: string;
  trigger: string;
  model: string;
  maxTokens: number;
  action?: string;
  [key: string]: string | number | undefined;
}

function parseSkill(name: string): { template: string; meta: SkillMeta } {
  const raw = loadSkill(name);
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return {
      template: raw,
      meta: { name, trigger: "", model: "chat", maxTokens: 1000 },
    };
  }

  const meta: Record<string, string | number> = { name };
  for (const line of fmMatch[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const k = line.slice(0, colonIdx).trim();
    const v = line.slice(colonIdx + 1).trim();
    meta[k] = k === "maxTokens" ? parseInt(v, 10) : v;
  }

  return {
    template: fmMatch[2].trim(),
    meta: meta as unknown as SkillMeta,
  };
}

// ─── Variable Substitution ─────────────────────────────────────────────────

function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  // Remove unfilled variables
  result = result.replace(/\{\{\w+\}\}/g, "");
  return result;
}

// ─── Skill-to-Trigger Mapping ──────────────────────────────────────────────

const TRIGGER_SKILL_MAP: Record<string, string> = {
  comment_added: "reply-to-comment",
  task_note_added: "reply-to-task-note",
  task_submitted: "review-submission",
  task_claimed: "reply-to-task-note", // Acknowledge claim
  help_offered: "reply-to-comment",
  project_activated: "create-tasks",
};

// ─── Main Entry Point ──────────────────────────────────────────────────────

export async function handleAgentEvent(event: AgentEvent): Promise<void> {
  console.log(`[Agent] Handling event: ${event.type} for idea ${event.ideaId}`);

  // 1. Load config
  let config: AgentConfig;
  try {
    config = loadAgentConfig();
  } catch (e) {
    console.error("[Agent] Failed to load config:", e);
    return;
  }

  if (!config.enabled) {
    console.log("[Agent] Agent is disabled in config");
    return;
  }

  // 2. Check if trigger is enabled
  const triggerConfig = config.triggers[event.type];
  if (!triggerConfig?.enabled) {
    console.log(`[Agent] Trigger ${event.type} is disabled`);
    return;
  }

  // 3. Check minimum content length if configured
  if (triggerConfig.minLength && event.content) {
    if (event.content.length < triggerConfig.minLength) {
      console.log(`[Agent] Content too short (${event.content.length} < ${triggerConfig.minLength})`);
      return;
    }
  }

  // 4. Check cooldown
  if (isCoolingDown(event.ideaId, config.cooldownMinutes)) {
    console.log(`[Agent] Idea ${event.ideaId} is in cooldown`);
    return;
  }

  // 5. Gather context from SQLite
  const { getDb } = await import("../db/index");
  const db = getDb();

  const idea = db
    .prepare("SELECT * FROM ideas WHERE id = ?")
    .get(event.ideaId) as any;
  if (!idea) {
    console.error(`[Agent] Idea ${event.ideaId} not found`);
    return;
  }

  const comments = db
    .prepare(
      "SELECT body, author_login FROM idea_comments WHERE idea_id = ? ORDER BY created_at DESC LIMIT 10"
    )
    .all(event.ideaId) as any[];

  // 6. Find matching skill
  const skillName = TRIGGER_SKILL_MAP[event.type];
  if (!skillName) {
    console.log(`[Agent] No skill mapped for trigger ${event.type}`);
    return;
  }

  let skill: { template: string; meta: SkillMeta };
  try {
    skill = parseSkill(skillName);
  } catch (e) {
    console.error(`[Agent] Failed to load skill ${skillName}:`, e);
    return;
  }

  // 7. Build enriched variables with full project context
  // Gather help offers (team members)
  const helpOffers = db
    .prepare("SELECT name, skills, message FROM help_offers WHERE idea_id = ?")
    .all(event.ideaId) as any[];
  const memberSkills = helpOffers.length > 0
    ? helpOffers.map((h: any) => {
        const skills = h.skills ? JSON.parse(h.skills) : [];
        return `- ${h.name || "Anonymous"}: ${skills.join(", ") || "general"}`;
      }).join("\n")
    : "No team members yet.";

  // Gather previous AI analysis
  const analysis = db
    .prepare("SELECT full_analysis, summary FROM ai_analyses WHERE idea_id = ? ORDER BY generated_at DESC LIMIT 1")
    .get(event.ideaId) as any;
  const analysisContext = analysis?.summary || "Not analyzed yet.";

  // Gather all tasks summary
  const allTasks = db
    .prepare("SELECT title, status, assignee_name FROM tasks WHERE idea_id = ?")
    .all(event.ideaId) as any[];
  const taskSummary = allTasks.length > 0
    ? allTasks.map((t: any) => `- [${t.status}] ${t.title}${t.assignee_name ? ` (${t.assignee_name})` : ""}`).join("\n")
    : "No tasks yet.";

  const variables: Record<string, string> = {
    projectTitle: idea.title || "",
    projectBody: (idea.body || "").slice(0, 2000),
    projectCategory: idea.category || "General",
    projectStatus: idea.project_status || "idea",
    projectDocument: (idea.project_content || "").slice(0, 3000),
    memberSkills,
    analysisContext,
    taskSummary,
    recentComments: comments
      .map((c: any) => `${c.author_login || "Anonymous"}: ${(c.body || "").slice(0, 200)}`)
      .join("\n"),
    commentAuthor: event.actorName || "Unknown",
    commentBody: event.content || "",
  };

  // Add task-specific context if this is a task event
  if (event.entityId && ["task_note_added", "task_claimed", "task_submitted"].includes(event.type)) {
    const task = db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(event.entityId) as any;
    if (task) {
      variables.taskTitle = task.title || "";
      variables.taskDescription = task.description || "";
      variables.taskStatus = task.status || "";
      variables.taskAssignee = task.assignee_name || "Unassigned";

      const notes = db
        .prepare(
          "SELECT author_name, content FROM task_notes WHERE task_id = ? ORDER BY created_at DESC LIMIT 5"
        )
        .all(event.entityId) as any[];
      variables.previousNotes = notes
        .map((n: any) => `${n.author_name}: ${n.content.slice(0, 200)}`)
        .join("\n");
      variables.noteAuthor = event.actorName || "Unknown";
      variables.noteBody = event.content || "";
    }
  }

  // Add submission context for review events
  if (event.type === "task_submitted" && event.entityId) {
    const submission = db
      .prepare("SELECT * FROM submissions WHERE task_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(event.entityId) as any;
    if (submission) {
      variables.submissionType = submission.type || "inline";
      variables.submissionContent = (submission.content || "").slice(0, 8000);

      const task = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(event.entityId) as any;
      if (task) {
        variables.taskTitle = task.title || "";
        variables.taskDescription = task.description || "";
        variables.outputType = task.output_type || "document";
      }
    }
  }

  // 8. Fill template and call AI
  const prompt = fillTemplate(skill.template, variables);
  const modelTask = (skill.meta.model as string) || "chat";
  const maxTokens = (skill.meta.maxTokens as number) || 1000;

  try {
    const { text } = await callAI(modelTask, prompt, event.content || "Analyze and respond.", {
      maxTokens,
    });

    // 9. Parse response and execute actions
    await executeActions(event, skill.meta, text, db);

    // 10. Set cooldown and log
    setCooldown(event.ideaId);

    const { logActivity } = await import("../db/index");
    logActivity({
      ideaId: event.ideaId,
      eventType: `agent_${event.type}`,
      actorName: "AI Agent",
      details: `Skill: ${skillName}, Response length: ${text.length}`,
    });

    console.log(`[Agent] Successfully handled ${event.type} for ${event.ideaId}`);
  } catch (e) {
    console.error(`[Agent] AI call failed for ${event.type}:`, e);
  }
}

// ─── Action Execution ──────────────────────────────────────────────────────

async function executeActions(
  event: AgentEvent,
  meta: SkillMeta,
  aiResponse: string,
  db: any
): Promise<void> {
  const action = meta.action;

  // For reply skills (no explicit action), post a comment if response is not NULL
  if (!action || meta.trigger === "comment_added" || meta.trigger === "task_note_added") {
    const { sanitizeAIOutput } = await import("../ai-sanitize");
    const cleaned = sanitizeAIOutput(aiResponse).trim();

    // Skip if response is NULL/empty/too short, OR contains only "NULL" as first line
    const firstLine = cleaned.split("\n")[0]?.trim() || "";
    if (!cleaned || cleaned === "NULL" || firstLine === "NULL" || cleaned.length < 15) {
      console.log("[Agent] AI chose not to reply (NULL/empty/too short)");
      return;
    }

    // Strip any leading "NULL\n" if AI prepended it
    const finalText = cleaned.replace(/^NULL\s*\n+/i, "").trim();
    if (!finalText || finalText.length < 15) {
      console.log("[Agent] AI reply empty after cleaning");
      return;
    }

    if (meta.trigger === "task_note_added" && event.entityId) {
      // Add as a task note
      const { addTaskNote } = await import("../ai-tasks");
      addTaskNote(event.entityId, "ai-agent", "AI Assistant", finalText);
      console.log(`[Agent] Posted AI note on task ${event.entityId}`);
    } else {
      // Add as a comment on the idea
      const genId = () =>
        "cmt-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      db.prepare(
        `INSERT INTO idea_comments (id, idea_id, body, author_login, source, is_ai_reply, created_at)
         VALUES (?, ?, ?, ?, 'ai', 1, datetime('now'))`
      ).run(genId(), event.ideaId, finalText, "AI Assistant");
      console.log(`[Agent] Posted AI comment on idea ${event.ideaId}`);
    }
    return;
  }

  // For structured actions, parse JSON response
  if (action === "create_tasks") {
    try {
      const parsed = extractJson<any>(aiResponse);
      if (!parsed) {
        console.error("[Agent] Could not extract JSON from AI response for create_tasks. Start:", aiResponse.slice(0, 200));
        return;
      }
      const tasks = parsed.suggestedTasks || [];
      const { createTask, getTasksForIdea } = await import("../ai-tasks");
      const existing = getTasksForIdea(event.ideaId);

      for (const suggested of tasks) {
        if (existing.some((t) => t.title === suggested.title)) continue;
        createTask({
          ideaId: event.ideaId,
          title: suggested.title,
          description: suggested.description,
          skillsNeeded: suggested.skillsNeeded || [],
          timeEstimate: suggested.timeEstimate || "~2 hours",
          outputType: suggested.outputType || "document",
          source: "ai",
          order: suggested.order || 0,
        });
      }
      console.log(`[Agent] Created ${tasks.length} tasks for ${event.ideaId}`);
    } catch (e) {
      console.error("[Agent] Failed to parse/create tasks:", e);
    }
    return;
  }

  if (action === "update_task") {
    try {
      const review = extractJson<any>(aiResponse);
      if (!review) {
        console.error("[Agent] Could not extract JSON from AI response for update_task. Start:", aiResponse.slice(0, 200));
        return;
      }
      if (event.entityId) {
        // Find the latest submission for this task
        const sub = db
          .prepare(
            "SELECT id FROM submissions WHERE task_id = ? ORDER BY created_at DESC LIMIT 1"
          )
          .get(event.entityId) as any;
        if (sub) {
          const { setAIReview } = await import("../ai-tasks");
          setAIReview(sub.id, {
            ...review,
            generatedAt: new Date().toISOString(),
          });
          console.log(`[Agent] Set AI review for submission ${sub.id}`);
        }
      }
    } catch (e) {
      console.error("[Agent] Failed to parse/apply review:", e);
    }
    return;
  }

  if (action === "update_document") {
    try {
      db.prepare("UPDATE ideas SET project_content = ? WHERE id = ?").run(
        aiResponse,
        event.ideaId
      );
      console.log(`[Agent] Updated project document for ${event.ideaId}`);
    } catch (e) {
      console.error("[Agent] Failed to update document:", e);
    }
    return;
  }

  console.log(`[Agent] Unknown action: ${action}`);
}
