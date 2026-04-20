"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CATEGORIES = ["general", "ideas", "qa", "announcements"] as const;
const MAX_LENGTH = 4000;
const MIN_LENGTH = 10;

interface CommentInputProps {
  ideaId: string;
  parentCommentId?: string;
  session: any;
  onAuthOpen: () => void;
  onSubmit: () => void;
  placeholder?: string;
  compact?: boolean;
  showCategory?: boolean;
}

export default function CommentInput({
  ideaId,
  parentCommentId,
  session,
  onAuthOpen,
  onSubmit,
  placeholder,
  compact = false,
  showCategory = false,
}: CommentInputProps) {
  const t = useTranslations("projects");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [posting, setPosting] = useState(false);
  const draftKey = `draft:comment:${ideaId}${parentCommentId ? `:${parentCommentId}` : ""}`;
  const restoredRef = useRef(false);

  // Restore draft on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) setBody(saved);
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [draftKey]);

  // Autosave on change (debounced via micro-task)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (body) {
        window.localStorage.setItem(draftKey, body);
      } else {
        window.localStorage.removeItem(draftKey);
      }
    } catch {
      // ignore
    }
  }, [body, draftKey]);

  if (!session) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">
          <button
            onClick={onAuthOpen}
            className="font-semibold text-iran-green hover:text-iran-deep-green hover:underline"
          >
            {t("signInToComment")?.split(" ")[0] || "Sign in"}
          </button>{" "}
          to comment
        </p>
      </div>
    );
  }

  const handlePost = async () => {
    if (body.trim().length < MIN_LENGTH) return;
    if (body.length > MAX_LENGTH) return;
    setPosting(true);
    try {
      const finalBody =
        category !== "general" && showCategory && !compact
          ? `[${category}] ${body}`
          : body;

      const endpoint = parentCommentId
        ? "/api/comments"
        : `/api/projects/${ideaId}/comment`;

      const payload = parentCommentId
        ? { discussionId: ideaId, body: finalBody, replyTo: parentCommentId }
        : { body: finalBody };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setBody("");
        setCategory("general");
        // Clear draft
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
        toast.success(parentCommentId ? "Reply posted!" : "Comment posted!");
        onSubmit();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to post");
      }
    } catch {
      toast.error("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const userImage = (session.user as any)?.image;
  const userName = session.user?.name || session.user?.email || "?";

  const counterOver = body.length > MAX_LENGTH;
  const counterClose = !counterOver && body.length > MAX_LENGTH - 200;

  return (
    <div
      className={
        compact
          ? ""
          : "rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow focus-within:shadow-iran-green"
      }
    >
      <div className="flex gap-3">
        <Avatar
          className={
            compact ? "mt-1 h-6 w-6 shrink-0" : "mt-1 h-8 w-8 shrink-0"
          }
        >
          <AvatarImage src={userImage} />
          <AvatarFallback className="text-xs">
            {userName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              placeholder ||
              (parentCommentId
                ? t("commentPlaceholder") || "Write a reply..."
                : t("commentPlaceholder") || "Share your thoughts...")
            }
            rows={compact ? 2 : 3}
            maxLength={MAX_LENGTH + 100}
            className={cn(
              "resize-none border-border transition-colors",
              "focus:border-iran-green/60 focus:ring-2 focus:ring-iran-green/40",
              compact ? "mb-1" : "mb-2"
            )}
          />
          <div className="flex items-center justify-between gap-2 mb-2">
            {body.length > 0 && body.trim().length < MIN_LENGTH ? (
              <p className="text-xs text-iran-red">
                Must be at least {MIN_LENGTH} characters
              </p>
            ) : (
              <span className="text-xs text-muted-foreground">
                {body.length > 0 ? "Markdown supported" : ""}
              </span>
            )}
            <span
              className={cn(
                "text-xs tabular-nums",
                counterOver
                  ? "text-iran-red font-semibold"
                  : counterClose
                    ? "text-iran-saffron"
                    : "text-muted-foreground"
              )}
              aria-live="polite"
            >
              {body.length} / {MAX_LENGTH}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showCategory && !compact && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-iran-green/60 focus:outline-none focus:ring-2 focus:ring-iran-green/40"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(cat) || cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            )}
            <Button
              onClick={handlePost}
              disabled={
                posting ||
                body.trim().length < MIN_LENGTH ||
                body.length > MAX_LENGTH
              }
              size={compact ? "sm" : "default"}
              className="bg-iran-green text-white shadow-iran-green transition-all hover:bg-iran-deep-green hover:shadow-iran-green-lg disabled:opacity-50"
            >
              <Send className="me-2 h-4 w-4" />
              {posting
                ? "Posting..."
                : parentCommentId
                  ? t("postReply") || "Reply"
                  : t("postComment") || "Post Comment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
