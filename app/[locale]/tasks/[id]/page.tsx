"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
const MarkdownRenderer = dynamic(() => import("@/components/ui/MarkdownRenderer"), { ssr: false });
import {
  ArrowLeft,
  Clock,
  User,
  Send,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { Task, Submission } from "@/lib/ai-tasks";

export default function TaskWorkspacePage() {
  const t = useTranslations("taskWorkspace");
  const { data: session } = useSession();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Submission form
  const [subType, setSubType] = useState<"link" | "inline">("inline");
  const [subContent, setSubContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Notes
  const [noteContent, setNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks?ideaId=all`).then((r) => r.json()),
    ])
      .then(([tasksData]) => {
        // Find our task from all tasks
        const found = (tasksData.tasks || []).find(
          (t: Task) => t.id === taskId
        );
        setTask(found || null);

        // Could also fetch submissions here
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleSubmitWork = async () => {
    if (!subContent.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: subType, content: subContent }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmissions((prev) => [...prev, data.submission]);
        setSubContent("");
        toast.success(t("submitted"));
        // Refresh task
        setTask((prev) => prev ? { ...prev, status: "submitted" } : prev);
      }
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setAddingNote(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent }),
      });

      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setNoteContent("");
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  const userId = session?.user?.id || session?.user?.email || "";
  const isAssignee = task.assigneeId === userId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap gap-4">
        <Link
          href={`/ideas/${task.ideaId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToIdea")}
        </Link>
        <Link
          href={`/projects/${task.ideaId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
      </div>

      {/* Task header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Badge
            className={
              task.status === "accepted"
                ? "bg-green-100 text-green-700"
                : task.status === "submitted"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
            }
          >
            {task.status}
          </Badge>
          <Badge variant="outline">{task.outputType}</Badge>
        </div>
        <h1 className="mb-2 text-2xl font-bold">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {task.assigneeName && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {task.assigneeName}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {t("dueBy")} {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {task.timeEstimate}
          </span>
        </div>
      </div>

      {/* Brief */}
      <div className="mb-8 rounded-lg border border-border bg-gray-50 p-5 dark:bg-gray-800">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("brief")}
        </h3>
        <MarkdownRenderer content={task.description} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.skillsNeeded.map((skill) => (
            <Badge key={skill} variant="outline" className="text-xs">
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      {/* Submit work form */}
      {isAssignee && (task.status === "claimed" || task.status === "in-progress" || task.status === "changes-requested") && (
        <div className="mb-8 rounded-lg border border-border p-5">
          <h3 className="mb-3 font-bold">{t("submitWork")}</h3>

          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setSubType("inline")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                subType === "inline"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {t("writeDirectly")}
            </button>
            <button
              onClick={() => setSubType("link")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                subType === "link"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {t("pasteLink")}
            </button>
          </div>

          {subType === "link" ? (
            <Input
              value={subContent}
              onChange={(e) => setSubContent(e.target.value)}
              placeholder="https://docs.google.com/... or https://hackmd.io/..."
            />
          ) : (
            <Textarea
              value={subContent}
              onChange={(e) => setSubContent(e.target.value)}
              placeholder={t("writeHere")}
              rows={8}
            />
          )}

          <Button
            onClick={handleSubmitWork}
            disabled={submitting || !subContent.trim()}
            className="mt-3 bg-primary text-white hover:bg-primary/90"
          >
            <Send className="me-2 h-4 w-4" />
            {submitting ? "..." : t("submitButton")}
          </Button>
        </div>
      )}

      {/* Submissions */}
      {submissions.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 font-bold">{t("submissions")}</h3>
          {submissions.map((sub) => (
            <div key={sub.id} className="mb-3 rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{sub.authorName}</span>
                <Badge
                  className={
                    sub.status === "accepted"
                      ? "bg-green-100 text-green-700"
                      : sub.status === "changes-requested"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                  }
                >
                  {sub.status}
                </Badge>
              </div>

              {sub.type === "link" ? (
                <a href={sub.content} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                  {sub.content}
                </a>
              ) : (
                <MarkdownRenderer content={sub.content} className="text-sm" />
              )}

              {/* AI Review */}
              {sub.aiReview && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    🤖 AI Review
                  </p>
                  <p className="text-sm">{sub.aiReview.summary}</p>
                  {sub.aiReview.missingPoints.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-orange-600">Missing:</p>
                      <ul className="list-inside list-disc text-xs text-muted-foreground">
                        {sub.aiReview.missingPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress notes */}
      <div className="mb-8">
        <h3 className="mb-3 font-bold">{t("progressNotes")}</h3>
        {task.notes.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
        )}
        {task.notes.map((note, idx) => (
          <div key={idx} className="mb-2 rounded-lg border border-border p-3">
            <p className="mb-1 text-xs text-muted-foreground">
              {note.authorName} · {new Date(note.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm">{note.content}</p>
          </div>
        ))}

        {session && (
          <div className="mt-3 flex gap-2">
            <Input
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={t("addNote")}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            />
            <Button
              onClick={handleAddNote}
              disabled={addingNote || !noteContent.trim()}
              variant="outline"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
