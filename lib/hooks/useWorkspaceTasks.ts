"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import type { WorkspaceTask } from "@/lib/workspace/tasks/types";
import type { TaskStatus } from "@/lib/workspace/tasks/constants";

interface TasksResponse {
  tasks: WorkspaceTask[];
}

const fetcher = async (url: string): Promise<TasksResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
  return (await res.json()) as TasksResponse;
};

/**
 * ClickUp-style workspace tasks hook.
 *
 * Reads from the read-optimized aggregator and exposes optimistic helpers
 * for inline edits and drag-drop reorders. All writes go through the
 * workspace API wrappers which forward to `updateTaskFields` in ai-tasks.
 */
export function useWorkspaceTasks(projectId: string | null | undefined) {
  const key = projectId
    ? `/api/workspace/tasks?projectId=${encodeURIComponent(projectId)}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<TasksResponse>(
    key,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 2000 }
  );

  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  const patchTask = useCallback(
    async (
      id: string,
      patch: Partial<WorkspaceTask>
    ): Promise<WorkspaceTask | null> => {
      // Optimistic update
      const optimistic = tasks.map((t) =>
        t.id === id ? ({ ...t, ...patch } as WorkspaceTask) : t
      );
      await mutate({ tasks: optimistic }, { revalidate: false });
      try {
        const res = await fetch(`/api/workspace/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`Patch failed (${res.status})`);
        await mutate();
        const body = (await res.json()) as { task: WorkspaceTask };
        return body.task;
      } catch (err) {
        console.error("[useWorkspaceTasks] patchTask failed:", err);
        await mutate(); // revert via revalidate
        throw err;
      }
    },
    [tasks, mutate]
  );

  const moveTask = useCallback(
    async (
      id: string,
      newStatus: TaskStatus,
      newOrder?: number
    ): Promise<void> => {
      const optimistic = tasks.map((t) =>
        t.id === id ? { ...t, status: newStatus } : t
      );
      await mutate({ tasks: optimistic }, { revalidate: false });
      try {
        const res = await fetch("/api/workspace/tasks/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: id, newStatus, newOrder }),
        });
        if (!res.ok) throw new Error(`Reorder failed (${res.status})`);
        await mutate();
      } catch (err) {
        console.error("[useWorkspaceTasks] moveTask failed:", err);
        await mutate();
        throw err;
      }
    },
    [tasks, mutate]
  );

  return {
    tasks,
    isLoading,
    error,
    refresh: () => mutate(),
    patchTask,
    moveTask,
  };
}
