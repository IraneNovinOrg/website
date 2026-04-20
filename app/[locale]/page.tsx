import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import CollaborationBanner from "@/components/collaboration/CollaborationBanner";
import TelegramBanner from "@/components/layout/TelegramBanner";
import HomeTabs from "./HomeTabs";
import HomeHero from "./HomeHero";
import { Lightbulb, Users, Cpu, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import WelcomeBanner from "@/components/onboarding/WelcomeBanner";
import { GirihPattern } from "@/components/brand/GirihPattern";

export default function HomePage() {
  const t = useTranslations("home");

  const steps = [
    { icon: Lightbulb, title: t("step1Title"), desc: t("step1Desc") },
    { icon: Users, title: t("step2Title"), desc: t("step2Desc") },
    { icon: Cpu, title: t("step3Title"), desc: t("step3Desc") },
    { icon: Rocket, title: t("step4Title"), desc: t("step4Desc") },
  ];

  return (
    <div>
      <CollaborationBanner />
      <TelegramBanner />

      {/* Hero Section (client) — includes Ferdowsi verse */}
      <HomeHero />

      <WelcomeBanner />

      {/* Tabbed content hub */}
      <HomeTabs />

      {/* How It Works / Journey */}
      <section
        id="how-it-works"
        className="relative overflow-hidden bg-persia-ivory px-4 py-20 dark:bg-gray-900/50"
      >
        <GirihPattern
          position="full"
          opacity={0.03}
          color="text-iran-green"
          size={100}
        />
        <div className="relative mx-auto max-w-6xl">
          {/* Ornamental title */}
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-iran-gold/70" />
            <span
              aria-hidden="true"
              className="inline-flex h-2.5 w-2.5 rotate-45 bg-iran-gold shadow-iran-gold"
            />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-iran-gold/70" />
          </div>
          <h2 className="display-text text-center text-3xl font-bold md:text-4xl">
            <span className="text-gradient-iran">{t("howItWorks")}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base text-muted-foreground">
            {t("heroSubtitle")}
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-white p-6 card-hover pattern-girih-subtle dark:bg-gray-950"
                >
                  {/* Numbered circle */}
                  <div className="relative mb-5 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-iran-gold text-lg font-bold text-white shadow-iran-gold">
                      {i + 1}
                    </div>
                    <Icon className="h-7 w-7 text-iran-green/70 transition-transform duration-300 group-hover:scale-110 dark:text-iran-bright-green/80" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                  {/* Decorative bottom accent line */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-iran-green via-iran-gold to-iran-green opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA banner */}
      <section className="relative overflow-hidden bg-gradient-iran px-4 py-20 text-center text-white md:py-24">
        <GirihPattern
          position="full"
          opacity={0.1}
          color="text-iran-gold"
          size={120}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-iran-gold to-transparent"
        />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="display-text text-3xl font-bold md:text-5xl">
            {t("joinCommunity")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
            {t("heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-iran-gold px-10 text-base font-semibold text-iran-deep-green shadow-iran-gold-lg transition-all hover:bg-iran-saffron hover:text-white"
            >
              <Link href="/submit">{t("submitIdea")}</Link>
            </Button>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-iran-gold to-transparent"
        />
      </section>
    </div>
  );
}
