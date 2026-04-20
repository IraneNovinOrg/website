"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AuthModal from "@/components/auth/AuthModal";
import { SKILLS_TAXONOMY, type SkillCategory } from "@/lib/skills-taxonomy";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ideaId: string;
  ideaTitle: string;
  onClose: () => void;
}

const TIME_OPTIONS = [
  "A few hours total",
  "2-5 hours/week",
  "5-10 hours/week",
  "10+ hours/week",
] as const;

export default function HelpOfferForm({ ideaId, onClose }: Props) {
  const t = useTranslations("help");
  const { data: session } = useSession();

  const [authOpen, setAuthOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState<string>("");
  const [wantNotifications, setWantNotifications] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
  };

  const canSubmit =
    description.length >= 50 &&
    description.length <= 500 &&
    skills.length >= 1 &&
    hoursPerWeek !== "" &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/help-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          skills,
          description,
          hoursPerWeek,
          wantNotifications,
        }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(
          data?.error || `Request failed (${res.status})`
        );
      }
      setSuccess(true);
    } catch (e) {
      console.error("Help offer submit failed:", e);
      const msg =
        (e as Error).message || "Something went wrong. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Not signed in
  if (!session?.user) {
    return (
      <div
        className="mt-3 rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Sign in to offer your help
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAuthOpen(true)}>
            Sign in
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <p className="text-sm text-green-700 dark:text-green-300">
          Thanks! The project team will see your offer.
        </p>
        <button
          onClick={onClose}
          className="mt-2 text-xs text-muted-foreground hover:underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 rounded-lg border border-border bg-gray-50 p-4 dark:bg-gray-900"
    >
      <h4 className="mb-3 text-sm font-medium">How You&apos;ll Contribute</h4>

      {/* Description textarea */}
      <div className="mb-3">
        <Label htmlFor="help-description" className="mb-1.5 text-xs">
          How can you contribute?
        </Label>
        <Textarea
          id="help-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe how you can help with this idea..."
          rows={3}
          minLength={50}
          maxLength={500}
          className="text-sm"
        />
        <p
          className={`mt-1 text-xs ${
            description.length > 500
              ? "text-red-500"
              : description.length >= 50
                ? "text-green-600"
                : "text-muted-foreground"
          }`}
        >
          {description.length}/500
          {description.length < 50 && ` (min 50)`}
        </p>
      </div>

      {/* Skills taxonomy */}
      <div className="mb-3">
        <Label className="mb-1.5 text-xs">
          Your relevant skills{" "}
          <span className="text-muted-foreground">(at least 1)</span>
        </Label>
        {skills.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className="ml-0.5 hover:opacity-70"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="max-h-60 space-y-0.5 overflow-y-auto rounded border border-border bg-white p-2 dark:bg-gray-800">
          {(Object.keys(SKILLS_TAXONOMY) as SkillCategory[]).map((category) => {
            const isOpen = expandedCategories.has(category);
            const categorySkills = SKILLS_TAXONOMY[category];
            const selectedInCategory = categorySkills.filter((s) =>
              skills.includes(s)
            ).length;

            return (
              <div key={category}>
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {category}
                  {selectedInCategory > 0 && (
                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                      {selectedInCategory}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="ml-5 space-y-0.5 pb-1">
                    {categorySkills.map((skill) => (
                      <label
                        key={skill}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
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

      {/* Time commitment */}
      <div className="mb-3">
        <Label className="mb-1.5 text-xs">Time you can dedicate</Label>
        <div className="space-y-1">
          {TIME_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <input
                type="radio"
                name="hoursPerWeek"
                value={option}
                checked={hoursPerWeek === option}
                onChange={() => setHoursPerWeek(option)}
                className="accent-primary"
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      {/* Notify checkbox */}
      <label className="mb-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={wantNotifications}
          onChange={(e) => setWantNotifications(e.target.checked)}
          className="accent-primary"
        />
        Notify me when this becomes a project
      </label>

      {error && (
        <p className="mb-2 text-xs text-red-500">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!canSubmit}
          size="sm"
          className="bg-primary text-white hover:bg-primary/90"
        >
          {submitting ? "Submitting..." : t("formSubmit")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
