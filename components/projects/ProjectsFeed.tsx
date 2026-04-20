"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Users, CheckCircle2, Hammer } from "lucide-react";
import { STATUS_STYLES, STATUS_LABELS } from "./constants";
import { LionSunLogo } from "@/components/brand/LionSunLogo";

interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  sourceIdeaId: string;
  sourceIdeaTitle: string;
  leadName: string;
  leadAvatar: string;
  memberCount: number;
  openRoleCount: number;
  completedTaskCount: number;
  totalTaskCount: number;
  createdAt: string;
  category: string;
  categoryEmoji: string;
  feasibility: string | null;
  bodyPreview: string;
}

function FeasibilityDot({ score }: { score: string | null }) {
  if (!score) return null;
  const colorMap: Record<string, string> = {
    green: "bg-iran-green",
    yellow: "bg-iran-saffron",
    orange: "bg-persia-terracotta",
    red: "bg-iran-red",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colorMap[score] || "bg-muted-foreground/40"}`}
      title={`Feasibility: ${score}`}
    />
  );
}

function TaskProgressBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Tasks</span>
        <span className="font-semibold text-iran-deep-green dark:text-iran-gold">
          {completed}/{total} done
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-iran-gold/10 dark:bg-iran-gold/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-iran-green to-iran-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ProjectsFeed() {
  const t = useTranslations("projects");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter === "all"
    ? projects
    : projects.filter((p) => p.status === statusFilter);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-iran-green/10 bg-card p-5"
          >
            <Skeleton className="mb-3 h-6 w-3/4" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {["all", "active", "needs-contributors", "completed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              statusFilter === s
                ? "bg-iran-green text-white shadow-iran-green"
                : "border border-iran-green/20 bg-iran-green/5 text-iran-deep-green hover:bg-iran-green/10 hover:border-iran-green/40 dark:bg-iran-green/10 dark:text-iran-bright-green dark:hover:bg-iran-green/20"
            }`}
          >
            {s === "all" ? t("filterAll") : (STATUS_LABELS[s] || s)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LionSunLogo size="lg" className="mb-4 opacity-80" />
          <p className="text-lg font-semibold text-gradient-iran">
            {t("noProjects")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse ideas and start building!
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-4 border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 hover:shadow-iran-gold dark:text-iran-gold"
          >
            <Link href="/ideas">
              Browse Ideas <ArrowRight className="ms-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <div className="group card-hover-gold rounded-xl border border-iran-gold/20 bg-card p-5 hover:border-iran-gold/50">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FeasibilityDot score={project.feasibility} />
                    <h3 className="truncate font-bold text-foreground transition-colors group-hover:text-iran-deep-green dark:group-hover:text-iran-bright-green">
                      {project.title}
                    </h3>
                  </div>
                  <Badge
                    className={`shrink-0 ${
                      STATUS_STYLES[project.status] ||
                      "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </Badge>
                </div>

                {project.categoryEmoji && project.category && (
                  <Badge
                    variant="outline"
                    className="mb-2 border-iran-green/30 bg-iran-green/5 text-iran-deep-green text-xs dark:bg-iran-green/15 dark:text-iran-bright-green"
                  >
                    {project.categoryEmoji} {project.category}
                  </Badge>
                )}

                {project.bodyPreview && (
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                    {project.bodyPreview}
                  </p>
                )}

                <div className="mb-1 flex items-center gap-2">
                  {project.leadAvatar && (
                    <Avatar className="h-6 w-6 ring-2 ring-iran-gold/30">
                      <AvatarImage src={project.leadAvatar} />
                      <AvatarFallback className="text-xs">
                        {(project.leadName || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {project.leadName || "Community"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-iran-deep-green dark:text-iran-bright-green" />
                    {project.memberCount} members
                  </span>
                  {project.openRoleCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-iran-deep-green dark:text-iran-gold">
                      <Hammer className="h-3 w-3" />
                      {project.openRoleCount} open tasks
                    </span>
                  )}
                  {project.totalTaskCount > 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-iran-green" />
                      {project.completedTaskCount}/{project.totalTaskCount}
                    </span>
                  )}
                </div>

                <TaskProgressBar
                  completed={project.completedTaskCount}
                  total={project.totalTaskCount}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
