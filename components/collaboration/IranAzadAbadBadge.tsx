"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";

interface Props {
  sourceUrl: string;
  size?: "sm" | "md";
}

export default function IranAzadAbadBadge({ sourceUrl, size = "sm" }: Props) {
  const t = useTranslations("collaboration");

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={t("sourceBadgeTooltip")}
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-800/60 ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } font-medium`}
    >
      <span>{t("sourceBadge")}</span>
      <ExternalLink className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </a>
  );
}
