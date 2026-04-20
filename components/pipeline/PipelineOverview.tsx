"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  Users,
  Rocket,
  Trophy,
} from "lucide-react";
import type { PipelineStage } from "@/types";

interface StageInfo {
  key: PipelineStage;
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
}

const STAGES: StageInfo[] = [
  { key: "submitted", icon: Lightbulb, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-800" },
  { key: "gaining", icon: TrendingUp, color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/20" },
  { key: "validated", icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20" },
  { key: "team-forming", icon: Users, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
  { key: "active-project", icon: Rocket, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-900/20" },
  { key: "launched", icon: Trophy, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-900/20" },
];

interface Props {
  onStageClick?: (stage: PipelineStage | "all") => void;
  selectedStage?: PipelineStage | "all";
}

export default function PipelineOverview({ onStageClick, selectedStage = "all" }: Props) {
  const t = useTranslations("pipeline");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/ideas/stage-counts")
      .then((r) => r.json())
      .then((data) => setCounts(data || {}))
      .catch(() => {});
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-xl border border-border bg-white p-6 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">{t("title")}</h3>
        {total > 0 && (
          <button
            onClick={() => onStageClick?.("all")}
            className={`text-sm font-medium ${selectedStage === "all" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            {t("allIdeas")} ({total})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage, idx) => {
          const count = counts[stage.key] || 0;
          const isSelected = selectedStage === stage.key;
          return (
            <button
              key={stage.key}
              onClick={() => onStageClick?.(stage.key)}
              className={`relative rounded-lg p-3 text-center transition-all ${
                isSelected
                  ? "ring-2 ring-primary ring-offset-2"
                  : "hover:ring-1 hover:ring-border"
              } ${stage.bgColor}`}
            >
              <stage.icon className={`mx-auto mb-1.5 h-5 w-5 ${stage.color}`} />
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{t(stage.key)}</p>
              {idx < STAGES.length - 1 && (
                <span className="absolute -end-2 top-1/2 hidden -translate-y-1/2 text-muted-foreground/30 lg:block">
                  →
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
