import { describe, it, expect } from "vitest";
import {
  buildAIContextFromPathname,
  summarizeContext,
  contextKey,
} from "@/lib/workspace/aiContext";

describe("buildAIContextFromPathname", () => {
  it("parses a task route into a task context", () => {
    const ctx = buildAIContextFromPathname(
      "/en/workspace/p/my-project/tasks/task-123"
    );
    expect(ctx).toEqual({
      kind: "task",
      projectId: "my-project",
      taskId: "task-123",
      url: "/en/workspace/p/my-project/tasks/task-123",
    });
  });

  it("parses a doc route into a doc context", () => {
    const ctx = buildAIContextFromPathname(
      "/fa/workspace/p/my-project/docs/doc-42"
    );
    expect(ctx.kind).toBe("doc");
    expect(ctx.projectId).toBe("my-project");
    expect(ctx.docId).toBe("doc-42");
  });

  it("parses a project route into a project context", () => {
    const ctx = buildAIContextFromPathname("/en/workspace/p/my-project");
    expect(ctx.kind).toBe("project");
    expect(ctx.projectId).toBe("my-project");
  });

  it("parses a task list (no taskId) as a project context", () => {
    const ctx = buildAIContextFromPathname("/en/workspace/p/my-project/tasks");
    expect(ctx.kind).toBe("project");
    expect(ctx.projectId).toBe("my-project");
  });

  it("parses the workspace root as the dashboard context", () => {
    const ctx = buildAIContextFromPathname("/en/workspace");
    expect(ctx.kind).toBe("dashboard");
  });

  it("handles unknown routes as dashboard", () => {
    const ctx = buildAIContextFromPathname("/en/projects/foo");
    expect(ctx.kind).toBe("dashboard");
  });

  it("builds a human-readable summary for a task context", () => {
    const summary = summarizeContext({
      kind: "task",
      projectId: "my-project",
      projectTitle: "My Project",
      taskId: "task-123",
      taskTitle: "Ship v2",
      url: "/en/workspace/p/my-project/tasks/task-123",
    });
    expect(summary).toContain("My Project");
    expect(summary).toContain("Ship v2");
  });

  it("derives a stable context key per scope", () => {
    expect(
      contextKey(buildAIContextFromPathname("/en/workspace/p/foo/tasks/t1"))
    ).toBe("task:foo:t1");
    expect(
      contextKey(buildAIContextFromPathname("/en/workspace/p/foo"))
    ).toBe("project:foo");
  });
});
