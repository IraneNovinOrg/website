"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Brain, PenLine, Palette, MessageSquare } from "lucide-react";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { toast } from "sonner";

export default function JoinPage() {
  const t = useTranslations("join");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const cards = [
    { icon: Brain, title: t("expertise"), desc: t("expertiseDesc") },
    { icon: PenLine, title: t("writing"), desc: t("writingDesc") },
    { icon: Palette, title: t("design"), desc: t("designDesc") },
    { icon: MessageSquare, title: t("feedback"), desc: t("feedbackDesc") },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    try {
      await fetch("/api/anonymous-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[Join Request] ${form.get("name")}`,
          body: `**Name:** ${form.get("name")}\n**Email:** ${form.get("email")}\n**Skills:** ${form.get("skills")}\n**Wants to help with:** ${form.get("helpWith")}`,
          email: form.get("email"),
        }),
      });
      setSuccess(true);
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-10 text-center">
        <div className="mb-4 flex justify-center">
          <LionSunLogo size="xl" />
        </div>
        <h1 className="mb-2 font-display text-3xl font-bold text-gradient-iran">
          {t("title")}
        </h1>
        <div className="divider-ornament mx-auto mb-4 max-w-xs" />
        <p className="text-xl text-muted-foreground">{t("heroTitle")}</p>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        {cards.map((card, i) => (
          <div
            key={i}
            className="card-hover rounded-xl border border-iran-green/15 bg-card p-6"
          >
            <card.icon className="mb-3 h-8 w-8 text-iran-green" />
            <h3 className="mb-1 font-display text-lg font-bold text-iran-deep-green dark:text-iran-bright-green">
              {card.title}
            </h3>
            <p className="text-sm text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="mb-12">
        <h2 className="mb-6 font-display text-2xl font-bold text-iran-deep-green dark:text-iran-bright-green">
          {t("howToJoin")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-iran-green/10 font-display text-lg font-bold text-iran-deep-green">
              1
            </div>
            <p className="mb-3 text-sm font-medium">{t("step1")}</p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 dark:text-iran-bright-green"
            >
              <a
                href="https://github.com/signup"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("createGithub")}
              </a>
            </Button>
          </div>
          <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-iran-green/10 font-display text-lg font-bold text-iran-deep-green">
              2
            </div>
            <p className="mb-3 text-sm font-medium">{t("step2")}</p>
            <Button
              asChild
              size="sm"
              className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
            >
              <Link href="/">{t("signInHere")}</Link>
            </Button>
          </div>
          <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-iran-green/10 font-display text-lg font-bold text-iran-deep-green">
              3
            </div>
            <p className="mb-3 text-sm font-medium">{t("step3")}</p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 dark:text-iran-bright-green"
            >
              <Link href="/projects">{t("browseProjects")}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-iran-green/15 bg-gradient-to-br from-iran-green/5 via-transparent to-iran-gold/10 p-8">
        <h2 className="mb-2 font-display text-xl font-bold text-iran-deep-green dark:text-iran-bright-green">
          {t("orJoinWithout")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("orJoinWithoutDesc")}
        </p>

        {success ? (
          <p className="text-lg font-medium text-iran-deep-green dark:text-iran-bright-green">
            {t("joinSuccess")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>{t("nameField")}</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>{t("emailField")}</Label>
              <Input name="email" type="email" required />
            </div>
            <div>
              <Label>{t("skillsField")}</Label>
              <Textarea name="skills" rows={2} />
            </div>
            <div>
              <Label>{t("helpWith")}</Label>
              <Textarea name="helpWith" rows={2} />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
            >
              {t("submitJoin")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
