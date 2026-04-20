"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Circle,
  Clock,
  CheckCircle2,
  Plus,
  User,
  Layout,
  List,
  Trash2,
  Edit3,
  AlertCircle,
  Save,
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  CornerDownRight,
  MessageCircle,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type Any,
  type ProjectTask,
  type TaskNote,
  type TaskSubmission,
  type SubmissionAttachment,
  PRIORITY_STYLES,
  TIME_ESTIMATES,
  SKILL_TYPES,
  TASK_STATUSES,
  timeAgo,
  mapTaskStatus,
  getPriorityKey,
} from "../types";

const REACTION_TYPES = [
  { type: "upvote", emoji: "\uD83D\uDC4D", label: "Upvote" },
  { type: "heart", emoji: "\u2764\uFE0F", label: "Heart" },
  { type: "rocket", emoji: "\uD83D\uDE80", label: "Rocket" },
  { type: "eyes", emoji: "\uD83D\uDC40", label: "Eyes" },
  { type: "party", emoji: "\uD83C\uDF89", label: "Party" },
] as const;

export function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

interface TasksTabProps {
  tasks: ProjectTask[];
  session: Any;
  ideaId: string;
  isAdmin: boolean;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  refresh: () => void;
  onAuthOpen: () => void;
}

export default function TasksTab({
  tasks,
  session,
  ideaId,
  isAdmin,
  t,
  tCommon,
  refresh,
  onAuthOpen,
}: TasksTabProps) {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskTimeEstimate, setTaskTimeEstimate] = useState("~2 hours");
  const [taskSkillType, setTaskSkillType] = useState("research");
  const [submittingTask, setSubmittingTask] = useState(false);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || taskDescription.length < 50) return;
    if (!session) { onAuthOpen(); return; }
    setSubmittingTask(true);
    try {
      const res = await fetch(`/api/projects/${ideaId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, description: taskDescription, timeEstimate: taskTimeEstimate, skillType: taskSkillType }),
      });
      if (res.ok) { setTaskTitle(""); setTaskDescription(""); setShowCreate(false); refresh(); toast.success(t("submitProposal")); }
    } catch (e) { console.error(e); toast.error("Something went wrong. Please try again."); } finally { setSubmittingTask(false); }
  };

  const handleClaimTask = async (taskId: string) => {
    if (!session) { onAuthOpen(); return; }
    setClaimingTask(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/claim`, { method: "POST" });
      if (res.ok) {
        toast.success("Task claimed! You can now submit your work.");
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to claim task");
      }
    } catch (e) { console.error(e); toast.error("Something went wrong. Please try again."); } finally { setClaimingTask(null); }
  };

  // Task detail view — render even during revalidation; don't reset selection
  if (selectedTask) {
    const task = tasks.find((tk) => tk.id === selectedTask);
    if (!task) {
      // Task not found in current list (likely SWR revalidating). Show loading
      // state and keep selectedTask so we don't jump out of the detail view.
      return (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <span>Loading task...</span>
        </div>
      );
    }
    return (
      <TaskDetailView
        task={task}
        ideaId={ideaId}
        t={t}
        tCommon={tCommon}
        session={session}
        refresh={refresh}
        onAuthOpen={onAuthOpen}
        onBack={() => setSelectedTask(null)}
        onClaimTask={handleClaimTask}
        claimingTask={claimingTask}
        isAdmin={isAdmin}
      />
    );
  }

  const grouped: Record<string, ProjectTask[]> = { open: [], "in-progress": [], "in-review": [], done: [] };
  tasks.forEach((task) => { grouped[mapTaskStatus(task.status)].push(task); });

  const statusLabels: Record<string, string> = {
    open: t("open"),
    "in-progress": t("inProgress"),
    "in-review": t("inReview"),
    done: t("done"),
  };

  const statusColors: Record<string, string> = {
    open: "border-t-gray-400",
    "in-progress": "border-t-blue-500",
    "in-review": "border-t-amber-500",
    done: "border-t-green-500",
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <button
            onClick={() => setViewMode("board")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "board" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Layout className="mr-1 inline h-4 w-4" /> {t("board")}
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="mr-1 inline h-4 w-4" /> {t("list")}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => { if (!session) { onAuthOpen(); return; } setShowCreate(true); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("createTask")}
        </Button>
      </div>

      {/* Create task form */}
      {showCreate && (
        <form onSubmit={handleCreateTask} className="mb-6 space-y-3 rounded-lg border border-border p-4">
          <h3 className="font-medium">{t("createTask")}</h3>
          <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={t("taskTitle")} required />
          <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder={t("descriptionMinLength")} rows={4} required />
          {taskDescription.length > 0 && taskDescription.length < 50 && (
            <p className="text-xs text-red-500">{t("descriptionMinLength")}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("timeEstimate")}</label>
              <select value={taskTimeEstimate} onChange={(e) => setTaskTimeEstimate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                {TIME_ESTIMATES.map((te) => (<option key={te} value={te}>{te}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("skillType")}</label>
              <select value={taskSkillType} onChange={(e) => setTaskSkillType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                {SKILL_TYPES.map((st) => (<option key={st} value={st}>{st}</option>))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submittingTask || !taskTitle.trim() || taskDescription.length < 50} className="bg-primary text-white hover:bg-primary/90">
              {t("submitProposal")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{tCommon("cancel")}</Button>
          </div>
        </form>
      )}

      {/* Board view */}
      {viewMode === "board" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {TASK_STATUSES.map((status) => (
            <div key={status} className={`rounded-lg border border-border border-t-4 ${statusColors[status]} bg-muted/30 p-3`}>
              <h3 className="mb-3 text-sm font-semibold">
                {statusLabels[status]} <span className="text-muted-foreground">({grouped[status].length})</span>
              </h3>
              <div className="space-y-2">
                {grouped[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    t={t}
                    onClick={() => setSelectedTask(task.id)}
                    onClaim={() => handleClaimTask(task.id)}
                    claiming={claimingTask === task.id}
                    session={session}
                  />
                ))}
                {grouped[status].length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">--</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
              <p>{t("noTasks")}</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                onClick={() => setSelectedTask(task.id)}
              >
                <TaskStatusIcon status={task.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{task.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {task.assigneeName && <span className="text-xs text-muted-foreground">{task.assigneeName}</span>}
                  <Badge variant="outline" className="text-[10px]">{statusLabels[mapTaskStatus(task.status)]}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---- TaskCard ----

function TaskCard({ task, t, onClick, onClaim, claiming, session }: {
  task: ProjectTask;
  t: (key: string) => string;
  onClick: () => void;
  onClaim: () => void;
  claiming: boolean;
  session: Any;
}) {
  const mapped = mapTaskStatus(task.status);
  const priorityKey = getPriorityKey(task.timeEstimate);

  return (
    <div className="cursor-pointer rounded-lg border border-border bg-white p-3 transition-shadow hover:shadow-md dark:bg-gray-900" onClick={onClick}>
      <p className="mb-1 text-sm font-medium">{task.title}</p>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_STYLES[priorityKey]}`} />
        {task.skillsNeeded.slice(0, 2).map((skill) => (
          <Badge key={skill} variant="outline" className="text-[9px]">{skill}</Badge>
        ))}
      </div>
      <div className="flex items-center justify-between">
        {task.assigneeName ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><User className="h-3 w-3" /> {task.assigneeName}</span>
        ) : <span />}
        {task.submissions.length > 0 && <span className="text-[10px] text-muted-foreground">{task.submissions.length} sub</span>}
      </div>
      {mapped === "open" && session && (
        <Button size="sm" className="mt-2 h-7 w-full text-xs" onClick={(e) => { e.stopPropagation(); onClaim(); }} disabled={claiming}>
          {claiming ? "..." : t("claimTask")}
        </Button>
      )}
    </div>
  );
}

// ---- TaskStatusIcon ----

function TaskStatusIcon({ status }: { status: string }) {
  const mapped = mapTaskStatus(status);
  switch (mapped) {
    case "open": return <Circle className="h-4 w-4 shrink-0 text-gray-400" />;
    case "in-progress": return <Clock className="h-4 w-4 shrink-0 text-blue-500" />;
    case "in-review": return <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />;
    case "done": return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />;
    default: return <Circle className="h-4 w-4 shrink-0 text-gray-400" />;
  }
}

// ---- TaskDetailView ----

function TaskDetailView({
  task, ideaId, t, tCommon, session, refresh, onAuthOpen, onBack, onClaimTask, claimingTask, isAdmin,
}: {
  task: ProjectTask;
  ideaId: string;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  session: Any;
  refresh: () => void;
  onAuthOpen: () => void;
  onBack: () => void;
  onClaimTask: (id: string) => void;
  claimingTask: string | null;
  isAdmin: boolean;
}) {
  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editTimeEstimate, setEditTimeEstimate] = useState(task.timeEstimate);
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const mapped = mapTaskStatus(task.status);
  const priorityKey = getPriorityKey(task.timeEstimate);

  const currentUserId = (session?.user as Any)?.id || session?.user?.email || "";
  const currentUserName = session?.user?.name || session?.user?.email || "";
  const isAssignee = task.assigneeId === currentUserId || task.assigneeName === currentUserName;

  const statusLabel = mapped === "open" ? "Open" : mapped === "in-progress" ? "In Progress" : mapped === "in-review" ? "In Review" : "Completed";

  const handlePostNote = async () => {
    if (!noteText.trim()) return;
    if (!session) { onAuthOpen(); return; }
    setPostingNote(true);
    try {
      await fetch(`/api/tasks/${task.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText, replyTo: replyingTo }),
      });
      setNoteText("");
      setReplyingTo(null);
      refresh();
    } catch (e) { console.error(e); toast.error("Something went wrong. Please try again."); } finally { setPostingNote(false); }
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: File[] = [];
    for (const f of arr) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 10MB limit`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) {
      setPendingFiles((prev) => [...prev, ...valid]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSubmitWork = async () => {
    if (!submitText.trim() && pendingFiles.length === 0) return;
    if (!session) { onAuthOpen(); return; }
    setSubmitting(true);
    try {
      // Upload files first (one by one) to collect URLs
      const uploaded: SubmissionAttachment[] = [];
      for (const f of pendingFiles) {
        setUploadingFile(f.name);
        const fd = new FormData();
        fd.append("file", f);
        fd.append("ideaId", ideaId);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          toast.error(err.error || `Failed to upload ${f.name}`);
          setSubmitting(false);
          setUploadingFile(null);
          return;
        }
        const data = await uploadRes.json();
        uploaded.push({
          url: data.url,
          filename: data.filename,
          size: data.size,
          mimeType: data.mimeType,
        });
      }
      setUploadingFile(null);

      const res = await fetch(`/api/tasks/${task.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "inline", content: submitText, attachments: uploaded }),
      });
      if (res.ok) {
        setSubmitText("");
        setPendingFiles([]);
        setShowSubmitForm(false);
        refresh();
        toast.success(t("submitWork"));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to submit");
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadingFile(null);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </button>

      <div className="rounded-lg border border-border p-6">
        {/* Header badges */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge className={mapped === "done" ? "bg-green-100 text-green-700" : mapped === "in-progress" ? "bg-blue-100 text-blue-700" : mapped === "in-review" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}>
            {statusLabel}
          </Badge>
          <Badge variant="outline">
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${PRIORITY_STYLES[priorityKey]}`} />
            {t(priorityKey)}
          </Badge>
          {task.skillsNeeded.map((skill) => (
            <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
          ))}
        </div>

        <h2 className="mb-2 text-2xl font-bold">{task.title}</h2>

        {/* Admin controls */}
        {isAdmin && !editingTask && (
          <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Admin:</span>
            <button onClick={() => setEditingTask(true)} className="flex items-center gap-1 text-xs text-amber-700 hover:underline dark:text-amber-400">
              <Edit3 className="h-3 w-3" /> Edit Task
            </button>
            <button
              onClick={async () => {
                if (!confirm("Mark this task as completed?")) return;
                await fetch("/api/admin/ai-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete-task", taskId: task.id }) });
                toast.success("Task marked complete!"); refresh();
              }}
              className="flex items-center gap-1 text-xs text-amber-700 hover:underline dark:text-amber-400"
            >
              <CheckCircle2 className="h-3 w-3" /> Mark Complete
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete this task? This cannot be undone.")) return;
                await fetch("/api/admin/ai-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-task", taskId: task.id }) });
                toast.success("Task deleted!"); onBack(); refresh();
              }}
              className="flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
            >
              <Trash2 className="h-3 w-3" /> Delete Task
            </button>
          </div>
        )}

        {/* Admin edit form */}
        {isAdmin && editingTask && (
          <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Task title" className="text-sm" />
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Task description" rows={4} className="text-sm" />
            <select value={editTimeEstimate} onChange={(e) => setEditTimeEstimate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              {TIME_ESTIMATES.map((te) => (<option key={te} value={te}>{te}</option>))}
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await fetch("/api/admin/ai-action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "edit-task", taskId: task.id, data: { title: editTitle, description: editDescription, timeEstimate: editTimeEstimate } }),
                  });
                  toast.success("Task updated!"); setEditingTask(false); refresh();
                }}
                className="bg-primary text-white hover:bg-primary/90"
              >
                <Save className="mr-1 h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingTask(false)}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="mb-4"><MarkdownRenderer content={task.description} /></div>

        {/* Assignee info */}
        <div className="mb-4 rounded-lg bg-muted/50 p-3">
          <p className="text-sm"><span className="font-medium">{t("assignee")}:</span> {task.assigneeName || t("unassigned")}</p>
          {task.claimedAt && <p className="text-xs text-muted-foreground">Claimed {timeAgo(task.claimedAt)}</p>}
          {task.timeEstimate && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {task.timeEstimate}</p>}
        </div>

        {/* Action buttons */}
        <div className="mb-6 flex flex-wrap gap-2">
          {mapped === "open" && (
            <Button onClick={() => { if (!session) { onAuthOpen(); return; } onClaimTask(task.id); }} disabled={claimingTask === task.id} className="bg-primary text-white hover:bg-primary/90">
              {claimingTask === task.id ? "..." : t("takeTask") || "Take This Task"}
            </Button>
          )}
          {mapped === "in-progress" && session && isAssignee && (
            <Button onClick={() => setShowSubmitForm(!showSubmitForm)} className="bg-teal-600 text-white hover:bg-teal-700">
              {t("submitWork") || "Submit for Review"}
            </Button>
          )}
          {(task.status === "claimed" || task.status === "in-progress") && session && isAssignee && (
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const res = await fetch(`/api/tasks/${task.id}/unclaim`, { method: "POST" });
                if (res.ok) { toast.success("Task released"); refresh(); }
                else { const err = await res.json(); toast.error(err.error); }
              } catch { toast.error("Failed to release task"); }
            }}>
              Release Task
            </Button>
          )}
          {mapped === "done" && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" /> Completed
            </div>
          )}
        </div>

        {/* Submit form with drag-drop file upload */}
        {showSubmitForm && mapped === "in-progress" && session && isAssignee && (
          <div className="mb-6 space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950/30">
            <h4 className="font-medium">{t("submitWork") || "Submit for Review"}</h4>
            <Textarea
              value={submitText}
              onChange={(e) => setSubmitText(e.target.value)}
              placeholder="Describe your work or paste a link..."
              rows={4}
            />

            {/* Drag-drop area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors",
                dragActive
                  ? "border-teal-500 bg-teal-100/50 dark:bg-teal-900/30"
                  : "border-teal-300 bg-white/60 hover:bg-white dark:border-teal-700 dark:bg-gray-900/40 dark:hover:bg-gray-900/70"
              )}
            >
              <Upload className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <p className="text-center text-xs text-muted-foreground">
                Drag &amp; drop files here, or <span className="font-medium text-teal-700 dark:text-teal-300">click to browse</span>
              </p>
              <p className="text-center text-[10px] text-muted-foreground">
                Images, PDFs, docs, text, JSON, CSV &middot; 10MB max per file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,text/csv,.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.json,.csv"
              />
            </div>

            {/* Pending file chips */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs dark:border-teal-800 dark:bg-gray-900"
                  >
                    {f.type.startsWith("image/") ? (
                      <ImageIcon className="h-3 w-3 text-teal-600" />
                    ) : (
                      <FileText className="h-3 w-3 text-teal-600" />
                    )}
                    <span className="max-w-[160px] truncate font-medium">{f.name}</span>
                    <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(idx)}
                      className="text-muted-foreground hover:text-red-500"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadingFile && (
              <p className="text-xs text-teal-700 dark:text-teal-300">Uploading {uploadingFile}...</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSubmitWork}
                disabled={submitting || (!submitText.trim() && pendingFiles.length === 0)}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {submitting ? tCommon("loading") : t("submitWork") || "Submit"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSubmitForm(false);
                  setPendingFiles([]);
                }}
              >
                {t("cancelEdit") || "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {/* Submissions */}
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold">{t("submissions")}</h3>
          {task.submissions.length > 0 ? (
            <div className="space-y-3">
              {task.submissions.map((sub) => (
                <SubmissionCard key={sub.id} sub={sub} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No submissions yet</p>
          )}
        </div>

        {/* Notes / Chat */}
        <div>
          <h3 className="mb-1 text-lg font-semibold">{t("taskComments")}</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            💬 Ask questions, propose changes to the task, or discuss approach here. You can @mention people and reply to specific comments. Admins and the project leads can edit or close tasks based on this discussion.
          </p>
          <TaskNotesChat
            taskId={task.id}
            notes={task.notes || []}
            session={session}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            onAuthOpen={onAuthOpen}
            refresh={refresh}
            onReply={(noteId) => setReplyingTo(noteId)}
          />
          <div className="mt-3">
            {replyingTo && (
              <div className="mb-2 flex items-center justify-between rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CornerDownRight className="h-3 w-3" /> Replying to a comment
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="hover:text-foreground"
                  aria-label="Cancel reply"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : t("addNote")}
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostNote(); } }}
              />
              <Button onClick={handlePostNote} disabled={postingNote || !noteText.trim()} size="sm">{t("postNote")}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- SubmissionCard ----

export function SubmissionCard({ sub }: { sub: TaskSubmission }) {
  const attachments = sub.attachments || [];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1 flex items-center gap-2 text-sm">
        <User className="h-3 w-3" />
        <span className="font-medium">{sub.authorName}</span>
        <span className="text-xs text-muted-foreground">{sub.createdAt ? timeAgo(sub.createdAt) : ""}</span>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            sub.status === "accepted"
              ? "border-green-300 text-green-700"
              : sub.status === "changes-requested"
                ? "border-amber-300 text-amber-700"
                : ""
          }`}
        >
          {sub.status === "accepted"
            ? "Accepted"
            : sub.status === "changes-requested"
              ? "Changes Requested"
              : sub.status === "pending"
                ? "Pending Review"
                : sub.status || "Pending Review"}
        </Badge>
      </div>
      {sub.content && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sub.content}</p>}
      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <AttachmentPreview key={a.url} attachment={a} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentPreview({ attachment }: { attachment: SubmissionAttachment }) {
  if (isImageMime(attachment.mimeType)) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
        title={attachment.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="h-24 w-24 rounded-md border border-border object-cover transition-opacity group-hover:opacity-80"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.filename}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs hover:bg-muted"
    >
      <FileText className="h-4 w-4 text-primary" />
      <span className="max-w-[200px] truncate font-medium">{attachment.filename}</span>
      <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
      <Download className="h-3 w-3 text-muted-foreground" />
    </a>
  );
}

// ---- Task notes chat ----

interface ChatNote extends TaskNote {
  id?: string;
  children: ChatNote[];
}

export function buildNoteTree(notes: TaskNote[]): ChatNote[] {
  const byId = new Map<string, ChatNote>();
  const roots: ChatNote[] = [];
  // First pass: build wrappers and key by id (skip notes without id — treat as root)
  const wrapped: ChatNote[] = notes.map((n) => ({ ...n, children: [] }));
  for (const n of wrapped) {
    if (n.id) byId.set(n.id, n);
  }
  for (const n of wrapped) {
    if (n.replyTo && byId.has(n.replyTo)) {
      byId.get(n.replyTo)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

export function TaskNotesChat({
  taskId,
  notes,
  session,
  isAdmin,
  currentUserId,
  onAuthOpen,
  refresh,
  onReply,
}: {
  taskId: string;
  notes: TaskNote[];
  session: Any;
  isAdmin: boolean;
  currentUserId: string;
  onAuthOpen: () => void;
  refresh: () => void;
  onReply: (noteId: string) => void;
}) {
  const tree = useMemo(() => buildNoteTree(notes), [notes]);

  if (!notes || notes.length === 0) {
    return <p className="mb-3 text-sm text-muted-foreground">No comments yet</p>;
  }

  return (
    <div className="space-y-2">
      {tree.map((node, idx) => (
        <NoteNode
          key={node.id || `root-${idx}`}
          node={node}
          depth={0}
          taskId={taskId}
          session={session}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onAuthOpen={onAuthOpen}
          refresh={refresh}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

export function NoteNode({
  node,
  depth,
  taskId,
  session,
  isAdmin,
  currentUserId,
  onAuthOpen,
  refresh,
  onReply,
}: {
  node: ChatNote;
  depth: number;
  taskId: string;
  session: Any;
  isAdmin: boolean;
  currentUserId: string;
  onAuthOpen: () => void;
  refresh: () => void;
  onReply: (noteId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.content);
  const [busy, setBusy] = useState(false);

  const isOwn = !!session && node.authorId === currentUserId;
  const canDelete = isOwn || isAdmin;
  const noteId = node.id;

  const handleSaveEdit = async () => {
    if (!noteId || !editText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content: editText }),
      });
      if (res.ok) {
        setEditing(false);
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to edit");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to edit");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!noteId) return;
    if (!confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (res.ok) {
        refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to delete");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(depth > 0 && "ml-5 border-l-2 border-border pl-3")}>
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{node.authorName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(node.createdAt)}</span>
          {node.editedAt && (
            <span className="text-[10px] text-muted-foreground italic">edited</span>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={busy || !editText.trim()}>
                <Save className="mr-1 h-3 w-3" /> Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEditText(node.content);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{node.content}</p>
        )}

        {/* Actions row */}
        {!editing && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {noteId && session && (
              <button
                onClick={() => onReply(noteId)}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                <MessageCircle className="h-3 w-3" /> Reply
              </button>
            )}
            {isOwn && noteId && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            )}
            {canDelete && noteId && (
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex items-center gap-1 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
            {noteId && (
              <TaskNoteReactions
                taskId={taskId}
                noteId={noteId}
                session={session}
                onAuthOpen={onAuthOpen}
              />
            )}
          </div>
        )}
      </div>

      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child, idx) => (
            <NoteNode
              key={child.id || `child-${idx}`}
              node={child}
              depth={depth + 1}
              taskId={taskId}
              session={session}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onAuthOpen={onAuthOpen}
              refresh={refresh}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskNoteReactions({
  taskId,
  noteId,
  session,
  onAuthOpen,
}: {
  taskId: string;
  noteId: string;
  session: Any;
  onAuthOpen: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReacted, setUserReacted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/notes/reactions?noteIds=${encodeURIComponent(noteId)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data[noteId]) {
          setCounts(data[noteId]);
        }
      }
    } catch {
      // ignore
    }
  }, [taskId, noteId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  const toggle = async (reactionType: string) => {
    if (!session) {
      onAuthOpen();
      return;
    }
    const wasReacted = !!userReacted[reactionType];
    const prevCounts = { ...counts };
    const prevUser = { ...userReacted };
    setCounts((p) => ({
      ...p,
      [reactionType]: Math.max(0, (p[reactionType] || 0) + (wasReacted ? -1 : 1)),
    }));
    setUserReacted((p) => ({ ...p, [reactionType]: !wasReacted }));
    setBusy(reactionType);
    try {
      const res = await fetch(`/api/tasks/${taskId}/notes/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, reactionType }),
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data.reactions || {});
        setUserReacted(data.userReacted || {});
      } else {
        setCounts(prevCounts);
        setUserReacted(prevUser);
      }
    } catch {
      setCounts(prevCounts);
      setUserReacted(prevUser);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {REACTION_TYPES.map(({ type, emoji, label }) => {
        const count = counts[type] || 0;
        const isActive = !!userReacted[type];
        if (count === 0 && !isActive) {
          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              disabled={busy === type}
              title={label}
              aria-label={`React with ${label}`}
              className="rounded-full px-1.5 py-0.5 text-sm opacity-40 hover:bg-gray-100 hover:opacity-100 dark:hover:bg-gray-800"
            >
              {emoji}
            </button>
          );
        }
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            disabled={busy === type}
            title={label}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs",
              isActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <span className="text-sm">{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
