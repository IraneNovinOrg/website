"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import CommentItem, { type ProjectComment } from "./CommentItem";
import CommentInput from "./CommentInput";
import {
  MessageCircle,
  Sparkles,
  Flame,
  ListFilter,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer } from "@/lib/motion";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DISCUSSION_CATEGORIES = [
  "all",
  "general",
  "ideas",
  "qa",
  "announcements",
] as const;

type CategoryKey = (typeof DISCUSSION_CATEGORIES)[number];
type ViewFilter = "all" | "ai" | "hot";

// Per-category accent tokens
const CATEGORY_ACCENTS: Record<
  CategoryKey,
  { active: string; inactive: string }
> = {
  all: {
    active: "bg-iran-green text-white shadow-iran-green",
    inactive:
      "bg-iran-green/5 text-iran-deep-green hover:bg-iran-green/10 border border-iran-green/20",
  },
  general: {
    active: "bg-iran-green text-white shadow-iran-green",
    inactive:
      "bg-iran-green/5 text-iran-deep-green hover:bg-iran-green/10 border border-iran-green/20",
  },
  ideas: {
    active: "bg-iran-gold text-white shadow-iran-gold",
    inactive:
      "bg-iran-gold/5 text-iran-gold hover:bg-iran-gold/10 border border-iran-gold/20",
  },
  qa: {
    active: "bg-persia-turquoise text-white shadow-sm",
    inactive:
      "bg-persia-turquoise/5 text-persia-turquoise hover:bg-persia-turquoise/10 border border-persia-turquoise/20",
  },
  announcements: {
    active: "bg-iran-red text-white shadow-iran-red",
    inactive:
      "bg-iran-red/5 text-iran-red hover:bg-iran-red/10 border border-iran-red/20",
  },
};

interface CommentThreadProps {
  comments: ProjectComment[];
  ideaId: string;
  session: any;
  isAdmin: boolean;
  onAuthOpen: () => void;
  refresh: () => void;
}

function getCommentCategory(body: string): string {
  const match = body.match(/\[(general|ideas|qa|announcements)\]/i);
  return match ? match[1].toLowerCase() : "general";
}

export default function CommentThread({
  comments,
  ideaId,
  session,
  isAdmin,
  onAuthOpen,
  refresh,
}: CommentThreadProps) {
  const t = useTranslations("projects");
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>("all");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [expandedAll, setExpandedAll] = useState(true);

  // Build reply tree from flat comment list
  const { topLevel, replyMap, localComments, aiReplyIds, threadReactionMap } =
    useMemo(() => {
      const sorted = [...comments].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const local = sorted.filter((c) => c.source !== "github");
      const map = new Map<string, ProjectComment[]>();
      const top: ProjectComment[] = [];

      for (const c of local) {
        if (c.reply_to) {
          const siblings = map.get(c.reply_to) || [];
          siblings.push(c);
          map.set(c.reply_to, siblings);
        } else {
          top.push(c);
        }
      }

      // Find top-level ids that have an AI reply anywhere in their subtree
      const aiIds = new Set<string>();
      const walk = (parentId: string): boolean => {
        const children = map.get(parentId) || [];
        let hasAi = false;
        for (const child of children) {
          const isAi =
            child.source === "ai" ||
            child.author_login === "AI Assistant" ||
            child.author_login === "ai-assistant";
          if (isAi || walk(child.id)) {
            hasAi = true;
          }
        }
        if (hasAi) aiIds.add(parentId);
        return hasAi;
      };
      for (const c of top) walk(c.id);

      // Count total descendants for "hot" sorting (proxy)
      const reactionMap = new Map<string, number>();
      const countDescendants = (parentId: string): number => {
        const children = map.get(parentId) || [];
        let n = children.length;
        for (const c of children) n += countDescendants(c.id);
        return n;
      };
      for (const c of top) reactionMap.set(c.id, countDescendants(c.id));

      return {
        topLevel: top,
        replyMap: map,
        localComments: local,
        aiReplyIds: aiIds,
        threadReactionMap: reactionMap,
      };
    }, [comments]);

  // Filter by category + view
  let displayed = topLevel;
  if (categoryFilter !== "all") {
    displayed = displayed.filter(
      (c) => getCommentCategory(c.body) === categoryFilter
    );
  }
  if (viewFilter === "ai") {
    displayed = displayed.filter((c) => aiReplyIds.has(c.id));
  } else if (viewFilter === "hot") {
    displayed = [...displayed].sort(
      (a, b) =>
        (threadReactionMap.get(b.id) || 0) - (threadReactionMap.get(a.id) || 0)
    );
  }

  // Handlers that call API
  const handleReply = async (parentId: string, text: string) => {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discussionId: ideaId,
        body: text,
        replyTo: parentId,
      }),
    });
    if (res.ok) {
      toast.success("Reply posted!");
      refresh();
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to post reply");
    }
  };

  const handleEdit = async (commentId: string, newBody: string) => {
    const res = await fetch("/api/comments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, body: newBody }),
    });
    if (res.ok) {
      refresh();
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to edit");
    }
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch("/api/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (res.ok) {
      toast.success("Comment deleted");
      refresh();
    } else {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete");
    }
  };

  const viewFilters: { key: ViewFilter; label: string; icon: JSX.Element }[] = [
    {
      key: "all",
      label: "All",
      icon: <ListFilter className="h-3.5 w-3.5" />,
    },
    {
      key: "ai",
      label: "With AI replies",
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
    {
      key: "hot",
      label: "Most reactions",
      icon: <Flame className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-iran-green/10">
            <MessageCircle className="h-5 w-5 text-iran-green" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Community Discussion
            </h2>
            <span className="text-xs text-muted-foreground">
              {localComments.length}{" "}
              {localComments.length === 1 ? "comment" : "comments"}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpandedAll((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-iran-green/40 hover:text-iran-green"
          aria-label={expandedAll ? "Collapse all" : "Expand all"}
        >
          {expandedAll ? (
            <>
              <ChevronsDownUp className="h-3.5 w-3.5" />
              Collapse all
            </>
          ) : (
            <>
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Expand all
            </>
          )}
        </button>
      </div>

      {/* Comment input */}
      <CommentInput
        ideaId={ideaId}
        session={session}
        onAuthOpen={onAuthOpen}
        onSubmit={refresh}
        showCategory
      />

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground me-1">
          Category:
        </span>
        {DISCUSSION_CATEGORIES.map((cat) => {
          const accent = CATEGORY_ACCENTS[cat];
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                isActive ? accent.active : accent.inactive
              )}
            >
              {t(cat) ||
                (cat === "qa"
                  ? "Q&A"
                  : cat.charAt(0).toUpperCase() + cat.slice(1))}
            </button>
          );
        })}
      </div>

      {/* View filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground me-1">
          View:
        </span>
        {viewFilters.map(({ key, label, icon }) => {
          const isActive = viewFilter === key;
          return (
            <button
              key={key}
              onClick={() => setViewFilter(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                isActive
                  ? "bg-iran-green text-white shadow-iran-green"
                  : "bg-iran-green/5 text-iran-deep-green hover:bg-iran-green/10 border border-iran-green/20"
              )}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>

      {/* Comment list */}
      {displayed.length === 0 ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-iran-green/20 p-10 text-center",
            "bg-gradient-to-br from-iran-green/5 via-transparent to-iran-gold/5"
          )}
        >
          {/* Subtle decorative pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 25%, #009B3A 1px, transparent 1px), radial-gradient(circle at 75% 75%, #D4A843 1px, transparent 1px)",
              backgroundSize: "32px 32px, 48px 48px",
            }}
          />
          <div className="relative flex flex-col items-center gap-3">
            <LionSunLogo size="lg" animate />
            <h3 className="text-lg font-bold text-foreground">
              Start the discussion
            </h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Share your thoughts and help shape this project.
            </p>
          </div>
        </div>
      ) : expandedAll ? (
        <motion.div
          className="space-y-3"
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="visible"
        >
          {displayed.map((comment) => {
            const replies = replyMap.get(comment.id) || [];
            return (
              <motion.div key={comment.id} variants={fadeUp}>
                <CommentItem
                  comment={comment}
                  replies={replies}
                  replyMap={replyMap}
                  depth={0}
                  maxDepth={3}
                  session={session}
                  isAdmin={isAdmin}
                  ideaId={ideaId}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  refresh={refresh}
                />
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <div className="space-y-2">
          {displayed.map((comment) => {
            const childCount = threadReactionMap.get(comment.id) || 0;
            return (
              <button
                key={comment.id}
                onClick={() => setExpandedAll(true)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-start transition-colors hover:border-iran-green/40 hover:bg-iran-green/5"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-iran-green" />
                <span className="flex-1 truncate text-sm text-foreground">
                  <span className="font-medium">
                    {comment.author_login || "Anonymous"}
                  </span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {comment.body.slice(0, 100)}
                    {comment.body.length > 100 ? "…" : ""}
                  </span>
                </span>
                {childCount > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {childCount}{" "}
                    {childCount === 1 ? "reply" : "replies"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
