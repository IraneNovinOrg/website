"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Rocket,
  Handshake,
  DollarSign,
  GraduationCap,
  Bell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";

import IdeasFeed from "@/components/ideas/IdeasFeed";
import AnonymousSuggestForm from "@/components/ideas/AnonymousSuggestForm";
import PipelineOverview from "@/components/pipeline/PipelineOverview";
import MembersSection from "./MembersSection";
import { GirihPattern } from "@/components/brand/GirihPattern";

const TABS = [
  { id: "ideas", icon: Rocket, comingSoon: false },
  { id: "services", icon: Handshake, comingSoon: true },
  { id: "funding", icon: DollarSign, comingSoon: true },
  { id: "education", icon: GraduationCap, comingSoon: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function HomeTabs() {
  const t = useTranslations("homeTabs");
  const [activeTab, setActiveTab] = useState<TabId>("ideas");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const handleNotify = (tabId: string) => {
    // In production, save to DB. For now, just show success.
    setNotified((prev) => new Set(prev).add(tabId));
    toast.success(t("notified"));
  };

  return (
    <div>
      {/* Tab bar — horizontally scrollable on narrow screens. */}
      <div className="sticky top-16 z-40 border-b-2 border-border bg-white/95 backdrop-blur-md dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-1.5 overflow-x-auto px-3 py-2 sm:gap-2 sm:px-4 sm:py-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition-colors sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base md:px-6 md:py-3 md:text-lg ${
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : tab.comingSoon
                      ? "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                      : "text-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                {t(`tab_${tab.id}`)}
                {tab.comingSoon && (
                  <span className="rounded-full bg-gradient-iran-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-iran-gold sm:px-2.5 sm:text-[11px]">
                    {t("soon")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "ideas" && (
        <div>
          <section className="mx-auto max-w-7xl px-4 py-8">
            <PipelineOverview />
          </section>
          <section id="ideas" className="mx-auto max-w-7xl px-4 py-12">
            <IdeasFeed />
          </section>
          <section className="mx-auto max-w-3xl px-4 py-8">
            <AnonymousSuggestForm />
          </section>
          <section className="mx-auto max-w-7xl px-4 py-12">
            <MembersSection />
          </section>
        </div>
      )}

      {activeTab === "services" && (
        <ComingSoonCard
          emoji="🤝"
          title={t("services_title")}
          description={t("services_desc")}
          notified={notified.has("services")}
          onNotify={() => handleNotify("services")}
          notifyEmail={notifyEmail}
          onEmailChange={setNotifyEmail}
          t={t}
        />
      )}

      {activeTab === "funding" && (
        <ComingSoonCard
          emoji="💰"
          title={t("funding_title")}
          description={t("funding_desc")}
          notified={notified.has("funding")}
          onNotify={() => handleNotify("funding")}
          notifyEmail={notifyEmail}
          onEmailChange={setNotifyEmail}
          t={t}
        />
      )}

      {activeTab === "education" && (
        <ComingSoonCard
          emoji="📚"
          title={t("education_title")}
          description={t("education_desc")}
          notified={notified.has("education")}
          onNotify={() => handleNotify("education")}
          notifyEmail={notifyEmail}
          onEmailChange={setNotifyEmail}
          t={t}
        />
      )}
    </div>
  );
}

function ComingSoonCard({
  emoji,
  title,
  description,
  notified,
  onNotify,
  notifyEmail,
  onEmailChange,
  t,
}: {
  emoji: string;
  title: string;
  description: string;
  notified: boolean;
  onNotify: () => void;
  notifyEmail: string;
  onEmailChange: (v: string) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-16 md:py-24">
      <GirihPattern
        position="full"
        opacity={0.04}
        color="text-iran-gold"
        size={110}
      />
      {/* Soft gold glow accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 mx-auto h-72 w-[70%] -translate-y-1/2 rounded-full bg-iran-gold/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl animate-fade-up">
        <div className="relative overflow-hidden rounded-3xl border-2 border-iran-gold/40 bg-white p-8 text-center shadow-iran-gold-lg animate-glow-pulse md:p-14 dark:bg-gray-950">
          {/* Prominent gold "Coming Soon" badge */}
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-iran-gold px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-iran-gold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("soon")}
            </span>
          </div>

          <span className="mb-6 inline-block text-7xl md:text-8xl" aria-hidden="true">
            {emoji}
          </span>

          <h2 className="display-text mb-4 text-3xl font-bold text-gradient-iran md:text-5xl">
            {title}
          </h2>
          <p className="mx-auto mb-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {description}
          </p>
          <p className="mx-auto mb-10 max-w-xl text-sm text-iran-deep-green/80 dark:text-iran-gold/80">
            {t("comingSoonTagline")}
          </p>

          {notified ? (
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-iran-green/10 px-5 py-3 text-base font-semibold text-iran-green dark:text-iran-bright-green">
              <Bell className="h-5 w-5" aria-hidden="true" />
              {t("youllBeNotified")}
            </div>
          ) : (
            <>
              <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="h-12 flex-1 rounded-full border-iran-green/30 px-5 text-base focus-visible:ring-iran-green"
                />
                <Button
                  onClick={onNotify}
                  className="h-12 rounded-full bg-iran-bright-green px-6 text-base font-semibold text-white shadow-iran-green-lg transition-all hover:bg-iran-green hover:shadow-iran-gold-lg"
                >
                  <Bell className="me-2 h-4 w-4" aria-hidden="true" />
                  {t("notifyMe")}
                </Button>
              </div>

              {/* Secondary CTAs — invite & feedback */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 hover:shadow-iran-gold dark:text-iran-gold"
                >
                  <Link href="/invite">{t("inviteFriendsCta")}</Link>
                </Button>
                <a
                  href="#feedback"
                  onClick={(e) => {
                    e.preventDefault();
                    // Dispatch a click on the floating feedback button
                    const btn = document.querySelector<HTMLButtonElement>(
                      "[data-feedback-button]"
                    );
                    btn?.click();
                  }}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-iran-green hover:underline"
                >
                  {t("shareFeedbackCta")}
                </a>
              </div>
            </>
          )}

          {/* Decorative bottom gold line */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-iran-gold to-transparent"
          />
        </div>
      </div>
    </section>
  );
}
