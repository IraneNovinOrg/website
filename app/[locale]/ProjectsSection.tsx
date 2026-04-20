"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import ProjectCard from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import type { ProjectCardProject } from "@/components/projects/types";

export default function ProjectsSection() {
  const t = useTranslations("home");
  const [projects, setProjects] = useState<ProjectCardProject[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects((data.projects || []).slice(0, 6)))
      .catch((e) => console.error("Failed to load projects:", e));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("ideasBecoming")}</h2>
        <Link
          href="/projects"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("viewAllProjects")} &rarr;
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {t("viewAllProjects")}
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
        <Button asChild variant="outline">
          <Link href="/submit">{t("startProject")}</Link>
        </Button>
      </div>
    </div>
  );
}
