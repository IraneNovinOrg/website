"use client";

import { useTranslations } from "next-intl";

export default function CollaborationBanner() {
  const t = useTranslations("collaboration");

  return (
    <div className="w-full bg-teal-700 px-4 py-2 text-white dark:bg-teal-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-sm">
        <span>{t("banner")}</span>
        <a
          href="https://github.com/IranAzadAbad/ideas"
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap underline opacity-90 hover:opacity-100"
        >
          {t("bannerLink")} ↗
        </a>
      </div>
    </div>
  );
}
