"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { timeAgo } from "../types";

type Decision = "approve" | "request_changes" | "reject" | string;
type Confidence = "high" | "medium" | "low" | string;

interface ParsedReview {
  summary?: string;
  qualityAssessment?: string;
  coversRequirements?: boolean;
  strengths?: string[];
  missingPoints?: string[];
  suggestedImprovements?: string[];
  improvements?: string[];
  nextSteps?: string[];
  decision?: Decision;
  confidence?: Confidence;
  generatedAt?: string;
}

interface AIReviewCardProps {
  /** Raw AI review — may be a pre-parsed object or a JSON string. */
  review: unknown;
  /** Optional top-level decision (from `ai_decision` column). */
  decision?: Decision | null;
  /** Optional confidence level (from `ai_confidence` column). */
  confidence?: Confidence | null;
  /** Submission id — required for regenerate action. */
  submissionId?: string;
  /** Whether the current user is admin — gates regenerate button. */
  isAdmin?: boolean;
  /** Refresh the parent data when regeneration finishes. */
  onRefresh?: () => void;
}

function parseReview(raw: unknown): {
  parsed: ParsedReview | null;
  rawText: string | null;
} {
  if (!raw) return { parsed: null, rawText: null };
  if (typeof raw === "object") {
    return { parsed: raw as ParsedReview, rawText: null };
  }
  if (typeof raw === "string") {
    try {
      const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
      return { parsed: JSON.parse(cleaned) as ParsedReview, rawText: raw };
    } catch {
      return { parsed: null, rawText: raw };
    }
  }
  return { parsed: null, rawText: null };
}

function decisionStyle(decision?: Decision | null) {
  switch (decision) {
    case "approve":
    case "accepted":
      return {
        label: "Approved",
        icon: CheckCircle2,
        className:
          "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
      };
    case "request_changes":
    case "changes-requested":
    case "changes_requested":
      return {
        label: "Changes Requested",
        icon: AlertTriangle,
        className:
          "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      };
    case "reject":
    case "rejected":
      return {
        label: "Rejected",
        icon: XCircle,
        className:
          "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
      };
    default:
      return {
        label: "Pending",
        icon: Sparkles,
        className:
          "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
      };
  }
}

function confidenceLabel(c?: Confidence | null): string | null {
  if (!c) return null;
  const lower = String(c).toLowerCase();
  if (["high", "medium", "low"].includes(lower)) {
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)} confidence`;
  }
  return `${c} confidence`;
}

export default function AIReviewCard({
  review,
  decision,
  confidence,
  submissionId,
  isAdmin,
  onRefresh,
}: AIReviewCardProps) {
  const [regenerating, setRegenerating] = useState(false);

  const { parsed, rawText } = parseReview(review);

  const effectiveDecision =
    decision || parsed?.decision ||
    (parsed?.coversRequirements === true
      ? "approve"
      : parsed?.coversRequirements === false
        ? "request_changes"
        : undefined);
  const effectiveConfidence = confidence || parsed?.confidence;

  const style = decisionStyle(effectiveDecision);
  const Icon = style.icon;

  const strengths = parsed?.strengths || [];
  const improvements =
    parsed?.suggestedImprovements ||
    parsed?.improvements ||
    parsed?.missingPoints ||
    [];
  const nextSteps = parsed?.nextSteps || [];

  async function handleRegenerate() {
    if (!submissionId) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to regenerate review");
      }
      toast.success("AI review regenerated");
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-iran-green/20 bg-gradient-to-br from-iran-green/5 to-transparent p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-iran-deep-green" />
        <span className="text-xs font-semibold uppercase tracking-wide text-iran-deep-green">
          AI Review
        </span>
        <Badge
          variant="outline"
          className={`flex items-center gap-1 text-[10px] ${style.className}`}
        >
          <Icon className="h-3 w-3" /> {style.label}
        </Badge>
        {confidenceLabel(effectiveConfidence) && (
          <Badge
            variant="outline"
            className="text-[10px] text-muted-foreground"
          >
            {confidenceLabel(effectiveConfidence)}
          </Badge>
        )}
      </div>

      {parsed?.summary && (
        <p className="text-sm text-foreground">{parsed.summary}</p>
      )}

      {!parsed && rawText && (
        <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          {rawText}
        </pre>
      )}

      {parsed?.qualityAssessment && !parsed.summary && (
        <p className="text-sm text-foreground">{parsed.qualityAssessment}</p>
      )}

      {strengths.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
            Strengths
          </p>
          <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
            {strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {improvements.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            Improvements
          </p>
          <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
            {improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-iran-deep-green">
            Next steps
          </p>
          <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
            {nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-muted-foreground">
        <span>
          AI review
          {parsed?.generatedAt
            ? ` \u00B7 Generated ${timeAgo(parsed.generatedAt)}`
            : ""}
        </span>
        {isAdmin && submissionId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="h-6 px-2 text-[10px]"
          >
            {regenerating ? (
              <Loader2 className="me-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="me-1 h-3 w-3" />
            )}
            Regenerate
          </Button>
        )}
      </div>
    </div>
  );
}
