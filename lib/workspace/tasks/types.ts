import type { TaskPriority, TaskStatus } from "./constants";

export interface WorkspaceTask {
  id: string;
  ideaId: string;
  title: string;
  description: string;
  skillsNeeded: string[];
  timeEstimate: string;
  outputType: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  claimedAt: string | null;
  dueDate: string | null;
  source: string;
  parentTaskId: string | null;
  order: number;
  createdAt: string;
  priority: TaskPriority;
  labels: string[];
  sprintId: string | null;
  storyPoints: number | null;
  startDate: string | null;
  noteCount: number;
}
