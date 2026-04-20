"use client";

import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "@/i18n/routing";
import {
  ArrowUp,
  MessageCircle,
  Flame,
  CheckCircle2,
  Users,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthModal from "@/components/auth/AuthModal";
import IranAzadAbadBadge from "@/components/collaboration/IranAzadAbadBadge";
import { resolveEmoji } from "@/lib/emoji-map";
import HelpOfferForm from "@/components/ideas/HelpOfferForm";
import type { UnifiedIdea, PipelineStage } from "@/types";

function timeAgo(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (locale === "fa") {
    if (minutes < 60) return `${minutes.toLocaleString("fa-IR")} دقیقه`;
    if (hours < 24) return `${hours.toLocaleString("fa-IR")} ساعت`;
    return `${days.toLocaleString("fa-IR")} روز`;
  }
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

// Lion & Sun brand palette mapping for categories
const INDIGO_CAT =
  "bg-persia-indigo/10 text-persia-indigo border border-persia-indigo/30 dark:bg-persia-indigo/20 dark:text-white";
const GOLD_CAT =
  "bg-iran-gold/10 text-iran-deep-green border border-iran-gold/30 dark:bg-iran-gold/15 dark:text-iran-gold";
const TERRACOTTA_CAT =
  "bg-persia-terracotta/10 text-persia-clay border border-persia-terracotta/30 dark:bg-persia-terracotta/20 dark:text-persia-terracotta";
const GREEN_CAT =
  "bg-iran-green/10 text-iran-deep-green border border-iran-green/30 dark:bg-iran-green/20 dark:text-iran-bright-green";
const RED_CAT =
  "bg-iran-red/10 text-iran-red border border-iran-red/30 dark:bg-iran-red/20 dark:text-iran-red-bright";
const TURQUOISE_CAT =
  "bg-persia-turquoise/10 text-persia-turquoise-deep border border-persia-turquoise/30 dark:bg-persia-turquoise/20 dark:text-persia-turquoise";

function getCategoryColor(category: string): string {
  const key = category.toLowerCase().trim();
  // Technology / AI / Internet / Startup / Media → indigo
  if (["ai", "technology", "tech", "internet", "startup", "media"].includes(key)) {
    return INDIGO_CAT;
  }
  // Education / Tourism / Art & Culture → gold
  if (
    ["education", "tourism", "art & culture", "art-culture", "artculture"].includes(key)
  ) {
    return GOLD_CAT;
  }
  // Infrastructure / Smart cities / Manufacturing → terracotta
  if (
    ["infrastructure", "smart cities", "smart-cities", "smartcities", "manufacturing"].includes(
      key
    )
  ) {
    return TERRACOTTA_CAT;
  }
  // Energy / Environment / Agriculture → green
  if (["energy", "environment", "agriculture"].includes(key)) {
    return GREEN_CAT;
  }
  // Health → red
  if (["health", "healthcare"].includes(key)) {
    return RED_CAT;
  }
  // Finance → gold (heritage wealth)
  if (["finance"].includes(key)) {
    return GOLD_CAT;
  }
  // Default → turquoise (heritage accent)
  return TURQUOISE_CAT;
}

const STAGE_BADGE: Record<
  PipelineStage,
  { className: string; icon?: typeof Flame }
> = {
  submitted: {
    className:
      "bg-muted text-muted-foreground border border-border",
  },
  gaining: {
    className:
      "bg-iran-saffron/15 text-iran-deep-green border border-iran-saffron/40 dark:bg-iran-saffron/20 dark:text-iran-saffron",
    icon: Flame,
  },
  validated: {
    className:
      "bg-iran-green/15 text-iran-deep-green border border-iran-green/40 dark:bg-iran-green/20 dark:text-iran-bright-green",
    icon: CheckCircle2,
  },
  "team-forming": {
    className:
      "bg-persia-turquoise/15 text-persia-turquoise-deep border border-persia-turquoise/40 dark:bg-persia-turquoise/20 dark:text-persia-turquoise",
    icon: Users,
  },
  "active-project": {
    className:
      "bg-iran-green text-white shadow-iran-green border border-iran-green",
  },
  launched: {
    className:
      "bg-iran-gold text-iran-deep-green shadow-iran-gold border border-iran-gold",
    icon: Rocket,
  },
};

export default function IdeaCard({ idea }: { idea: UnifiedIdea }) {
  const t = useTranslations("ideas");
  const tHelp = useTranslations("help");
  const tPipeline = useTranslations("pipeline");
  const locale = useLocale();
  const { data: session } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [votes, setVotes] = useState(idea.voteCount);
  const [hasVoted, setHasVoted] = useState<boolean>(!!idea.hasVoted);
  const [voting, setVoting] = useState(false);
  const [voteAnimating, setVoteAnimating] = useState(false);
  const [helpFormOpen, setHelpFormOpen] = useState(false);
  const pendingVoteRef = useRef(false);

  const doVote = useCallback(async () => {
    setVoting(true);
    setVoteAnimating(true);
    setTimeout(() => setVoteAnimating(false), 300);
    // Optimistic toggle so the arrow responds instantly.
    setHasVoted((v) => !v);
    setVotes((n) => (hasVoted ? Math.max(n - 1, 0) : n + 1));
    try {
      const res = await fetch(`/api/ideas/${idea.id}/vote`, { method: "POST" });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Vote failed (${res.status})`);
      }
      const data = await res.json();
      // Sync to authoritative server state (covers races, backend truth).
      if (typeof data.voteCount === "number") setVotes(data.voteCount);
      if (typeof data.hasVoted === "boolean") setHasVoted(data.hasVoted);
    } catch (e) {
      // Roll back the optimistic update on failure.
      setHasVoted((v) => !v);
      setVotes((n) => (hasVoted ? n + 1 : Math.max(n - 1, 0)));
      console.error("Vote failed:", e);
      toast.error(
        (e as Error).message || "Something went wrong. Please try again."
      );
    } finally {
      setVoting(false);
    }
  }, [idea.id, hasVoted]);

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      pendingVoteRef.current = true;
      setAuthOpen(true);
      return;
    }

    if (voting) return;
    doVote();
  };

  // Auto-vote when session appears after auth modal
  useEffect(() => {
    if (session && pendingVoteRef.current) {
      pendingVoteRef.current = false;
      doVote();
    }
  }, [session, doVote]);

  const handleAuthClose = () => {
    setAuthOpen(false);
    // The useEffect above handles the pending vote when session updates
    if (pendingVoteRef.current && session) {
      pendingVoteRef.current = false;
      doVote();
    }
  };

  const catColor = getCategoryColor(idea.category);

  const stage = STAGE_BADGE[idea.stage];
  const StageIcon = stage.icon;
  const stageLabel =
    idea.stage !== "submitted"
      ? tPipeline(
          idea.stage as
            | "gaining"
            | "validated"
            | "team-forming"
            | "active-project"
            | "launched"
        )
      : null;

  const isTrending = idea.isTrending === true;

  return (
    <>
      <div className="flex h-full flex-col">
        <Link href={`/projects/${idea.id}`} className="flex-1">
          <div
            className={`group card-hover relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-5 ${
              isTrending
                ? "border-iran-gold/30 glow-gold animate-gold-pulse"
                : "border-iran-green/10 hover:border-iran-green/40"
            }`}
          >
            {/* Trending ribbon — top-start corner (opposite of IAB badge) */}
            {isTrending && (
              <div className="pointer-events-none absolute -start-10 top-3 z-10 -rotate-45 rtl:rotate-45">
                <span className="inline-flex items-center gap-1 bg-gradient-iran-gold px-10 py-1 text-[10px] font-bold uppercase tracking-wider text-iran-deep-green shadow-iran-gold">
                  <Flame className="h-3 w-3" />
                  <span dir="ltr">Trending</span>
                </span>
              </div>
            )}

            {/* IAB attribution badge (gold-themed, see IranAzadAbadBadge) */}
            {idea.source === "iranazadabad" && (
              <div className="absolute end-3 top-3 z-10">
                <IranAzadAbadBadge sourceUrl={idea.sourceUrl} />
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={catColor}>
                {resolveEmoji(idea.categoryEmoji)} {idea.category}
              </Badge>
              {stageLabel && (
                <Badge className={`text-xs ${stage.className}`}>
                  {StageIcon && <StageIcon className="me-1 h-3 w-3" />}
                  {stageLabel}
                </Badge>
              )}
              {idea.projectStatus === "active" && (
                <Badge className="bg-iran-green text-white text-xs shadow-iran-green">
                  🚀 Active Project
                </Badge>
              )}
              {idea.graduatedTo && idea.projectStatus !== "active" && (
                <Badge className="bg-persia-turquoise/15 text-persia-turquoise-deep border border-persia-turquoise/30 text-xs dark:bg-persia-turquoise/20 dark:text-persia-turquoise">
                  🔨 Project
                </Badge>
              )}
            </div>

            <div className="flex-1">
              <h3 className="mb-2 text-lg font-bold text-foreground transition-colors group-hover:text-iran-deep-green dark:group-hover:text-iran-bright-green">
                {idea.title}
              </h3>
              <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                {idea.bodyPreview}
              </p>

              {/* Task progress + feasibility */}
              {idea.taskCounts && idea.taskCounts.total > 0 && (
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{idea.taskCounts.completed}/{idea.taskCounts.total} tasks</span>
                      <span>{Math.round((idea.taskCounts.completed / idea.taskCounts.total) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-iran-green/10 dark:bg-iran-green/20">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-iran-green to-iran-gold transition-all"
                        style={{ width: `${Math.round((idea.taskCounts.completed / idea.taskCounts.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {idea.feasibility && (
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      idea.feasibility === 'green' ? 'bg-iran-green' :
                      idea.feasibility === 'yellow' ? 'bg-iran-saffron' :
                      idea.feasibility === 'orange' ? 'bg-persia-terracotta' :
                      'bg-iran-red'
                    }`} title={`Feasibility: ${idea.feasibility}`} />
                  )}
                </div>
              )}

              {/* Needs contributors badge */}
              {idea.projectStatus === "needs-contributors" && (
                <Badge className="mb-2 bg-iran-gold/15 text-iran-deep-green border border-iran-gold/40 text-xs dark:bg-iran-gold/20 dark:text-iran-gold">
                  Needs Contributors
                </Badge>
              )}
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-6 w-6 shrink-0 ring-1 ring-iran-gold/20">
                    <AvatarImage src={idea.author.avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {idea.author.login[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {idea.author.name || idea.author.login}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    &middot; {timeAgo(idea.createdAt, locale)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <button
                    onClick={handleVote}
                    disabled={voting}
                    className={`group/vote flex items-center gap-1 rounded-lg px-2 py-1 transition-all hover:bg-iran-green/10 active:bg-iran-green/20 ${
                      voteAnimating ? "scale-125" : "scale-100"
                    } ${hasVoted ? "bg-iran-green/10" : ""}`}
                    style={{ transition: "transform 0.15s ease-out" }}
                    aria-label={t("voteAction") as string}
                    aria-pressed={hasVoted}
                    title={hasVoted ? "Click to remove your vote" : undefined}
                  >
                    <ArrowUp
                      className={`h-4 w-4 transition-transform group-hover/vote:scale-110 ${
                        hasVoted
                          ? "fill-iran-deep-green text-iran-deep-green dark:fill-iran-bright-green dark:text-iran-bright-green"
                          : "text-iran-deep-green dark:text-iran-bright-green"
                      }`}
                      strokeWidth={hasVoted ? 2.5 : 2}
                    />
                    <span className="text-gradient-iran font-display text-base font-bold">
                      {locale === "fa" ? votes.toLocaleString("fa-IR") : votes}
                    </span>
                  </button>
                  <span className="flex items-center gap-1 text-sm text-iran-deep-green/70 dark:text-iran-bright-green/80">
                    <MessageCircle className="h-4 w-4" />
                    {locale === "fa"
                      ? idea.commentCount.toLocaleString("fa-IR")
                      : idea.commentCount}
                  </span>
                </div>
              </div>

              {/* Help offers count */}
              {idea.helpOffersCount > 0 && (
                <span className="mt-2 block text-xs text-muted-foreground">
                  {idea.helpOffersCount} {tHelp("countShort")}
                </span>
              )}

              {/* "Want to help?" pill */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHelpFormOpen(!helpFormOpen);
                }}
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-iran-gold/30 bg-iran-gold/10 px-3 py-1.5 text-xs font-medium text-iran-deep-green transition-all hover:bg-iran-gold/20 hover:shadow-iran-gold dark:bg-iran-gold/15 dark:text-iran-gold dark:hover:bg-iran-gold/25"
              >
                <Sparkles className="h-3 w-3" />
                {tHelp("button")}
              </button>
            </div>
          </div>
        </Link>

        {helpFormOpen && (
          <HelpOfferForm
            ideaId={idea.id}
            ideaTitle={idea.title}
            onClose={() => setHelpFormOpen(false)}
          />
        )}
      </div>

      <AuthModal
        open={authOpen}
        onClose={handleAuthClose}
        action={t("voteAction") as string}
      />
    </>
  );
}
