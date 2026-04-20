"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ThumbsUp,
  MessageCircle,
  Trash2,
  Edit3,
  Globe,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Send,
  Sparkles,
  Flame,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import ReactionBar from "@/components/comments/ReactionBar";
import { toast } from "sonner";
import {
  type Any,
  type ProjectComment,
  DISCUSSION_CATEGORIES,
} from "../types";

interface DiscussionTabProps {
  idea: Any;
  comments: ProjectComment[];
  voteCount: number;
  session: Any;
  ideaId: string;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  refresh: () => void;
  onAuthOpen: () => void;
}

export default function DiscussionTab({
  idea,
  comments,
  voteCount,
  session,
  ideaId,
  t,
  tCommon,
  refresh,
  onAuthOpen,
}: DiscussionTabProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [commentBody, setCommentBody] = useState("");
  const [commentCategory, setCommentCategory] = useState("general");
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "oldest" | "newest" | "reactions" | "ai"
  >("oldest");
  // Replies are expanded by default. We track the *collapsed* set so empty
  // state = all open, and the toggle flips membership.
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  // Optimistic local comments that haven't been fetched from server yet
  const [optimisticComments, setOptimisticComments] = useState<ProjectComment[]>([]);
  // Idea-level upvote state
  const [ideaUpvoted, setIdeaUpvoted] = useState(false);
  const [ideaVoteCount, setIdeaVoteCount] = useState(voteCount);

  // Refs for scrolling to new comments
  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const commentsListRef = useRef<HTMLDivElement>(null);

  // Sync voteCount prop changes
  useEffect(() => {
    setIdeaVoteCount(voteCount);
  }, [voteCount]);

  // Merge server comments with optimistic ones (remove optimistic once server has them)
  const serverIds = new Set(comments.map((c) => c.id));
  const mergedOptimistic = optimisticComments.filter((c) => !serverIds.has(c.id));
  const allComments = [...comments, ...mergedOptimistic].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const githubComments = allComments.filter((c) => c.source === "github");

  // Build reply map for ALL comments (both GitHub and local replies)
  const allReplyMap = new Map<string, ProjectComment[]>();
  const topLevelComments: ProjectComment[] = [];
  for (const c of allComments) {
    if (c.reply_to) {
      const siblings = allReplyMap.get(c.reply_to) || [];
      siblings.push(c);
      allReplyMap.set(c.reply_to, siblings);
    } else {
      topLevelComments.push(c);
    }
  }

  // Compute derived sort signals
  const replyCountFor = (id: string): number =>
    (allReplyMap.get(id) || []).length;
  const hasAiReplyFor = (id: string): boolean => {
    const children = allReplyMap.get(id) || [];
    return children.some(
      (c) => c.source === "ai" || c.author_login === "AI Assistant"
    );
  };

  // Build a unified sorted list of top-level comments
  const unifiedTopLevel = [...topLevelComments].sort((a, b) => {
    if (sortOrder === "reactions") {
      return replyCountFor(b.id) - replyCountFor(a.id);
    }
    if (sortOrder === "ai") {
      const aiDiff = Number(hasAiReplyFor(b.id)) - Number(hasAiReplyFor(a.id));
      if (aiDiff !== 0) return aiDiff;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    const diff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === "oldest" ? diff : -diff;
  });

  // Scroll to a specific comment element
  const scrollToComment = useCallback((commentId: string) => {
    // Small delay to let React render the new element
    setTimeout(() => {
      const el = commentRefs.current.get(commentId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Brief highlight effect
        el.classList.add("ring-2", "ring-iran-green/50");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-iran-green/50");
        }, 2000);
      }
    }, 100);
  }, []);

  const handlePost = async () => {
    if (commentBody.trim().length < 10) return;
    if (!session) { onAuthOpen(); return; }
    setPosting(true);

    // Build optimistic comment
    const tempId = `opt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const optimisticComment: ProjectComment = {
      id: tempId,
      body: commentCategory !== "general" ? `[${commentCategory}] ${commentBody}` : commentBody,
      author_login: session.user?.name || session.user?.email || "You",
      author_avatar: (session.user as Any)?.image || "",
      created_at: new Date().toISOString(),
      source: "local",
      reply_to: null,
    };

    // Add optimistic comment immediately
    setOptimisticComments((prev) => [...prev, optimisticComment]);
    const savedBody = commentBody;
    const savedCategory = commentCategory;
    setCommentBody("");
    setCommentCategory("general");
    setPreviewMode(false);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discussionId: ideaId,
          body: savedBody,
          category: savedCategory,
          replyTo: null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Replace optimistic with real comment
        if (data.comment) {
          setOptimisticComments((prev) =>
            prev.map((c) => (c.id === tempId ? { ...data.comment, created_at: data.comment.created_at || new Date().toISOString() } : c))
          );
          scrollToComment(data.comment.id);
        }
        toast.success("Comment posted!");
        refresh();
      } else {
        // Remove optimistic on failure
        setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentBody(savedBody);
        setCommentCategory(savedCategory);
        const err = await res.json();
        toast.error(err.error || "Failed to post comment");
      }
    } catch {
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentBody(savedBody);
      setCommentCategory(savedCategory);
      toast.error("Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (parentCommentId: string) => {
    if (replyText.trim().length < 10) return;
    if (!session) { onAuthOpen(); return; }
    setReplyPosting(true);

    // Build optimistic reply
    const tempId = `opt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const optimisticReply: ProjectComment = {
      id: tempId,
      body: replyText,
      author_login: session.user?.name || session.user?.email || "You",
      author_avatar: (session.user as Any)?.image || "",
      created_at: new Date().toISOString(),
      source: "local",
      reply_to: parentCommentId,
    };

    // Add optimistic reply and auto-expand the parent's replies
    setOptimisticComments((prev) => [...prev, optimisticReply]);
    // Ensure the parent's thread is visible after posting a reply.
    setCollapsedReplies((prev) => {
      if (!prev.has(parentCommentId)) return prev;
      const next = new Set(prev);
      next.delete(parentCommentId);
      return next;
    });
    const savedReplyText = replyText;
    setReplyText("");
    setReplyingTo(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discussionId: ideaId, body: savedReplyText, replyTo: parentCommentId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setOptimisticComments((prev) =>
            prev.map((c) => (c.id === tempId ? { ...data.comment, created_at: data.comment.created_at || new Date().toISOString() } : c))
          );
          scrollToComment(data.comment.id);
        }
        toast.success("Reply posted!");
        refresh();
      } else {
        setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
        setReplyText(savedReplyText);
        setReplyingTo(parentCommentId);
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to post reply");
      }
    } catch {
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
      setReplyText(savedReplyText);
      setReplyingTo(parentCommentId);
      toast.error("Failed to post reply");
    } finally {
      setReplyPosting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentBody.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/comments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, body: editCommentBody }),
      });
      if (res.ok) { setEditingCommentId(null); setEditCommentBody(""); refresh(); }
      else { const err = await res.json(); toast.error(err.error || "Failed to edit"); }
    } catch { toast.error("Failed to edit comment"); } finally { setSavingEdit(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) { refresh(); toast.success("Comment deleted"); }
      else { const err = await res.json(); toast.error(err.error || "Failed to delete"); }
    } catch { toast.error("Failed to delete comment"); }
  };

  const handleIdeaUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) { onAuthOpen(); return; }

    // Optimistic
    const wasUpvoted = ideaUpvoted;
    setIdeaUpvoted(true);
    setIdeaVoteCount((prev) => prev + (wasUpvoted ? 0 : 1));

    try {
      const res = await fetch(`/api/ideas/${ideaId}/vote`, { method: "POST" });
      const result = await res.json();
      if (result.voteCount !== undefined) {
        setIdeaVoteCount(result.voteCount);
        setIdeaUpvoted(true);
      }
      if (result.alreadyVoted) {
        // Already voted before
        setIdeaUpvoted(true);
      }
    } catch {
      // Rollback
      setIdeaUpvoted(wasUpvoted);
      setIdeaVoteCount(voteCount);
      toast.error("Failed to vote");
    }
  };

  const getCommentCategory = (body: string): string => {
    const match = body.match(/\[(general|ideas|qa|announcements)\]/i);
    return match ? match[1].toLowerCase() : "general";
  };

  const filteredUnifiedTopLevel =
    categoryFilter === "all"
      ? unifiedTopLevel
      : unifiedTopLevel.filter((c) => getCommentCategory(c.body) === categoryFilter);

  const isOwnComment = (comment: ProjectComment): boolean => {
    if (!session || comment.source !== "local") return false;
    return (
      session.user?.name === comment.author_login ||
      session.user?.email === comment.author_login
    );
  };

  const toggleReplies = (commentId: string) => {
    setCollapsedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  // Determine left border color class based on source (logical props for RTL)
  const sourceBorderClass = (source: string): string => {
    if (source === "github") return "border-s-4 border-s-iran-gold/60";
    if (source === "ai") return "border-s-4 border-s-iran-gold";
    return "border-s-4 border-s-iran-green";
  };

  // Determine background tint based on source
  const sourceBgClass = (source: string): string => {
    if (source === "ai")
      return "bg-gradient-to-r from-iran-gold/5 to-transparent";
    return "";
  };

  // Determine badge for source (brand colors)
  const sourceBadge = (comment: ProjectComment) => {
    if (comment.source === "github") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-iran-gold/20 bg-iran-gold/5 px-2 py-0.5 text-[10px] font-medium text-iran-gold">
          <Globe className="h-3 w-3" />
          From GitHub
        </span>
      );
    }
    if (comment.source === "ai") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-iran-gold/30 bg-iran-gold/10 px-2 py-0.5 text-[10px] font-medium text-iran-gold ring-2 ring-iran-gold/20 animate-gold-pulse">
          <Sparkles className="h-3 w-3" />
          AI Assistant
        </span>
      );
    }
    return null;
  };

  // Check if this comment's author is the discussion author
  const isAuthorBadge = (comment: ProjectComment) => {
    const discussionAuthor = idea.author_login || idea.author?.login;
    if (discussionAuthor && comment.author_login === discussionAuthor) {
      return (
        <span className="inline-flex items-center rounded-full bg-iran-gold/10 px-2 py-0.5 text-[10px] font-medium text-iran-gold border border-iran-gold/30">
          Author
        </span>
      );
    }
    return null;
  };

  // Unified renderComment function
  function renderComment(comment: ProjectComment, depth: number): JSX.Element {
    const replies = allReplyMap.get(comment.id) || [];
    const isTopLevel = depth === 0;
    const avatarSize = isTopLevel ? "h-9 w-9" : "h-7 w-7";
    const avatarFbSize = isTopLevel ? "text-xs" : "text-[10px]";
    const isExpanded = !collapsedReplies.has(comment.id);
    const canEdit = isOwnComment(comment);
    const isGithub = comment.source === "github";
    const isOptimistic = comment.id.startsWith("opt-");

    return (
      <div
        key={comment.id}
        ref={(el) => {
          if (el) commentRefs.current.set(comment.id, el);
          else commentRefs.current.delete(comment.id);
        }}
        className={cn("transition-all duration-300", isOptimistic && "opacity-70")}
      >
        <div
          className={cn(
            "group/comment rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-iran-green dark:bg-gray-900",
            sourceBorderClass(comment.source),
            sourceBgClass(comment.source)
          )}
        >
          {/* Author line */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
            <Avatar className={avatarSize}>
              <AvatarImage src={comment.author_avatar} />
              <AvatarFallback className={avatarFbSize}>
                {(comment.author_login || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {isGithub && comment.author_login ? (
                <a
                  href={`https://github.com/${comment.author_login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground hover:underline text-sm truncate"
                >
                  {comment.author_login}
                </a>
              ) : (
                <span className="font-semibold text-foreground text-sm truncate">
                  {comment.author_login || "Anonymous"}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(comment.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {sourceBadge(comment)}
              {isAuthorBadge(comment)}
            </div>
            {canEdit && (
              <div className="ms-auto flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingCommentId(comment.id);
                    setEditCommentBody(comment.body);
                  }}
                  className="rounded p-1.5 text-muted-foreground opacity-60 transition-all hover:text-iran-green hover:bg-iran-green/5 hover:opacity-100"
                  title="Edit"
                  aria-label="Edit comment"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteComment(comment.id);
                  }}
                  className="rounded p-1.5 text-muted-foreground opacity-60 transition-all hover:text-iran-red hover:bg-iran-red/10 hover:opacity-100"
                  title="Delete"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {editingCommentId === comment.id ? (
              <div className="space-y-3">
                <Textarea
                  value={editCommentBody}
                  onChange={(e) => setEditCommentBody(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditComment(comment.id);
                    }}
                    disabled={savingEdit || !editCommentBody.trim()}
                    className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green disabled:opacity-50"
                  >
                    {savingEdit ? "Saving..." : (t("saveEdit") || "Save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingCommentId(null);
                      setEditCommentBody("");
                    }}
                  >
                    {t("cancelEdit") || "Cancel"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <MarkdownRenderer content={comment.body} />
              </div>
            )}
          </div>

          {/* Reactions + reply count + action bar */}
          {editingCommentId !== comment.id && (
            <div className="px-4 pb-3 space-y-2">
              {/* Reaction bar (emoji reactions including upvote) */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <ReactionBar
                  commentId={comment.id}
                  session={session}
                  onAuthOpen={onAuthOpen}
                  githubVoteCount={comment.github_vote_count || 0}
                />
                {replies.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleReplies(comment.id); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-iran-green transition-colors"
                  >
                    {replies.length} {replies.length === 1 ? "reply" : "replies"}
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>

              {/* Reply button */}
              {depth < 2 && (
                <div className="flex items-center gap-4 pt-1 border-t border-border/30">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!session) { onAuthOpen(); return; }
                      setReplyingTo(replyingTo === comment.id ? null : comment.id);
                      setReplyText("");
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-iran-green transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t("reply") || "Reply"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Inline reply form */}
          {replyingTo === comment.id && (
            <div className="px-4 pb-4 pt-1">
              <div className="flex gap-3">
                {session && (
                  <Avatar className="mt-1 h-7 w-7 shrink-0">
                    <AvatarImage src={(session.user as Any)?.image} />
                    <AvatarFallback className="text-[10px]">
                      {(session.user?.name || session.user?.email || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("commentPlaceholder") || "Write a reply..."}
                    rows={2}
                    className="resize-none text-sm focus:border-iran-green/60 focus:ring-2 focus:ring-iran-green/40"
                    autoFocus
                  />
                  {replyText.length > 0 && replyText.trim().length < 10 && (
                    <p className="text-xs text-iran-red">Reply must be at least 10 characters</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReply(comment.id);
                      }}
                      disabled={replyPosting || replyText.trim().length < 10}
                      className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green disabled:opacity-50"
                    >
                      {replyPosting ? tCommon("loading") : (t("postReply") || "Reply")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setReplyingTo(null);
                      }}
                    >
                      {t("cancelEdit") || "Cancel"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nested replies */}
        {replies.length > 0 && (isExpanded || depth > 0) && (
          <div className="ms-10 mt-2 space-y-2 border-s-2 border-iran-green/20 ps-4">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  // ── Helpers for original post author display ──
  const authorLogin = idea.author_login || idea.author?.login;
  const authorAvatar = idea.author_avatar || idea.author?.avatarUrl;
  const authorName = idea.author_name || idea.author?.name || authorLogin;
  const authorProfileUrl = idea.author_profile_url || (authorLogin ? `https://github.com/${authorLogin}` : null);
  const createdDate = idea.created_at ? new Date(idea.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) : null;

  return (
    <div className="space-y-6">
      {/* ══════════════ Original Post Author + Body ══════════════ */}
      <div className="rounded-xl border border-iran-green/20 bg-white shadow-sm dark:bg-gray-900 overflow-hidden">
        {/* Author header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-gradient-to-r from-iran-green/5 via-transparent to-iran-gold/5">
          <Avatar className="h-11 w-11 ring-2 ring-iran-green/20">
            <AvatarImage src={authorAvatar} />
            <AvatarFallback className="text-sm font-bold bg-iran-green/10 text-iran-green">
              {(authorLogin || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {authorProfileUrl ? (
                <a
                  href={authorProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-foreground hover:underline text-base truncate"
                >
                  {authorName || authorLogin || "Unknown Author"}
                </a>
              ) : (
                <span className="font-bold text-foreground text-base truncate">
                  {authorName || authorLogin || "Unknown Author"}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-iran-green/10 px-2 py-0.5 text-[10px] font-semibold text-iran-green border border-iran-green/20">
                <User className="h-3 w-3 me-1" />
                Original Author
              </span>
              {idea.source === "iranazadabad" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-iran-gold/20 bg-iran-gold/5 px-2 py-0.5 text-[10px] font-medium text-iran-gold">
                  <Globe className="h-3 w-3" />
                  IranAzadAbad
                </span>
              )}
            </div>
            {createdDate && (
              <span className="text-xs text-muted-foreground">
                Posted {createdDate}
              </span>
            )}
          </div>
        </div>

        {/* Original post body */}
        {(idea.body || idea.body_preview) && (
          <div className="px-5 py-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <MarkdownRenderer content={idea.body || idea.body_preview || ""} />
            </div>
          </div>
        )}

        {/* Original post reactions: upvote + emoji reactions */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 border-t border-border/50 bg-muted/30">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Upvote button for the idea itself */}
            <button
              type="button"
              onClick={handleIdeaUpvote}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all",
                ideaUpvoted
                  ? "border-iran-green/40 bg-iran-green/10 text-iran-green shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-iran-green/40 hover:bg-iran-green/5 hover:text-iran-green"
              )}
              title={`${ideaVoteCount} upvotes`}
            >
              <ThumbsUp className={cn("h-4 w-4", ideaUpvoted && "fill-iran-green")} />
              <span className="tabular-nums font-semibold">{ideaVoteCount}</span>
              <span className="text-xs">upvotes</span>
            </button>

            {/* Reaction bar for the main idea (uses ideaId as commentId prefix) */}
            <ReactionBar
              commentId={`idea-${ideaId}`}
              session={session}
              onAuthOpen={onAuthOpen}
              githubVoteCount={0}
            />
          </div>

          {/* GitHub link */}
          {idea.source_url && (
            <a
              href={idea.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-iran-gold/10 border border-iran-gold/20 px-3 py-1.5 text-xs font-medium text-iran-gold hover:bg-iran-gold/20 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              View on GitHub
              <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* GitHub Discussion stats (if from IranAzadAbad) */}
      {idea.source_url && (
        <div className="rounded-xl border border-iran-gold/30 bg-gradient-to-r from-iran-gold/5 to-iran-gold/10 p-4 shadow-iran-gold">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Globe className="h-4 w-4 text-iran-gold shrink-0" />
              <div>
                <h3 className="font-bold text-iran-gold text-sm">
                  Original Discussion from IranAzadAbad
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {idea.github_vote_count || 0} GitHub upvotes
                  {" \u00B7 "}
                  {githubComments.filter((c) => !c.reply_to).length} comments
                  {" \u00B7 "}
                  {githubComments.filter((c) => c.reply_to).length} replies
                </p>
              </div>
            </div>
            <a
              href={idea.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-iran-gold px-4 py-2 text-sm font-semibold text-white shadow-iran-gold transition-all hover:bg-iran-gold/90 hover:shadow-iran-gold-lg shrink-0"
            >
              View Full Discussion
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* All Comments header with sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-iran-green/10">
            <MessageCircle className="h-5 w-5 text-iran-green" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              All Comments
            </h2>
            <span className="text-xs text-muted-foreground">
              {allComments.length} {allComments.length === 1 ? "comment" : "comments"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
          {[
            { key: "oldest" as const, label: "Oldest", icon: <Clock className="h-3.5 w-3.5" /> },
            { key: "newest" as const, label: "Most Recent", icon: <Clock className="h-3.5 w-3.5" /> },
            { key: "reactions" as const, label: "Most Reactions", icon: <Flame className="h-3.5 w-3.5" /> },
            { key: "ai" as const, label: "AI Highlights", icon: <Sparkles className="h-3.5 w-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSortOrder(key);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                sortOrder === key
                  ? key === "ai"
                    ? "bg-iran-gold text-white shadow-iran-gold"
                    : "bg-iran-green text-white shadow-iran-green"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter pills -- branded per category */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground me-1">Category:</span>
        {DISCUSSION_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat;
          const accent =
            cat === "ideas"
              ? {
                  active: "bg-iran-gold text-white shadow-iran-gold",
                  inactive:
                    "bg-iran-gold/5 text-iran-gold border border-iran-gold/20 hover:bg-iran-gold/10",
                }
              : cat === "qa"
                ? {
                    active: "bg-persia-turquoise text-white shadow-sm",
                    inactive:
                      "bg-persia-turquoise/5 text-persia-turquoise border border-persia-turquoise/20 hover:bg-persia-turquoise/10",
                  }
                : cat === "announcements"
                  ? {
                      active: "bg-iran-red text-white shadow-iran-red",
                      inactive:
                        "bg-iran-red/5 text-iran-red border border-iran-red/20 hover:bg-iran-red/10",
                    }
                  : {
                      active: "bg-iran-green text-white shadow-iran-green",
                      inactive:
                        "bg-iran-green/5 text-iran-deep-green border border-iran-green/20 hover:bg-iran-green/10",
                    };
          return (
            <button
              key={cat}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCategoryFilter(cat);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                isActive ? accent.active : accent.inactive
              )}
            >
              {t(cat)}
            </button>
          );
        })}
      </div>

      {/* Comments list */}
      {filteredUnifiedTopLevel.length === 0 ? (
        <div className="relative overflow-hidden rounded-xl border border-iran-green/20 bg-gradient-to-br from-iran-green/5 via-transparent to-iran-gold/5 p-10 text-center">
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
            <MessageCircle className="h-10 w-10 text-iran-green/40" />
            <p className="text-sm text-muted-foreground">{t("noDiscussions")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4" ref={commentsListRef}>
          {filteredUnifiedTopLevel.map((comment) => renderComment(comment, 0))}
        </div>
      )}

      {/* Comment input */}
      {session ? (
        <div className="rounded-xl border border-border bg-white shadow-sm transition-shadow focus-within:shadow-iran-green dark:bg-gray-900">
          {/* Write / Preview tabs */}
          <div className="flex items-center border-b border-border/50 px-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewMode(false);
              }}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                !previewMode
                  ? "border-iran-green text-iran-green"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Write
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewMode(true);
              }}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                previewMode
                  ? "border-iran-green text-iran-green"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Preview
            </button>
          </div>

          <div className="p-4">
            <div className="flex gap-3">
              <Avatar className="mt-1 h-8 w-8 shrink-0">
                <AvatarImage src={(session.user as Any)?.image} />
                <AvatarFallback className="text-xs">
                  {(session.user?.name || session.user?.email || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {previewMode ? (
                  <div className="min-h-[80px] rounded-lg border border-border bg-iran-green/5 p-3">
                    {commentBody.trim() ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <MarkdownRenderer content={commentBody} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Nothing to preview</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder={(t("commentPlaceholder") || "Share your thoughts...") + " (Markdown supported)"}
                    rows={4}
                    maxLength={4100}
                    className="resize-none border-border focus:border-iran-green/60 focus:ring-2 focus:ring-iran-green/40"
                  />
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {commentBody.length > 0 && commentBody.trim().length < 10 ? (
                    <p className="text-xs text-iran-red">Comment must be at least 10 characters</p>
                  ) : <span />}
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      commentBody.length > 4000
                        ? "text-iran-red font-semibold"
                        : commentBody.length > 3800
                          ? "text-iran-saffron"
                          : "text-muted-foreground"
                    )}
                    aria-live="polite"
                  >
                    {commentBody.length} / 4000
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <select
                    value={commentCategory}
                    onChange={(e) => setCommentCategory(e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:border-iran-green/60 focus:outline-none focus:ring-2 focus:ring-iran-green/40"
                  >
                    {DISCUSSION_CATEGORIES.filter((c) => c !== "all").map((cat) => (
                      <option key={cat} value={cat}>{t(cat)}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePost();
                    }}
                    disabled={posting || commentBody.trim().length < 10 || commentBody.length > 4000}
                    className="bg-iran-green text-white shadow-iran-green transition-all hover:bg-iran-deep-green hover:shadow-iran-green-lg disabled:opacity-50"
                  >
                    <Send className="me-2 h-4 w-4" />
                    {posting ? "Posting..." : (t("postComment") || "Comment")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-iran-green/30 bg-white p-6 text-center shadow-sm dark:bg-gray-900">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-iran-green/40" />
          <p className="text-sm text-muted-foreground">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAuthOpen();
              }}
              className="font-semibold text-iran-green hover:text-iran-deep-green hover:underline"
            >
              Sign in
            </button>{" "}
            to join the discussion
          </p>
        </div>
      )}
    </div>
  );
}
