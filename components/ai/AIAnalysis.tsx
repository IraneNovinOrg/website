"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bot,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import type { UnifiedIdea } from "@/types";
import type { AIAnalysis as AIAnalysisType } from "@/lib/ai";
import type { Task } from "@/lib/ai-tasks";

const FEASIBILITY_CONFIG = {
  green: { color: "bg-green-100 text-green-700", label: "Highly actionable", icon: "🟢" },
  yellow: { color: "bg-yellow-100 text-yellow-700", label: "Partially actionable", icon: "🟡" },
  orange: { color: "bg-orange-100 text-orange-700", label: "Needs groundwork", icon: "🟠" },
  red: { color: "bg-red-100 text-red-700", label: "Requires major prerequisites", icon: "🔴" },
};

interface Props {
  idea: UnifiedIdea;
}

export default function AIAnalysisPanel({ idea }: Props) {
  const t = useTranslations("ai");
  const { data: session } = useSession();
  const [analysis, setAnalysis] = useState<AIAnalysisType | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ai/analyze?ideaId=${idea.id}`)
      .then((r) => r.json())
      .then((data) => {
        setAnalysis(data.analysis);
        setTasks(data.tasks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [idea.id]);

  const handleClaim = async (taskId: string) => {
    if (!session) return;
    setClaimingTask(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/claim`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? data.task : t))
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setClaimingTask(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="mt-4 h-20 w-full" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center">
        <Bot className="mx-auto mb-3 h-10 w-10 text-primary/60" />
        <h3 className="mb-1 font-bold">{t("noAnalysis")}</h3>
        <p className="text-sm text-muted-foreground">
          This project hasn&apos;t been analyzed yet. Analysis happens automatically when projects are activated.
        </p>
      </div>
    );
  }

  const feasibility = FEASIBILITY_CONFIG[analysis.feasibility];

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-bold">{t("title")}</h3>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {/* Feasibility */}
        <div>
          <Badge className={`${feasibility.color} text-sm`}>
            {feasibility.icon} {feasibility.label}
          </Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {analysis.feasibilityExplanation}
          </p>
        </div>

        {/* Summary */}
        <div>
          <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("summary")}
          </h4>
          <p className="text-sm">{analysis.summary}</p>
        </div>

        {/* Tasks */}
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("whatCanStart")}
          </h4>
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClaim={handleClaim}
                claiming={claimingTask === task.id}
                isLoggedIn={!!session}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* Risks */}
        {analysis.risks.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("risks")}
            </h4>
            <ul className="space-y-1">
              {analysis.risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dependencies */}
        {analysis.dependencies.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("dependencies")}
            </h4>
            {analysis.dependencies.map((dep, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                → {dep.type}: {dep.ideaTitle}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onClaim,
  claiming,
  isLoggedIn,
  t,
}: {
  task: Task;
  onClaim: (id: string) => void;
  claiming: boolean;
  isLoggedIn: boolean;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    open: <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />,
    claimed: <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />,
    "in-progress": <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />,
    submitted: <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />,
    accepted: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />,
    "changes-requested": <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />,
  };

  const isClaimedByUser = task.status === "claimed" || task.status === "in-progress" || task.status === "changes-requested";
  const hasLongDescription = task.description.length > 150;

  // Difficulty badge based on time estimate
  const hours = parseInt(task.timeEstimate?.replace(/[^0-9]/g, "") || "2");
  const difficultyBadge = hours <= 1
    ? { label: "Quick task", className: "bg-green-100 text-green-700" }
    : hours <= 2
    ? { label: "Moderate", className: "bg-yellow-100 text-yellow-700" }
    : { label: "In-depth", className: "bg-orange-100 text-orange-700" };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-2">
        {statusIcon[task.status]}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{task.title}</p>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${difficultyBadge.className}`}>
              {difficultyBadge.label}
            </Badge>
          </div>

          {/* Expandable description */}
          <p className={`mt-1 text-xs text-muted-foreground whitespace-pre-line ${expanded ? "" : "line-clamp-3"}`}>
            {task.description}
          </p>
          {hasLongDescription && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Read less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Read more</>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {task.skillsNeeded.map((skill) => (
          <Badge key={skill} variant="outline" className="text-xs">
            {skill}
          </Badge>
        ))}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {task.timeEstimate}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Claim button for open tasks */}
        {task.status === "open" && isLoggedIn && (
          <Button
            size="sm"
            onClick={() => onClaim(task.id)}
            disabled={claiming}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {claiming ? "..." : t("claimTask")}
          </Button>
        )}

        {/* Submit work link for claimed tasks */}
        {isClaimedByUser && (
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
          >
            Submit your work <ExternalLink className="h-3 w-3" />
          </Link>
        )}

        {/* View details link for all tasks */}
        {task.status !== "open" && !isClaimedByUser && (
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View details <ExternalLink className="h-3 w-3" />
          </Link>
        )}

        {/* Assignee info */}
        {task.assigneeName && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {task.assigneeName}
            {task.dueDate && (
              <> · {t("due")} {new Date(task.dueDate).toLocaleDateString()}</>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
