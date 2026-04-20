import { readFileSync } from "fs";
import { join } from "path";

const PLAYBOOK_DIR = join(process.cwd(), "_config", "ai-playbooks");
const SKILLS_DIR = join(process.cwd(), "_config", "ai-skills");

export function loadPlaybook(name: string): string {
  const filePath = join(PLAYBOOK_DIR, `${name}.md`);
  return readFileSync(filePath, "utf-8");
}

export function loadSkill(name: string): string {
  const filePath = join(SKILLS_DIR, `${name}.md`);
  return readFileSync(filePath, "utf-8");
}

export function loadSystemPrompt(): string {
  return loadPlaybook("system-prompt");
}

export function buildPrompt(
  playbook: string,
  variables: Record<string, string>
): string {
  let content = loadPlaybook(playbook);
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      value
    );
  }
  // Remove unfilled mustache-style blocks
  content = content.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, "");
  content = content.replace(/\{\{\w+\}\}/g, "");
  return content;
}
