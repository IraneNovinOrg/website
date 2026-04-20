/**
 * Shared workspace task constants — colors, labels, orderings.
 *
 * The four visible columns in the List and Board views group the six
 * underlying task statuses down to a friendlier 4-state pipeline so the UX
 * matches ClickUp's default grid without losing the legacy status values.
 */

export const TASK_STATUSES = [
  "open",
  "claimed",
  "in-progress",
  "submitted",
  "accepted",
  "changes-requested",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The 4 display columns shown in board / filters / stats. */
export type DisplayColumn = "todo" | "in-progress" | "in-review" | "done";

export const DISPLAY_COLUMNS: DisplayColumn[] = [
  "todo",
  "in-progress",
  "in-review",
  "done",
];

/** Map raw `tasks.status` → display column. */
export function statusToColumn(status: string): DisplayColumn {
  switch (status) {
    case "claimed":
    case "in-progress":
    case "changes-requested":
      return "in-progress";
    case "submitted":
      return "in-review";
    case "accepted":
      return "done";
    case "open":
    default:
      return "todo";
  }
}

/** When moving a card into a display column, default to this raw status. */
export function columnToStatus(column: DisplayColumn): TaskStatus {
  switch (column) {
    case "in-progress":
      return "in-progress";
    case "in-review":
      return "submitted";
    case "done":
      return "accepted";
    case "todo":
    default:
      return "open";
  }
}

export const STATUS_BADGE_CLASSES: Record<DisplayColumn, string> = {
  todo: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
  "in-progress":
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  "in-review":
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  done: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
