"use client";

/**
 * GDPR cookie-notice banner.
 *
 * IranENovin only uses strictly-necessary + functional cookies (auth
 * session, remember-me preference, theme, announcement dismissal). No
 * tracking, no analytics, no ad networks. Under GDPR + ePrivacy, strictly-
 * necessary cookies don't require opt-in consent, but we still owe users a
 * clear, up-front notice + link to our privacy policy.
 *
 * Dismissal is persisted to `localStorage` (not a cookie) so the notice
 * itself doesn't need a cookie to manage.
 */

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "ie.cookie-consent.v1";
const STORAGE_VALUE = "acknowledged";

export default function CookieBanner() {
  // Start false so SSR never renders the banner (prevents flash for users
  // who've already acknowledged).
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== STORAGE_VALUE) {
        setShow(true);
      }
    } catch {
      // Storage blocked (rare, incognito) — show banner in-session but it
      // will reappear on next load. That's the spec-correct failure mode.
      setShow(true);
    }
  }, []);

  const t = useTranslations("cookies");

  const acknowledge = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, STORAGE_VALUE);
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-iran-green/30 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md dark:bg-gray-950/95"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Cookie
            className="mt-0.5 h-5 w-5 shrink-0 text-iran-gold"
            aria-hidden="true"
          />
          <div className="text-sm text-foreground/90">
            <p className="font-semibold text-foreground">{t("title")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("body")}{" "}
              <Link
                href="/privacy"
                className="font-medium text-iran-deep-green underline underline-offset-2 hover:text-iran-green dark:text-iran-bright-green"
              >
                {t("privacyLink")}
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-full bg-iran-green px-4 py-1.5 text-sm font-semibold text-white shadow-iran-green transition-colors hover:bg-iran-deep-green"
          >
            {t("accept")}
          </button>
          <button
            type="button"
            onClick={acknowledge}
            aria-label={t("dismiss")}
            title={t("dismiss")}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-iran-green/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
