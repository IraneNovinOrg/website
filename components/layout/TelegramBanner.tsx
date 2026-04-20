"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { getTelegramLink, getTelegramChannelLink } from "@/lib/telegram-link";

export default function TelegramBanner() {
  const t = useTranslations("telegram");
  const [dismissed, setDismissed] = useState(true);
  const [botUsername, setBotUsername] = useState("");
  const [channelUsername, setChannelUsername] = useState("");

  useEffect(() => {
    const d = localStorage.getItem("tg_banner_dismissed");
    setDismissed(d === "true");

    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setBotUsername(data.telegram?.botUsername || "IranENovinBot");
        setChannelUsername(data.telegram?.channelUsername || "iranenovin0");
      })
      .catch(() => {
        setBotUsername("IranENovinBot");
        setChannelUsername("iranenovin0");
      });
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("tg_banner_dismissed", "true");
  };

  if (dismissed || !botUsername) return null;

  return (
    <div className="relative border-b border-blue-200 bg-gradient-to-r from-blue-50 to-white px-4 py-2.5 dark:from-blue-950/30 dark:to-gray-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <MessageCircle className="h-5 w-5 shrink-0 text-[#0088cc]" />
          <span className="text-sm font-medium">{t("banner")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={getTelegramLink(botUsername)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#0088cc] px-3 py-1 text-xs font-medium text-white hover:bg-[#006da3]"
          >
            🤖 @{botUsername}
          </a>
          <a
            href={getTelegramChannelLink(channelUsername)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[#0088cc] px-3 py-1 text-xs font-medium text-[#0088cc] hover:bg-[#0088cc]/10"
          >
            📢 {t("joinChannel")}
          </a>
          <button
            onClick={dismiss}
            className="ms-1 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
