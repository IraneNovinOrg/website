"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, FileText, X } from "lucide-react";
import type { SubmissionAttachment } from "../types";

interface TaskSubmitFormProps {
  taskId: string;
  ideaId?: string;
  onSubmitted: () => void;
}

type SubmitType = "text" | "link" | "file";

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskSubmitForm({
  taskId,
  ideaId,
  onSubmitted,
}: TaskSubmitFormProps) {
  const [type, setType] = useState<SubmitType>("text");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleFileUpload(file: File): Promise<SubmissionAttachment> {
    const fd = new FormData();
    fd.append("file", file);
    if (ideaId) fd.append("ideaId", ideaId);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
    const data = await res.json();
    return {
      url: data.url || data.path || "",
      filename: data.filename || file.name,
      size: typeof data.size === "number" ? data.size : file.size,
      mimeType: data.mimeType || file.type || "",
    };
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!content.trim() && attachments.length === 0) {
      toast.error("Please add content or an attachment");
      return;
    }
    // Map UI type to API submission type ("link" | "document" | "inline")
    const apiType: "link" | "document" | "inline" =
      type === "link" ? "link" : type === "file" ? "document" : "inline";

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: apiType, content, attachments }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Submit failed: ${res.status}`);
      }
      toast.success("Work submitted! AI review will appear shortly.");
      setContent("");
      setAttachments([]);
      onSubmitted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-iran-green/20 bg-card p-4">
      <h4 className="font-display text-sm font-bold text-iran-deep-green">
        Submit your work
      </h4>
      <div className="flex gap-2">
        {(["text", "link", "file"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
              type === t
                ? "border-iran-green bg-iran-green text-white"
                : "border-iran-green/20 text-muted-foreground hover:bg-iran-green/5"
            }`}
          >
            {t === "text" ? "Text" : t === "link" ? "Link / URL" : "File Upload"}
          </button>
        ))}
      </div>

      {type !== "file" && (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === "link"
              ? "Paste a URL (GitHub PR, Figma, Google Doc...)"
              : "Describe your completed work, or paste its contents..."
          }
          rows={4}
          className="focus:border-iran-green/60 focus:ring-iran-green/40"
        />
      )}

      {type === "file" && (
        <div className="space-y-2">
          <Input
            type="file"
            disabled={uploading}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              // Reset input so re-selecting the same file re-fires onChange
              e.target.value = "";
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) {
                toast.error(`${f.name} exceeds 10MB limit`);
                return;
              }
              setUploading(true);
              try {
                const att = await handleFileUpload(f);
                setAttachments((a) => [...a, att]);
                toast.success("File uploaded");
              } catch (err) {
                toast.error((err as Error).message || "Upload failed");
              } finally {
                setUploading(false);
              }
            }}
          />
          {uploading && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
            </p>
          )}
          {attachments.length > 0 && (
            <ul className="space-y-1">
              {attachments.map((a, idx) => (
                <li
                  key={`${a.url}-${idx}`}
                  className="flex items-center gap-2 rounded-md border border-iran-green/20 bg-iran-green/5 px-2 py-1 text-xs"
                >
                  <FileText className="h-3 w-3 shrink-0 text-iran-deep-green" />
                  <span className="truncate font-medium">{a.filename}</span>
                  <span className="text-muted-foreground">
                    {formatFileSize(a.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="ms-auto text-muted-foreground hover:text-red-500"
                    aria-label={`Remove ${a.filename}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Optional description of what you submitted"
            rows={3}
            className="mt-2 focus:border-iran-green/60 focus:ring-iran-green/40"
          />
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={
          submitting ||
          uploading ||
          (!content.trim() && attachments.length === 0)
        }
        className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green"
      >
        {submitting ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="me-2 h-4 w-4" />
        )}
        Submit Work
      </Button>
    </div>
  );
}
