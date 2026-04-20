"use client";

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import ReactionBar from "./ReactionBar";
import {
  Edit3,
  Trash2,
  CornerDownRight,
  Crown,
  Shield,
  UserCircle2,
  Github,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProjectComment {
  id: string;
  body: string;
  author_login: string;
  author_avatar: string;
  created_at: string;
  source: string;
  reply_to?: string | null;
  github_vote_count?: number;
  is_owner?: boolean;
  is_lead?: boolean;
}

interface CommentItemProps {
  comment: ProjectComment;
  replies: ProjectComment[];
  replyMap: Map<string, ProjectComment[]>;
  depth: number;
  maxDepth?: number;
  session: any;
  isAdmin: boolean;
  ideaId: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  onEdit: (commentId: string, newBody: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  refresh: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const normalized =
    dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
  const now = Date.now();
  const then = new Date(normalized).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type RoleKind = "ai" | "owner" | "lead" | "contributor";

function detectRole(comment: ProjectComment): RoleKind {
  if (
    comment.source === "ai" ||
    comment.author_login === "AI Assistant" ||
    comment.author_login === "ai-assistant"
  ) {
    return "ai";
  }
  if (comment.is_owner) return "owner";
  if (comment.is_lead) return "lead";
  return "contributor";
}

function hasMarkdown(body: string): boolean {
  if (!body) return false;
  // Quick markdown detection: bold/italic, headings, lists, code blocks, blockquotes, double newlines
  return (
    /\*\*|__|^#{1,6}\s|^[-*+]\s|^\d+\.\s|```|^>\s/m.test(body) ||
    /\n\s*\n/.test(body) ||
    /\[[^\]]+\]\([^)]+\)/.test(body)
  );
}

// ─── Role badge ─────────────────────────────────────────────────

function RoleBadge({ role }: { role: RoleKind }) {
  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full";

  if (role === "ai") {
    return (
      <span
        className={cn(
          base,
          "bg-iran-gold/10 text-iran-gold ring-2 ring-iran-gold/40 animate-gold-pulse"
        )}
        title="AI Assistant"
      >
        <LionSunLogo size="xs" variant="mini" className="h-3.5 w-3.5" />
        <span className="text-iran-gold">AI</span>
      </span>
    );
  }
  if (role === "owner") {
    return (
      <span
        className={cn(
          base,
          "text-iran-gold bg-iran-gold/10 border border-iran-gold/30"
        )}
        title="Project Owner"
      >
        <Crown className="h-3 w-3" />
        Owner
      </span>
    );
  }
  if (role === "lead") {
    return (
      <span
        className={cn(
          base,
          "text-iran-green bg-iran-green/10 border border-iran-green/30"
        )}
        title="Project Lead"
      >
        <Shield className="h-3 w-3" />
        Lead
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        "text-persia-turquoise bg-persia-turquoise/10 border border-persia-turquoise/30"
      )}
      title="Contributor"
    >
      <UserCircle2 className="h-3 w-3" />
      Contributor
    </span>
  );
}

// ─── Connector (curved tree line) ───────────────────────────────

function TreeConnector({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute start-0 top-0 h-full w-6"
    >
      {/* vertical stripe */}
      <span className="absolute start-2 top-0 h-full w-px bg-iran-green/20" />
      {/* curved connector into card */}
      <svg
        className="absolute start-2 top-3 h-4 w-4 text-iran-green/30"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M0 0 Q0 10 8 10 L16 10" />
      </svg>
    </span>
  );
}

// ─── Depth class helper ─────────────────────────────────────────

function getDepthWrapper(depth: number): string {
  if (depth === 0) return "";
  // Use logical properties for RTL
  if (depth === 1) return "ms-6 ps-6 relative";
  if (depth === 2) return "ms-10 ps-6 relative";
  return "ms-12 ps-6 relative";
}

// ─── Main component ─────────────────────────────────────────────

export default function CommentItem({
  comment,
  replies,
  replyMap,
  depth,
  maxDepth = 3,
  session,
  isAdmin,
  ideaId: _ideaId,
  onReply,
  onEdit,
  onDelete,
  refresh: _refresh,
}: CommentItemProps) {
  void _ideaId;
  void _refresh;

  const t = useTranslations("projects");
  const [replyingTo, setReplyingTo] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const role = useMemo(() => detectRole(comment), [comment]);

  const isOwnComment =
    session &&
    comment.source === "local" &&
    (session.user?.name === comment.author_login ||
      session.user?.email === comment.author_login);

  const canDelete = isOwnComment || (isAdmin && comment.source === "local");
  const isAi = role === "ai";
  const isOwner = role === "owner";
  const shouldRenderMarkdown = hasMarkdown(comment.body);

  const handleReply = async () => {
    if (replyText.trim().length < 10) return;
    setReplyPosting(true);
    try {
      await onReply(comment.id, replyText);
      setReplyText("");
      setReplyingTo(false);
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setReplyPosting(false);
    }
  };

  const handleEdit = async () => {
    if (!editBody.trim()) return;
    setSavingEdit(true);
    try {
      await onEdit(comment.id, editBody);
      setEditing(false);
      setEditBody("");
    } catch {
      toast.error("Failed to edit comment");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(comment.id);
      setConfirmDelete(false);
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setDeleting(false);
    }
  };

  // Card tint based on role
  const cardTintClass = isAi
    ? "bg-gradient-to-r from-iran-gold/5 to-transparent border-s-2 border-iran-gold"
    : isOwner
      ? "bg-iran-green/5 border-s-2 border-iran-green"
      : "bg-card";

  return (
    <div className={getDepthWrapper(depth)}>
      <TreeConnector depth={depth} />

      <div
        className={cn(
          "rounded-lg border border-border p-4 transition-shadow hover:shadow-sm animate-fade-up",
          cardTintClass
        )}
      >
        {/* Header */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Avatar
            className={cn(
              "h-8 w-8",
              isAi && "ring-2 ring-iran-gold/40",
              isOwner && "ring-2 ring-iran-green/40"
            )}
          >
            <AvatarImage src={comment.author_avatar} />
            <AvatarFallback className="text-xs">
              {(comment.author_login || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <span className="text-sm font-semibold text-foreground">
            {comment.author_login || "Anonymous"}
          </span>

          <RoleBadge role={role} />

          {comment.source === "github" && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-iran-gold/20 bg-iran-gold/5 px-2 py-0.5 text-[10px] font-medium text-iran-gold"
              title="Imported from GitHub"
            >
              <Github className="h-3 w-3" />
              GitHub
            </span>
          )}
          {comment.source === "github" &&
            (comment.github_vote_count ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-iran-gold/20 bg-iran-gold/5 px-1.5 py-0.5 text-[10px] font-medium text-iran-gold"
                title="GitHub thumbs-up reactions"
              >
                ↑ {comment.github_vote_count}
              </span>
            )}

          <span className="text-xs text-muted-foreground">
            {timeAgo(comment.created_at)}
          </span>

          {/* Edit/Delete controls — ALWAYS visible on own comments */}
          {(isOwnComment || canDelete) && (
            <div className="ms-auto flex items-center gap-1">
              {isOwnComment && !editing && !confirmDelete && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditBody(comment.body);
                  }}
                  className="rounded p-1 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:text-iran-green"
                  title="Edit"
                  aria-label="Edit comment"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && !confirmDelete && !editing && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded p-1 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:text-iran-red"
                  title="Delete"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-1 animate-scale-in">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 rounded-md bg-iran-red/10 px-2 py-0.5 text-xs font-medium text-iran-red hover:bg-iran-red/20 disabled:opacity-50"
                    aria-label="Confirm delete"
                  >
                    <Check className="h-3 w-3" />
                    {deleting ? "..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
                    aria-label="Cancel delete"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="mb-2 space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="border-border focus:border-iran-green/60 focus:ring-2 focus:ring-iran-green/40"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleEdit}
                disabled={savingEdit || !editBody.trim()}
                className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green disabled:opacity-50"
              >
                {savingEdit ? "..." : t("saveEdit") || "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setEditBody("");
                }}
              >
                {t("cancelEdit") || "Cancel"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-3 text-sm leading-relaxed text-foreground">
            {shouldRenderMarkdown ? (
              <MarkdownRenderer content={comment.body} />
            ) : (
              <p className="whitespace-pre-wrap">{comment.body}</p>
            )}
          </div>
        )}

        {/* Reaction bar — ALWAYS visible */}
        <div className="mb-2">
          <ReactionBar
            commentId={comment.id}
            session={session}
            onAuthOpen={() => {}}
          />
        </div>

        {/* Reply button */}
        {depth < maxDepth && !editing && (
          <button
            onClick={() => {
              if (!session) return;
              setReplyingTo(!replyingTo);
              setReplyText("");
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-iran-green"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            {t("reply") || "Reply"}
          </button>
        )}

        {/* Reply form */}
        {replyingTo && (
          <div className="mt-3 space-y-2 border-t border-border pt-3 animate-fade-up">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t("commentPlaceholder") || "Write a reply..."}
              rows={2}
              className="border-border focus:border-iran-green/60 focus:ring-2 focus:ring-iran-green/40"
            />
            {replyText.length > 0 && replyText.trim().length < 10 && (
              <p className="text-xs text-iran-red">
                Reply must be at least 10 characters
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleReply}
                disabled={replyPosting || replyText.trim().length < 10}
                className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green disabled:opacity-50"
              >
                {replyPosting ? "Posting..." : t("postReply") || "Reply"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReplyingTo(false)}
              >
                {t("cancelEdit") || "Cancel"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => {
            const childReplies = replyMap.get(reply.id) || [];
            return (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={childReplies}
                replyMap={replyMap}
                depth={depth + 1}
                maxDepth={maxDepth}
                session={session}
                isAdmin={isAdmin}
                ideaId={_ideaId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                refresh={_refresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
