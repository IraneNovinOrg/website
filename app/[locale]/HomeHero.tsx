"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { SunMotif } from "@/components/brand/SunMotif";
import { GirihPattern } from "@/components/brand/GirihPattern";
import { IranMap } from "@/components/brand/IranMap";
import { fadeUp, staggerContainer, float } from "@/lib/motion";
import StatsBar from "./StatsBar";

// Deterministic particle positions to avoid SSR/CSR hydration mismatch.
const PARTICLES: Array<{ left: string; delay: string; duration: string; size?: string }> = [
  { left: "6%",  delay: "0s",    duration: "16s", size: "particle-sm" },
  { left: "14%", delay: "2.4s",  duration: "18s" },
  { left: "22%", delay: "5.1s",  duration: "14s", size: "particle-lg" },
  { left: "30%", delay: "1.2s",  duration: "20s" },
  { left: "38%", delay: "7.6s",  duration: "15s", size: "particle-sm" },
  { left: "47%", delay: "3.3s",  duration: "17s" },
  { left: "55%", delay: "9.8s",  duration: "19s", size: "particle-lg" },
  { left: "63%", delay: "0.6s",  duration: "14s" },
  { left: "71%", delay: "4.7s",  duration: "16s", size: "particle-sm" },
  { left: "79%", delay: "6.2s",  duration: "18s" },
  { left: "87%", delay: "8.4s",  duration: "15s" },
  { left: "94%", delay: "2.9s",  duration: "17s", size: "particle-lg" },
];

export default function HomeHero() {
  const t = useTranslations("home");

  return (
    <section className="relative overflow-hidden bg-gradient-hero px-4 py-10 text-center text-white md:py-14 lg:py-16">
      {/* Slow ken-burns-style gradient shift (behind everything) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-kenburns bg-gradient-hero"
      />

      {/* Dual-ring rotating sun burst - decorative */}
      <SunMotif
        spin
        dual
        className="absolute -top-32 -end-32 h-[800px] w-[800px] text-iran-gold"
        opacity={0.12}
      />

      {/* Iran map outline floating behind the emblem */}
      <IranMap
        className="inset-0 m-auto w-3/4 max-w-2xl"
        opacity={0.05}
        color="text-iran-gold"
      />

      {/* Girih pattern overlay */}
      <GirihPattern
        position="bottom-right"
        opacity={0.08}
        color="text-iran-gold"
        size={140}
      />

      {/* Arabesque flourishes — gentle fade in/out */}
      <div
        aria-hidden="true"
        className="arabesque-flourish top-[12%] start-[6%] h-36 w-36 text-iran-gold"
        style={{ animationDelay: "0s" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/girih-pattern.svg"
          alt=""
          className="h-full w-full"
          style={{ filter: "drop-shadow(0 0 6px rgba(244,180,60,0.3))" }}
        />
      </div>
      <div
        aria-hidden="true"
        className="arabesque-flourish bottom-[18%] end-[5%] h-28 w-28 text-iran-gold"
        style={{ animationDelay: "4.5s" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/girih-pattern.svg"
          alt=""
          className="h-full w-full"
          style={{ filter: "drop-shadow(0 0 6px rgba(244,180,60,0.3))" }}
        />
      </div>

      {/* Drifting gold particles */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`particle ${p.size ?? ""}`}
            style={{
              left: p.left,
              bottom: "-10px",
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Soft gold glow accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 mx-auto h-64 w-[80%] -translate-y-1/2 rounded-full bg-iran-gold/10 blur-3xl"
      />

      <motion.div
        variants={staggerContainer(0.12)}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center"
      >
        {/* English headline — ABOVE the logo */}
        <motion.h1
          variants={fadeUp}
          className="display-text text-display-md md:text-display-lg lg:text-display-xl leading-[1.05]"
        >
          <span className="text-white">Build </span>
          <span className="text-gradient-gold">Iran</span>
          <span className="text-white">&rsquo;s Future.</span>
          <br />
          <span className="text-white/95">Together.</span>
        </motion.h1>

        {/* Farsi headline */}
        <motion.p
          variants={fadeUp}
          className="mt-3 font-farsi text-2xl font-bold text-white/90 md:text-3xl"
          dir="rtl"
        >
          {t("heroTitleFa")}
        </motion.p>

        {/* BIG CENTRAL LOGO — the Next.js Image pipeline serves an optimized
            AVIF/WebP variant at the right DPR, and `priority` tells the
            browser to preload it so it doesn't starve LCP behind third-party
            fonts + hero-decoration JS. sizes matches the Tailwind breakpoints
            below so we never download the full 1451×1447 PNG. */}
        <motion.div variants={fadeUp} className="relative my-6 md:my-8">
          <motion.div animate={float} className="flex items-center justify-center">
            <Image
              src="/brand/iranenovin_no_bg1_white.png"
              alt="IranENovin"
              width={480}
              height={480}
              priority
              fetchPriority="high"
              sizes="(min-width: 1024px) 480px, (min-width: 768px) 384px, 288px"
              className="h-72 w-72 object-contain drop-shadow-[0_10px_40px_rgba(218,165,32,0.5)] md:h-96 md:w-96 lg:h-[30rem] lg:w-[30rem]"
              draggable={false}
            />
          </motion.div>
        </motion.div>

        {/* Ferdowsi Persian verse — bold, prominent, below the logo */}
        <motion.p
          variants={fadeUp}
          lang="fa"
          dir="rtl"
          className="mt-2 px-2 font-farsi text-2xl font-extrabold leading-[1.5] text-iran-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-3xl md:text-5xl md:leading-[1.5]"
        >
          چو ایران نباشد تن من مباد
        </motion.p>
        <motion.p
          variants={fadeUp}
          className="mt-1 text-sm italic text-white/70 md:text-base"
        >
          — Ferdowsi
        </motion.p>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl"
        >
          {t("heroSubtitle")}
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="mt-6 flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-iran-bright-green px-6 text-base font-semibold text-white shadow-iran-green-lg transition-all hover:bg-iran-green hover:shadow-iran-gold-lg sm:px-8"
          >
            <Link href="/submit">{t("submitIdea")}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-full border-2 border-iran-gold bg-transparent px-6 text-base font-semibold text-iran-gold transition-all hover:bg-iran-gold hover:text-iran-deep-green hover:shadow-iran-gold-lg sm:px-8"
          >
            <a href="#ideas">{t("exploreIdeas")}</a>
          </Button>
        </motion.div>

        {/* Stats - integrated into hero */}
        <motion.div variants={fadeUp} className="mt-8 w-full pb-2">
          <StatsBar />
        </motion.div>
      </motion.div>

      {/* Bottom decorative gold gradient line */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-iran-gold to-transparent"
      />
    </section>
  );
}
