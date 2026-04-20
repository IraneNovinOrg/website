/**
 * AI Sidebar context builder.
 *
 * Parses workspace V2 pathnames to derive what the user is currently looking
 * at so the AI assistant can scope its answers. Intentionally pathname-driven
 * so it works both client-side (usePathname) and server-side (route handler)
 * without requiring any shared global state.
 */

export type AIContextKind = "dashboard" | "project" | "task" | "doc";

export interface AIContext {
  kind: AIContextKind;
  projectId?: string;
  projectTitle?: string;
  taskId?: string;
  taskTitle?: string;
  docId?: string;
  docTitle?: string;
  url: string;
}

/**
 * Strip the leading locale segment (en/fa) from a pathname, if present.
 * Returns the tail without a leading slash.
 */
function stripLocale(pathname: string): string {
  // Normalize: drop query/hash, collapse trailing slash
  const clean = pathname.split("?")[0].split("#")[0].replace(/\/+$/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts[0] === "en" || parts[0] === "fa") {
    return parts.slice(1).join("/");
  }
  return parts.join("/");
}

/**
 * Derive an `AIContext` from a pathname.
 *
 * Recognized routes (after locale stripping):
 *   workspace                               -> dashboard
 *   workspace/p/<slug>                      -> project
 *   workspace/p/<slug>/tasks                -> project (task list)
 *   workspace/p/<slug>/tasks/<id>           -> task
 *   workspace/p/<slug>/docs                 -> project (docs root)
 *   workspace/p/<slug>/docs/<id>            -> doc
 *
 * Anything else falls back to `dashboard`.
 */
export function buildAIContextFromPathname(pathname: string): AIContext {
  const url = pathname;
  const tail = stripLocale(pathname);
  const parts = tail.split("/").filter(Boolean);

  if (parts[0] !== "workspace") {
    return { kind: "dashboard", url };
  }

  // /workspace
  if (parts.length === 1) {
    return { kind: "dashboard", url };
  }

  // /workspace/p/<slug>...
  if (parts[1] === "p" && parts[2]) {
    const projectId = parts[2];
    const section = parts[3];
    const subId = parts[4];

    if (section === "tasks" && subId) {
      return { kind: "task", projectId, taskId: subId, url };
    }
    if (section === "docs" && subId) {
      return { kind: "doc", projectId, docId: subId, url };
    }
    // /workspace/p/<slug>, /workspace/p/<slug>/tasks, /workspace/p/<slug>/docs
    return { kind: "project", projectId, url };
  }

  return { kind: "dashboard", url };
}

/**
 * Human-readable one-liner for the breadcrumb/system-prompt context block.
 * Prefers resolved titles when the caller has looked them up, otherwise falls
 * back to the slug/id found in the URL.
 */
export function summarizeContext(ctx: AIContext): string {
  switch (ctx.kind) {
    case "dashboard":
      return "Workspace dashboard";
    case "project": {
      const label = ctx.projectTitle || ctx.projectId || "unknown project";
      return `Project: ${label}`;
    }
    case "task": {
      const project = ctx.projectTitle || ctx.projectId || "unknown project";
      const task = ctx.taskTitle || ctx.taskId || "unknown task";
      return `Project: ${project} -> Task: ${task}`;
    }
    case "doc": {
      const project = ctx.projectTitle || ctx.projectId || "unknown project";
      const doc = ctx.docTitle || ctx.docId || "untitled page";
      return `Project: ${project} -> Doc: ${doc}`;
    }
    default:
      return "Workspace";
  }
}

/**
 * Stable key for localStorage history persistence. One bucket per distinct
 * context so switching between a task and its project doesn't clobber replies.
 */
export function contextKey(ctx: AIContext): string {
  switch (ctx.kind) {
    case "dashboard":
      return "dashboard";
    case "project":
      return `project:${ctx.projectId ?? "unknown"}`;
    case "task":
      return `task:${ctx.projectId ?? "unknown"}:${ctx.taskId ?? "unknown"}`;
    case "doc":
      return `doc:${ctx.projectId ?? "unknown"}:${ctx.docId ?? "unknown"}`;
    default:
      return "dashboard";
  }
}
