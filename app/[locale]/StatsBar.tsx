"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";

type Stats = {
  totalIdeas: number;
  activeProjects: number;
  contributors: number;
  totalTasks: number;
  completedTasks: number;
  activeContributors?: number;
};

export default function StatsBar() {
  const t = useTranslations("home");
  const locale = useLocale();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => console.error("Failed to load stats:", e));
  }, []);

  const fmt = (n: number) =>
    locale === "fa" ? n.toLocaleString("fa-IR") : n.toLocaleString();

  if (!stats) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
        <span>...</span>
      </div>
    );
  }

  const items: { value: string; label: string }[] = [
    {
      value: fmt(stats.totalIdeas),
      label: t("statsIdeasLabel"),
    },
    {
      value: fmt(stats.activeProjects),
      label: t("statsProjectsLabel"),
    },
    {
      value: fmt(stats.contributors),
      label: t("statsMembersLabel"),
    },
    {
      value: `${fmt(stats.completedTasks)}/${fmt(stats.totalTasks)}`,
      label: t("statsTasksLabel"),
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:gap-x-8 sm:gap-y-6 md:gap-x-12">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-4 sm:gap-6 md:gap-10">
          <div className="flex flex-col items-center text-center">
            <span className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
              {item.value}
            </span>
            <span className="mt-1.5 max-w-[100px] text-[11px] font-medium uppercase tracking-wider text-white/70 sm:mt-2 sm:max-w-[120px] sm:text-xs md:max-w-none md:text-sm">
              {item.label}
            </span>
          </div>
          {i < items.length - 1 && (
            <span
              aria-hidden="true"
              className="hidden h-1.5 w-1.5 rounded-full bg-iran-gold shadow-iran-gold md:inline-block"
            />
          )}
        </div>
      ))}
    </div>
  );
}
