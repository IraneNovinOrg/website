"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Crown, ShieldCheck, Sparkles } from "lucide-react";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import type { Member } from "@/types";

type MemberWithTrust = Member & { trustLevel?: number };

function TrustBadge({ level }: { level?: number }) {
  if (!level || level < 2) return null;
  if (level === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-persia-turquoise/40 bg-persia-turquoise/15 px-2 py-0.5 text-[10px] font-medium text-persia-turquoise-deep">
        <Sparkles className="h-3 w-3" />
        Contributor
      </span>
    );
  }
  if (level === 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-iran-green/40 bg-iran-green/15 px-2 py-0.5 text-[10px] font-medium text-iran-deep-green">
        <ShieldCheck className="h-3 w-3" />
        Reviewer
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-iran-gold/40 bg-iran-gold/15 px-2 py-0.5 text-[10px] font-medium text-iran-deep-green">
      <Crown className="h-3 w-3 text-iran-gold" />
      Lead
    </span>
  );
}

export default function MembersPage() {
  const t = useTranslations("members");
  const [members, setMembers] = useState<MemberWithTrust[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => setMembers(data.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = members.filter((m) => {
    const matchesSearch =
      !search ||
      (m.name || m.login).toLowerCase().includes(search.toLowerCase()) ||
      m.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === "all" || m.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const roles = [
    { key: "all", label: t("filterAll") },
    { key: "admin", label: t("admins") },
    { key: "member", label: t("developers") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-2 flex items-center gap-3">
        <LionSunLogo size="md" />
        <h1 className="font-display text-3xl font-bold text-gradient-iran">
          {t("title")}
        </h1>
      </div>
      <div className="divider-ornament mb-4" />
      <p className="mb-6 text-sm text-muted-foreground">
        {t("searchPlaceholder")}
      </p>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-iran-green" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-10 border-iran-green/30 focus:border-iran-green focus-visible:ring-iran-green/40 dark:border-iran-green/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.key}
              onClick={() => setRoleFilter(r.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                roleFilter === r.key
                  ? "bg-iran-green text-white shadow-iran-green"
                  : "bg-iran-green/10 text-iran-deep-green hover:bg-iran-green/20 dark:text-iran-bright-green"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-iran-green/15 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div>
                  <Skeleton className="mb-1 h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LionSunLogo size="lg" className="mb-4 opacity-70" />
          <p className="text-lg font-medium text-iran-deep-green dark:text-iran-bright-green">
            {t("noMembers")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("searchPlaceholder")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => {
            const trust = member.trustLevel ?? 1;
            const ringClass =
              trust >= 4
                ? "ring-2 ring-iran-gold/60"
                : trust >= 3
                  ? "ring-2 ring-iran-green/40"
                  : trust >= 2
                    ? "ring-2 ring-persia-turquoise/40"
                    : "";
            return (
              <div
                key={member.login}
                className="card-hover-gold relative rounded-xl border border-iran-green/15 bg-card p-4"
              >
                {/* Trust badge — top end corner */}
                <div className="absolute end-3 top-3">
                  <TrustBadge level={member.trustLevel} />
                </div>

                <div className="mb-3 flex items-center gap-3">
                  <Avatar className={`h-12 w-12 ${ringClass}`}>
                    <AvatarImage src={member.avatarUrl} />
                    <AvatarFallback className="bg-iran-green/10 text-iran-deep-green">
                      {(member.name || member.login)[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-medium text-iran-deep-green dark:text-iran-bright-green">
                      {member.name || member.login}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      @{member.login}
                    </p>
                  </div>
                </div>

                {member.bio && (
                  <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                    {member.bio}
                  </p>
                )}

                {member.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full border border-iran-green/25 bg-iran-green/10 px-2 py-0.5 text-[11px] font-medium text-iran-deep-green dark:text-iran-bright-green"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
