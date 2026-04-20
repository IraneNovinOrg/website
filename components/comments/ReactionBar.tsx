"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const REACTION_TYPES = [
  { type: "upvote", emoji: "\uD83D\uDC4D", label: "Upvote" },
  { type: "heart", emoji: "\u2764\uFE0F", label: "Heart" },
  { type: "rocket", emoji: "\uD83D\uDE80", label: "Rocket" },
  { type: "eyes", emoji: "\uD83D\uDC40", label: "Eyes" },
  { type: "party", emoji: "\uD83C\uDF89", label: "Celebrate" },
] as const;

interface ReactionBarProps {
  commentId: string;
  session: any;
  onAuthOpen: () => void;
  /** GitHub upvotes to merge into the "upvote" count (default 0) */
  githubVoteCount?: number;
}

export default function ReactionBar({
  commentId,
  session,
  onAuthOpen,
  githubVoteCount = 0,
}: ReactionBarProps) {
  void githubVoteCount; // Merged server-side by the API; kept in props for callers
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReacted, setUserReacted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comments/reactions?commentIds=${encodeURIComponent(commentId)}`
      );
      if (res.ok) {
        const data = await res.json();
        // Support both legacy format { [commentId]: counts } and new format { counts, userReacted }
        if (data.counts) {
          if (data.counts[commentId]) {
            setCounts(data.counts[commentId]);
          }
          if (data.userReacted?.[commentId]) {
            setUserReacted(data.userReacted[commentId]);
          }
        } else if (data[commentId]) {
          setCounts(data[commentId]);
        }
      }
    } catch {
      // Silently fail on initial load
    }
  }, [commentId]);

  useEffect(() => {
    // Don't fetch for optimistic comments (they have no server data yet)
    if (!commentId.startsWith("opt-")) {
      fetchReactions();
    }
  }, [fetchReactions, commentId]);

  const handleToggle = async (reactionType: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!session) {
      onAuthOpen();
      return;
    }

    // Trigger animation
    setLastClicked(reactionType);
    setTimeout(() => setLastClicked(null), 400);

    // Optimistic update
    const wasReacted = !!userReacted[reactionType];
    const prevCounts = { ...counts };
    const prevUserReacted = { ...userReacted };

    setCounts((prev) => ({
      ...prev,
      [reactionType]: Math.max(
        0,
        (prev[reactionType] || 0) + (wasReacted ? -1 : 1)
      ),
    }));
    setUserReacted((prev) => ({
      ...prev,
      [reactionType]: !wasReacted,
    }));

    setLoading(reactionType);
    try {
      const res = await fetch("/api/comments/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, reactionType }),
      });

      if (res.ok) {
        const data = await res.json();
        setCounts(data.reactions);
        setUserReacted(data.userReacted);
      } else {
        // Rollback on failure
        console.error("Reaction toggle failed:", res.status);
        setCounts(prevCounts);
        setUserReacted(prevUserReacted);
      }
    } catch (err) {
      console.error("Reaction toggle error:", err);
      setCounts(prevCounts);
      setUserReacted(prevUserReacted);
    } finally {
      setLoading(null);
    }
  };

  // The API already merges github_vote_count into the upvote count for both
  // regular comments and idea-level reactions, so counts are ready to display.

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTION_TYPES.map(({ type, emoji, label }) => {
        const count = counts[type] || 0;
        const isActive = !!userReacted[type];
        const isLoading = loading === type;
        const isAnimating = lastClicked === type;
        const tooltip =
          count === 0
            ? `React with ${label}`
            : `${count} ${count === 1 ? "person" : "people"} reacted`;

        return (
          <button
            key={type}
            type="button"
            onClick={(e) => handleToggle(type, e)}
            disabled={isLoading}
            title={tooltip}
            aria-label={`${isActive ? "Remove" : "Add"} ${label} reaction`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all",
              "disabled:opacity-60",
              isActive
                ? "border-iran-gold/40 bg-iran-gold/10 text-foreground shadow-sm"
                : count > 0
                  ? "border-border bg-card text-foreground hover:border-iran-green/40 hover:bg-iran-green/5"
                  : "border-muted bg-transparent text-muted-foreground hover:border-iran-green/40 hover:bg-iran-green/5 hover:text-foreground"
            )}
          >
            <motion.span
              key={isAnimating ? `${type}-anim` : `${type}-idle`}
              className="text-sm leading-none"
              animate={
                isAnimating
                  ? { scale: [1, 1.3, 1], rotate: [0, 10, 0] }
                  : { scale: 1, rotate: 0 }
              }
              transition={{ duration: 0.3 }}
            >
              {emoji}
            </motion.span>
            <span className={cn("tabular-nums", count === 0 && "opacity-50")}>
              {count > 0 ? count : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
