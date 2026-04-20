"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Circle, Hammer } from "lucide-react";
import { resolveEmoji } from "@/lib/emoji-map";
import { STATUS_STYLES, STATUS_LABELS } from "./constants";
import type { ProjectCardProject } from "./types";

export default function ProjectCard({
  project,
}: {
  project: ProjectCardProject;
  expanded?: boolean;
}) {
  const t = useTranslations("projects");

  const totalTasks = project.totalTaskCount || 0;
  const completedTasks = project.completedTaskCount || 0;
  const progressPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Link href={`/projects/${project.slug}`}>
      <div className="group card-hover-gold min-w-0 rounded-xl border border-iran-gold/20 bg-card p-5 hover:border-iran-gold/50">
        <div className="mb-2 flex items-center gap-2">
          {project.category && (
            <Badge
              variant="secondary"
              className="text-xs border border-iran-green/20 bg-iran-green/5 text-iran-deep-green dark:bg-iran-green/15 dark:text-iran-bright-green"
            >
              {resolveEmoji(project.categoryEmoji || "")} {project.category}
            </Badge>
          )}
          <Badge className={`text-xs ${STATUS_STYLES[project.status] || ""}`}>
            {STATUS_LABELS[project.status] || project.status}
          </Badge>
        </div>

        <h3 className="mb-2 text-lg font-bold text-foreground transition-colors group-hover:text-iran-deep-green dark:group-hover:text-iran-bright-green line-clamp-1">
          {project.title}
        </h3>

        {project.bodyPreview && (
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {project.bodyPreview}
          </p>
        )}

        {/* Task progress */}
        {totalTasks > 0 && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {completedTasks > 0 ? (
                  <CheckCircle2 className="h-3 w-3 text-iran-green" />
                ) : (
                  <Circle className="h-3 w-3 text-iran-gold/60" />
                )}
                {completedTasks}/{totalTasks} {t("tasks") || "tasks"}
              </span>
              <span className="font-semibold text-iran-deep-green dark:text-iran-gold">
                {progressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-iran-gold/10 dark:bg-iran-gold/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-iran-green to-iran-gold transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 ring-2 ring-iran-gold/30">
              <AvatarImage src={project.leadAvatar} />
              <AvatarFallback className="text-xs">
                {(project.leadName || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {project.leadName}
            </span>
          </div>

          {(project.openRoleCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-iran-deep-green dark:text-iran-gold">
              <Hammer className="h-3 w-3" />
              {project.openRoleCount} open tasks
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
