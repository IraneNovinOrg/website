"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SKILLS_TAXONOMY, type SkillCategory } from "@/lib/skills-taxonomy";
import { CATEGORIES } from "@/lib/constants";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import AuthModal from "@/components/auth/AuthModal";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { toast } from "sonner";

const CATEGORY_EMOJIS: Record<string, string> = {
  Technology: "💻",
  "Medicine & Health": "🏥",
  "Law & Policy": "⚖️",
  "Economics & Finance": "💰",
  Engineering: "🔧",
  Education: "📚",
  "Social Sciences": "🧠",
  Creative: "🎨",
  Business: "📊",
  Other: "🔗",
};

const COUNTRIES = [
  "Iran", "USA", "Canada", "Germany", "UK", "France", "Sweden",
  "Australia", "Turkey", "UAE", "Netherlands", "Austria", "Other",
];

const TIME_OPTIONS = [
  { value: "< 5", label: "fewHours", desc: "fewHoursDesc" },
  { value: "5-10", label: "partTime", desc: "partTimeDesc" },
  { value: "10-20", label: "significant", desc: "significantDesc" },
  { value: "20+", label: "major", desc: "majorDesc" },
  { value: "full-time", label: "fullTime", desc: "fullTimeDesc" },
] as const;

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const tCat = useTranslations("categories");
  const { data: session } = useSession();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [skills, setSkills] = useState<string[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Step 2
  const [hoursPerWeek, setHoursPerWeek] = useState("");

  // Step 3
  const [categories, setInterestCategories] = useState<string[]>([]);

  // Step 4
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setTimezone("UTC");
    }
  }, []);

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <LionSunLogo size="xl" />
        </div>
        <h1 className="mb-2 font-display text-3xl font-bold text-gradient-iran">
          {t("title")}
        </h1>
        <div className="divider-ornament mx-auto mb-4 max-w-xs" />
        <p className="mb-6 text-muted-foreground">{t("signInFirst")}</p>
        <Button
          onClick={() => setAuthOpen(true)}
          className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
        >
          Sign In
        </Button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleInterest = (id: string) => {
    setInterestCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1: return skills.length > 0;
      case 2: return !!hoursPerWeek;
      case 3: return categories.length > 0;
      case 4: return !!country;
      default: return true;
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const location = city ? `${country}, ${city}` : country;
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills,
          hoursPerWeek,
          categories,
          location,
          timezone,
          profileCompleted: true,
        }),
      });
      if (res.ok) {
        toast.success(t("complete"));
        router.push("/");
      } else {
        toast.error("Failed to save profile");
      }
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  const topicCategories = CATEGORIES.filter((c) => c.id !== "all");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-0">
        {[1, 2, 3, 4].map((s, idx) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                s < step
                  ? "bg-iran-green text-white"
                  : s === step
                    ? "gradient-iran text-white shadow-iran-green ring-4 ring-iran-gold/30"
                    : "bg-iran-green/10 text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {idx < 3 && (
              <div
                className={`h-0.5 w-12 sm:w-20 ${
                  s < step ? "bg-iran-green" : "bg-iran-green/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Skills */}
      {step === 1 && (
        <div>
          <h2 className="mb-2 text-2xl font-bold">{t("step1Title")}</h2>
          <p className="mb-6 text-muted-foreground">{t("step1Desc")}</p>

          {skills.length > 0 && (
            <p className="mb-4 text-sm text-primary font-medium">
              {skills.length} {t("skillsSelected")}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(SKILLS_TAXONOMY) as SkillCategory[]).map((cat) => {
              const catSkills = SKILLS_TAXONOMY[cat];
              const selectedCount = catSkills.filter((s) => skills.includes(s)).length;
              const isExpanded = expandedCats.has(cat);

              return (
                <div
                  key={cat}
                  className={`rounded-xl border transition-colors ${
                    selectedCount > 0
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-white dark:bg-gray-900"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCat(cat)}
                    className="flex w-full items-center gap-3 p-4 text-start"
                  >
                    <span className="text-2xl">{CATEGORY_EMOJIS[cat] || "📌"}</span>
                    <div className="flex-1">
                      <p className="font-medium">{cat}</p>
                      <p className="text-xs text-muted-foreground">
                        {catSkills.length} {t("skillsAvailable")}
                        {selectedCount > 0 && (
                          <span className="ms-1 text-primary">
                            · {selectedCount} {t("selected")}
                          </span>
                        )}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3">
                      {catSkills.map((skill) => (
                        <label
                          key={skill}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={skills.includes(skill)}
                            onChange={() => toggleSkill(skill)}
                            className="accent-primary"
                          />
                          {skill}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Time */}
      {step === 2 && (
        <div>
          <h2 className="mb-2 text-2xl font-bold">{t("step2Title")}</h2>
          <p className="mb-6 text-muted-foreground">{t("step2Desc")}</p>

          <div className="space-y-3">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHoursPerWeek(opt.value)}
                className={`w-full rounded-xl border p-4 text-start transition-colors ${
                  hoursPerWeek === opt.value
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-white hover:border-gray-300 dark:bg-gray-900 dark:hover:border-gray-600"
                }`}
              >
                <p className="font-medium">{t(opt.label)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t(opt.desc)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Topics */}
      {step === 3 && (
        <div>
          <h2 className="mb-2 text-2xl font-bold">{t("step3Title")}</h2>
          <p className="mb-6 text-muted-foreground">{t("step3Desc")}</p>

          <div className="flex flex-wrap gap-2">
            {topicCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleInterest(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  categories.includes(cat.id)
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <span>{cat.emoji}</span>
                {tCat(cat.label)}
              </button>
            ))}
          </div>

          {categories.length > 0 && (
            <p className="mt-4 text-sm text-primary font-medium">
              {categories.length} {t("topicsSelected")}
            </p>
          )}
        </div>
      )}

      {/* Step 4: Location */}
      {step === 4 && (
        <div>
          <h2 className="mb-2 text-2xl font-bold">{t("step4Title")}</h2>
          <p className="mb-6 text-muted-foreground">{t("step4Desc")}</p>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("country")}</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("selectCountry")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{t("city")}</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("cityPlaceholder")}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{t("timezone")}</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/Toronto"
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("timezoneHint")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
        >
          {t("back")}
        </Button>

        {step < 4 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
          >
            {t("next")}
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={submitting || !canProceed()}
            className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
          >
            {submitting ? "..." : t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
