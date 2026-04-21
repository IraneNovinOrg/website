"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Github, Send, Twitter } from "lucide-react";
import LocaleSwitcher from "./LocaleSwitcher";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { GirihPattern } from "@/components/brand/GirihPattern";

export default function Footer() {
  const t = useTranslations("footer");

  const communityLinks = [
    { href: "/projects" as const, label: t("projects") },
    { href: "/members" as const, label: t("members") },
    { href: "/invite" as const, label: t("invite") },
  ];

  const resourceLinks: { href: string; label: string; external?: boolean }[] = [
    { href: "/#how-it-works", label: t("howItWorks") },
  ];

  const legalLinks = [
    { href: "/privacy" as const, label: t("privacy") },
    { href: "/terms" as const, label: t("terms") },
    { href: "/privacy#cookies" as const, label: t("cookies") },
  ];

  const socialLinks = [
    {
      href: "https://github.com/IranENovin",
      label: "GitHub",
      icon: Github,
    },
    {
      href: "https://t.me/IranENovin",
      label: "Telegram",
      icon: Send,
    },
    {
      href: "https://twitter.com/IranENovin",
      label: "Twitter / X",
      icon: Twitter,
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-border bg-white dark:bg-gray-950">
      {/* Subtle Girih pattern background */}
      <GirihPattern
        position="full"
        opacity={0.04}
        color="text-iran-green"
        size={80}
      />

      {/* Thin gold divider at very top of footer */}
      <div
        aria-hidden="true"
        className="h-[2px] w-full bg-gradient-to-r from-transparent via-iran-gold/40 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <LionSunLogo size="sm" />
              <span className="font-display text-lg font-bold tracking-tight text-gradient-iran">
                IranENovin
                <span className="hidden font-normal text-muted-foreground md:inline">
                  {" "}
                  <span aria-hidden="true">·</span>{" "}
                </span>
                <span
                  className="hidden font-farsi text-base font-bold text-gradient-iran md:inline"
                  dir="rtl"
                >
                  ایران نوین
                </span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
            <div className="mt-4">
              <LocaleSwitcher />
            </div>
          </div>

          {/* Community */}
          <div className="flex flex-col">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
              {t("members")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {communityLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-iran-green dark:hover:text-iran-bright-green"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="flex flex-col">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
              {t("howItWorks")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-iran-green dark:hover:text-iran-bright-green"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/IranENovin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-iran-green dark:hover:text-iran-bright-green"
                >
                  {t("poweredBy")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="flex flex-col">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
              {t("legalHeading")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-iran-green dark:hover:text-iran-bright-green"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div className="flex flex-col">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">
              Connect
            </h3>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-all hover:border-iran-gold/60 hover:bg-iran-green/5 hover:text-iran-green hover:shadow-iran-gold dark:hover:text-iran-bright-green"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Persian ornamental divider */}
        <div className="mt-12 flex items-center justify-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-iran-gold/40" />
          <span
            aria-hidden="true"
            className="inline-flex h-2 w-2 rotate-45 bg-iran-gold/60 shadow-iran-gold"
          />
          <span
            aria-hidden="true"
            className="inline-flex h-3 w-3 rotate-45 bg-iran-gold shadow-iran-gold"
          />
          <span
            aria-hidden="true"
            className="inline-flex h-2 w-2 rotate-45 bg-iran-gold/60 shadow-iran-gold"
          />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-iran-gold/40" />
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} IranENovin &middot;{" "}
          <span className="text-gradient-gold font-medium">
            {t("tagline")}
          </span>
        </div>
      </div>
    </footer>
  );
}
