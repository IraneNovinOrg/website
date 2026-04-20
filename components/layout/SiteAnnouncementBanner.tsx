"use client";

/**
 * Dismissible site-wide announcement banner. Shows the latest active
 * announcement from the server; "dismissed" state lives in localStorage
 * keyed by announcement id so users don't see the same message twice.
 */

import { useEffect, useState } from "react";
import { Megaphone, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Link } from "@/i18n/routing";

interface SiteAnnouncement {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  severity: "info" | "success" | "warning";
}

const STORAGE_KEY = "iae:dismissed-announcements:v1";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-20)));
  } catch {
    /* storage full / blocked — dismissal becomes session-only, that's fine */
  }
}

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export default function SiteAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<SiteAnnouncement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());
    setHydrated(true);
    // Fetch lazily after mount so the banner never blocks initial paint.
    fetch("/api/announcements/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.announcement) setAnnouncement(data.announcement);
      })
      .catch(() => { /* silent — banner is optional */ });
  }, []);

  if (!hydrated || !announcement || dismissed.has(announcement.id)) return null;

  const palette =
    announcement.severity === "success"
      ? "border-iran-green/30 bg-iran-green/5 text-iran-deep-green dark:text-iran-bright-green"
      : announcement.severity === "warning"
        ? "border-iran-saffron/40 bg-iran-saffron/10 text-iran-deep-green dark:text-iran-gold"
        : "border-persia-indigo/30 bg-persia-indigo/5 text-persia-indigo dark:text-persia-turquoise";

  const Icon =
    announcement.severity === "success"
      ? CheckCircle2
      : announcement.severity === "warning"
        ? AlertTriangle
        : Megaphone;

  const handleDismiss = () => {
    const next = new Set(dismissed);
    next.add(announcement.id);
    setDismissed(next);
    saveDismissed(next);
  };

  const link = announcement.linkUrl?.trim();
  const linkLabel = announcement.linkLabel?.trim() || "Learn more";

  return (
    <div
      role="status"
      className={`relative border-b px-4 py-2.5 text-sm ${palette}`}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 pe-8">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{announcement.title}</p>
          {announcement.body && (
            <p className="mt-0.5 text-xs leading-snug opacity-90">
              {announcement.body}
            </p>
          )}
          {link && (
            <div className="mt-1">
              {isExternal(link) ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {linkLabel} →
                </a>
              ) : (
                <Link
                  href={link as "/"}
                  className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  {linkLabel} →
                </Link>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute end-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Dismiss announcement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
