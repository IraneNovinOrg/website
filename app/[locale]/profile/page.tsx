"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslations } from "next-intl";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SKILLS_TAXONOMY, type SkillCategory } from "@/lib/skills-taxonomy";
import AuthModal from "@/components/auth/AuthModal";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  MessageCircle,
  ExternalLink,
  Unlink,
  User as UserIcon,
  Globe,
  Clock,
  Sparkles,
  Link2,
  Crown,
  ShieldCheck,
  Trophy,
  Mail,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  avatar_url: string | null;
  github_login: string | null;
  telegram_chat_id: string | null;
  provider: string;
  created_at: string;
  location: string | null;
  timezone: string | null;
  languages: string[];
  hoursPerWeek: string | null;
  hours_per_week: string | null;
  categories: string[];
  telegramHandle: string | null;
  telegram_handle: string | null;
  linkedInUrl: string | null;
  linkedin_url: string | null;
  profileCompleted: boolean;
  profile_completed: boolean;
  trust_level?: number;
  reputation_score?: number;
  notification_prefs?: Record<string, boolean>;
}

const TRUST_META: Record<number, { label: string; badgeClass: string; Icon: any; advance: string }> = {
  1: {
    label: "New Member",
    badgeClass: "bg-muted text-muted-foreground border border-border",
    Icon: UserIcon,
    advance: "Post an idea or 3 comments to reach Contributor.",
  },
  2: {
    label: "Contributor",
    badgeClass: "bg-persia-turquoise/15 text-persia-turquoise-deep border border-persia-turquoise/40",
    Icon: Sparkles,
    advance: "Complete 5 tasks to reach Reviewer.",
  },
  3: {
    label: "Reviewer",
    badgeClass: "bg-iran-green/15 text-iran-deep-green border border-iran-green/40",
    Icon: ShieldCheck,
    advance: "Keep leading projects — Leads are selected by the community.",
  },
  4: {
    label: "Lead",
    badgeClass: "bg-iran-gold/15 text-iran-deep-green border border-iran-gold/40",
    Icon: Crown,
    advance: "Highest trust level — thank you for leading the way.",
  },
};

export default function ProfilePage() {
  const t = useTranslations("nav");
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramDeepLink, setTelegramDeepLink] = useState("");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Notification preferences (opt-in channels + categories). Empty object =
  // defaults ("in_app" always on, everything else off).
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(false);

  // Handle ?linkTelegram=TOKEN callback from the bot
  useEffect(() => {
    const linkToken = searchParams.get("linkTelegram");
    if (linkToken && session?.user) {
      fetch("/api/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: linkToken }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setTelegramLinked(true);
            toast.success("Telegram linked successfully!");
            // Remove token from URL
            window.history.replaceState({}, "", window.location.pathname);
          }
        })
        .catch(() => {});
    }
  }, [searchParams, session]);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          const p = data.profile;
          setProfile(p);
          setName(p.name || "");
          setBio(p.bio || "");
          setSkills(p.skills || []);
          setLocation(p.location || "");
          setLanguages(p.languages || []);
          setHoursPerWeek(p.hoursPerWeek || p.hours_per_week || "");
          setTelegramHandle(p.telegramHandle || p.telegram_handle || "");
          setLinkedInUrl(p.linkedInUrl || p.linkedin_url || "");
          setTelegramLinked(!!p.telegram_chat_id);
          const prefs = (p.notification_prefs || {}) as Record<string, boolean>;
          setEmailEnabled(!!prefs.email);
          setEmailDigestEnabled(!!prefs.emailDigest);
          // Auto-expand categories that have selected skills
          const expanded = new Set<string>();
          for (const [cat, catSkills] of Object.entries(SKILLS_TAXONOMY)) {
            if ((catSkills as readonly string[]).some((s) => (p.skills || []).includes(s))) {
              expanded.add(cat);
            }
          }
          setExpandedCategories(expanded);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio,
          skills,
          location: location || undefined,
          languages,
          hoursPerWeek: hoursPerWeek || undefined,
          telegramHandle: telegramHandle || undefined,
          linkedInUrl: linkedInUrl || undefined,
          profileCompleted: true,
          notificationPrefs: {
            // Preserve existing prefs the UI doesn't manage (Telegram toggles
            // live inside the bot's /settings) and overwrite only the email
            // keys we expose here.
            ...(profile?.notification_prefs || {}),
            email: emailEnabled,
            emailDigest: emailDigestEnabled,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setProfile(data.profile);
      toast.success("Profile saved!");
    } catch (e) {
      console.error("Save profile failed:", e);
      toast.error((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <LionSunLogo size="xl" />
        </div>
        <h1 className="mb-4 font-display text-3xl font-bold text-gradient-iran">
          {t("profile")}
        </h1>
        <div className="divider-ornament mx-auto mb-4 max-w-xs" />
        <p className="mb-6 text-muted-foreground">Sign in to view your profile</p>
        <Button
          onClick={() => setAuthOpen(true)}
          className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
        >
          {t("signIn")}
        </Button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const LANGUAGES = ["Farsi", "English", "Arabic", "Turkish", "French", "German", "Spanish"];
  const HOURS_OPTIONS = ["< 5", "5-10", "10-20", "20+", "full-time"];

  function computeCompletion(p: Profile | null): { pct: number; missing: string[] } {
    const checks: { field: keyof Profile; weight: number; label: string; isArray?: boolean; altField?: keyof Profile }[] = [
      { field: "name", weight: 20, label: "Full name" },
      { field: "bio", weight: 15, label: "Bio" },
      { field: "skills", weight: 25, label: "Skills", isArray: true },
      { field: "languages", weight: 10, label: "Languages", isArray: true },
      { field: "hours_per_week", weight: 10, label: "Hours per week" },
      { field: "location", weight: 10, label: "Location" },
      { field: "linkedin_url", weight: 10, label: "LinkedIn or social link", altField: "telegram_handle" },
    ];
    let total = 0;
    const missing: string[] = [];
    for (const c of checks) {
      const val = p?.[c.field];
      const altVal = c.altField ? p?.[c.altField] : null;
      const filled = c.isArray ? (Array.isArray(val) && val.length > 0) : (!!val || !!altVal);
      if (filled) total += c.weight;
      else missing.push(c.label);
    }
    return { pct: total, missing };
  }

  const trustLevel = profile?.trust_level ?? 1;
  const trustMeta = TRUST_META[trustLevel] || TRUST_META[1];
  const TrustIcon = trustMeta.Icon;
  const reputationScore = profile?.reputation_score ?? 0;
  const displayName = name || session.user?.name || "Member";
  const avatarSrc = profile?.avatar_url || session.user?.image || "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-2 flex items-center gap-4">
        <LionSunLogo size="lg" />
        <div>
          <h1 className="font-display text-3xl font-bold text-gradient-iran">
            {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">{session.user?.email}</p>
        </div>
      </div>
      <div className="divider-ornament mb-6" />

      {/* Trust + reputation strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {/* Trust level */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trust Level
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${trustMeta.badgeClass}`}>
              <TrustIcon className="h-3.5 w-3.5" />
              {trustMeta.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{trustMeta.advance}</p>
        </div>

        {/* Reputation */}
        <div className="card-hover-gold rounded-xl border border-iran-gold/20 bg-card p-4">
          <div className="mb-1 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-iran-gold" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reputation
            </span>
          </div>
          <div className="font-display text-4xl font-bold text-gradient-iran">
            {reputationScore}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Earned from comments, votes, and completed tasks.
          </p>
        </div>
      </div>

      {/* Profile completion meter */}
      {(() => {
        const { pct, missing } = computeCompletion(profile);
        return (
          <div className="mb-6 rounded-xl border border-iran-green/15 bg-card p-5 card-hover">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-base font-semibold text-iran-deep-green dark:text-iran-bright-green">
                Profile Completion
              </span>
              <span className="font-display text-2xl font-bold text-gradient-gold">
                {pct}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-iran-green/10 dark:bg-iran-green/5">
              <div
                className="h-full rounded-full gradient-iran-gold transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {missing.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Missing: {missing.join(", ")}
              </p>
            )}
          </div>
        );
      })()}

      <div className="space-y-6">
        {/* Basic info card */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-iran-green" />
            <h2 className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Basic Info
            </h2>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-iran-gold/30">
              {avatarSrc ? (
                <AvatarImage src={avatarSrc} />
              ) : null}
              <AvatarFallback className="bg-iran-green/10 p-0">
                <LionSunLogo size="xl" variant="mini" className="h-full w-full" />
              </AvatarFallback>
            </Avatar>
            <div>
              {profile?.github_login && (
                <p className="text-sm text-muted-foreground">@{profile.github_login}</p>
              )}
              <span className="mt-1 inline-flex items-center rounded-full border border-iran-green/30 bg-iran-green/10 px-2 py-0.5 text-xs font-medium text-iran-deep-green dark:text-iran-bright-green">
                {profile?.provider || "email"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="border-iran-green/30 focus:border-iran-green focus-visible:ring-iran-green/40 dark:border-iran-green/20"
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself..."
                rows={3}
                className="border-iran-green/30 focus:border-iran-green focus-visible:ring-iran-green/40 dark:border-iran-green/20"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Canada, Toronto"
                className="border-iran-green/30 focus:border-iran-green focus-visible:ring-iran-green/40 dark:border-iran-green/20"
              />
            </div>
          </div>
        </div>

        {/* Languages */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-5 w-5 text-iran-green" />
            <Label className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Languages
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                  languages.includes(lang)
                    ? "bg-iran-green text-white shadow-iran-green"
                    : "bg-iran-green/10 text-iran-deep-green hover:bg-iran-green/20 dark:text-iran-bright-green"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-iran-green" />
            <Label className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Hours per week
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {HOURS_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHoursPerWeek(h)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                  hoursPerWeek === h
                    ? "bg-iran-green text-white shadow-iran-green"
                    : "bg-iran-green/10 text-iran-deep-green hover:bg-iran-green/20 dark:text-iran-bright-green"
                }`}
              >
                {h} hrs
              </button>
            ))}
          </div>
        </div>

        {/* Skills taxonomy */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-iran-green" />
            <Label className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Skills & Expertise
            </Label>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Select all that apply. These help match you to projects.
          </p>

          {skills.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSkill(s)}
                  className="inline-flex items-center gap-1 rounded-full border border-iran-green/30 bg-iran-green/15 px-2.5 py-1 text-xs font-medium text-iran-deep-green transition-colors hover:border-iran-red/40 hover:bg-iran-red/10 hover:text-iran-red dark:text-iran-bright-green"
                >
                  {s}
                  <span className="text-muted-foreground">×</span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {(Object.keys(SKILLS_TAXONOMY) as SkillCategory[]).map((category) => {
              const catSkills = SKILLS_TAXONOMY[category];
              const selectedInCat = catSkills.filter((s) => skills.includes(s));
              const isExpanded = expandedCategories.has(category);

              return (
                <div
                  key={category}
                  className="rounded-lg border border-iran-green/15"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-start text-sm font-medium hover:bg-iran-green/5"
                  >
                    <span className="text-iran-deep-green dark:text-iran-bright-green">
                      {category}
                      {selectedInCat.length > 0 && (
                        <span className="ms-2 text-xs text-iran-gold">
                          ({selectedInCat.length})
                        </span>
                      )}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-iran-green" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-iran-green" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-1 border-t border-iran-green/15 px-3 py-2 sm:grid-cols-2">
                      {catSkills.map((skill) => (
                        <label
                          key={skill}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-iran-green/5"
                        >
                          <input
                            type="checkbox"
                            checked={skills.includes(skill)}
                            onChange={() => toggleSkill(skill)}
                            className="accent-iran-green"
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

        {/* Email notifications */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-5 w-5 text-iran-deep-green dark:text-iran-bright-green" />
            <Label className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Email Notifications
            </Label>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose which updates you want delivered to{" "}
            <span className="font-medium text-foreground">
              {session?.user?.email || "your email"}
            </span>
            . In-app and (if linked) Telegram channels stay on regardless.
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-iran-green/15 bg-iran-green/5 p-3 transition-colors hover:bg-iran-green/10 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-iran-green"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
              <span>
                <span className="block font-medium">Important updates</span>
                <span className="block text-xs text-muted-foreground">
                  Replies on your comments, reactions, task claims, project changes —
                  the same events you&apos;d see in your notification bell, also sent to email.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-iran-green/15 bg-iran-green/5 p-3 transition-colors hover:bg-iran-green/10 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-iran-green"
                checked={emailDigestEnabled}
                onChange={(e) => setEmailDigestEnabled(e.target.checked)}
              />
              <span>
                <span className="block font-medium">Weekly digest</span>
                <span className="block text-xs text-muted-foreground">
                  Saturday summary of what the community built, top ideas, and new projects.
                </span>
              </span>
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Saved when you click <span className="font-medium">Save profile</span> below.
          </p>
        </div>

        {/* Telegram bot */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#0088cc]" />
            <Label className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Telegram Notifications
            </Label>
          </div>
          {telegramLinked ? (
            <div className="flex items-center justify-between rounded-lg border border-iran-green/30 bg-iran-green/10 p-3">
              <div>
                <p className="text-sm font-medium text-iran-deep-green dark:text-iran-bright-green">
                  Telegram linked
                </p>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll receive notifications via the bot. Manage settings in Telegram with /settings.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-iran-red"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/telegram/link", { method: "DELETE" });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                      throw new Error(err.error || `Request failed (${res.status})`);
                    }
                    setTelegramLinked(false);
                    toast.success("Telegram unlinked");
                  } catch (e) {
                    console.error("Unlink Telegram failed:", e);
                    toast.error((e as Error).message || "Failed to unlink Telegram");
                  }
                }}
              >
                <Unlink className="me-1 h-3 w-3" />
                Unlink
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Get notified about tasks, reviews, and project updates directly in Telegram.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/telegram/link");
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                      throw new Error(err.error || `Request failed (${res.status})`);
                    }
                    const data = await res.json();
                    if (data.deepLink) {
                      setTelegramDeepLink(data.deepLink);
                      window.open(data.deepLink, "_blank");
                    } else {
                      throw new Error("No link returned");
                    }
                  } catch (e) {
                    console.error("Generate Telegram link failed:", e);
                    toast.error((e as Error).message || "Failed to generate link");
                  }
                }}
                className="gap-2 border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 dark:text-iran-bright-green"
              >
                <MessageCircle className="h-4 w-4" />
                Link Telegram
                <ExternalLink className="h-3 w-3" />
              </Button>
              {telegramDeepLink && (
                <p className="text-xs text-muted-foreground">
                  Link opened in Telegram. Press Start in the bot to complete linking.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Contact / social */}
        <div className="card-hover rounded-xl border border-iran-green/15 bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-iran-green" />
            <Label className="font-display text-xl text-iran-deep-green dark:text-iran-bright-green">
              Contact & Social
            </Label>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Telegram handle</Label>
              <Input
                value={telegramHandle}
                onChange={(e) => setTelegramHandle(e.target.value)}
                placeholder="@your_handle"
                className="border-iran-green/30 focus:border-iran-green focus-visible:ring-iran-green/40 dark:border-iran-green/20"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">LinkedIn</Label>
              <Input
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="border-iran-green/30 focus:border-iran-green focus-visible:ring-iran-green/40 dark:border-iran-green/20"
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 dark:text-iran-bright-green"
          >
            {t("signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
