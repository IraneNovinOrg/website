"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, X, Send, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

const FEEDBACK_TYPES = ["bug", "feature", "general"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

const ALLOWED_EXTENSIONS = ".png,.jpg,.jpeg,.gif,.webp,.pdf";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;

interface AttachedFile {
  file: File;
  preview: string | null; // data URL for images, null for non-images
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FeedbackButton() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (!selectedFiles.length) return;

      const remaining = MAX_FILES - attachments.length;
      if (remaining <= 0) {
        toast.error(t("maxFiles"));
        return;
      }

      const filesToAdd = selectedFiles.slice(0, remaining);
      const errors: string[] = [];

      for (const file of filesToAdd) {
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: ${t("fileTooLarge")}`);
          continue;
        }
      }

      if (errors.length) {
        toast.error(errors.join("\n"));
      }

      const validFiles = filesToAdd.filter((f) => f.size <= MAX_FILE_SIZE);

      // Generate previews for images
      for (const file of validFiles) {
        if (isImageFile(file)) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setAttachments((prev) => {
              const idx = prev.findIndex((a) => a.file === file);
              if (idx === -1) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], preview: ev.target?.result as string };
              return next;
            });
          };
          reader.readAsDataURL(file);
        }
        setAttachments((prev) => [...prev, { file, preview: null }]);
      }

      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [attachments.length, t]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (message.trim().length < 10) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("message", message.trim());
      formData.append("url", window.location.href);
      for (const att of attachments) {
        formData.append("files", att.file);
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast.success(t("success"));
        setMessage("");
        setType("general");
        setAttachments([]);
        setOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button -- logical bottom-start (bottom-left LTR, bottom-right RTL) */}
      <button
        onClick={() => setOpen(!open)}
        data-feedback-button
        className={`focus-ring group fixed bottom-5 start-5 z-50 inline-flex h-14 items-center justify-center gap-2 rounded-full gradient-iran-gold text-white shadow-iran-gold-lg transition-all hover:shadow-iran-gold-lg focus:outline-none ${
          open
            ? "w-14 px-0"
            : "w-14 px-0 md:w-auto md:px-5 hover:animate-bounce-subtle animate-glow-pulse"
        }`}
        aria-label={t("title")}
        title={t("title")}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageSquare className="h-5 w-5 shrink-0" />
            <span className="hidden text-sm font-semibold md:inline">
              {t("title")}
            </span>
          </>
        )}
      </button>

      {/* Slide-up form */}
      {open && (
        <div className="fixed bottom-20 start-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] animate-fade-up rounded-xl border border-iran-green/20 bg-white p-4 shadow-iran-green-lg dark:bg-gray-900">
          {/* Gold accent bar */}
          <div
            aria-hidden="true"
            className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-iran-gold/80 to-transparent"
          />
          <h3 className="mb-3 font-display text-sm font-semibold text-gradient-gold">
            {t("title")}
          </h3>

          {/* Type selector */}
          <div className="mb-3 flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map((ft) => {
              const isActive = type === ft;
              const brand =
                ft === "bug"
                  ? isActive
                    ? "bg-iran-red text-white shadow-iran-red"
                    : "border-iran-red/40 text-iran-red hover:bg-iran-red/10"
                  : ft === "feature"
                    ? isActive
                      ? "bg-iran-green text-white shadow-iran-green"
                      : "border-iran-green/40 text-iran-green hover:bg-iran-green/10"
                    : isActive
                      ? "bg-iran-gold text-white shadow-iran-gold"
                      : "border-iran-gold/40 text-iran-gold hover:bg-iran-gold/10";
              return (
                <button
                  key={ft}
                  onClick={() => setType(ft)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isActive ? "border-transparent" : "bg-transparent"
                  } ${brand}`}
                >
                  {t(`type_${ft}`)}
                </button>
              );
            })}
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("placeholder")}
            rows={3}
            className="focus-ring mb-2 w-full rounded-lg border border-iran-green/30 bg-transparent px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-iran-green focus:outline-none focus:ring-2 focus:ring-iran-green/30"
          />
          <p className="mb-2 text-xs text-muted-foreground">{t("minChars")}</p>

          {/* File attachments */}
          <div className="mb-3">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="group/att relative flex items-center gap-1.5 rounded-lg border border-iran-green/20 bg-gray-50 p-1.5 dark:bg-gray-800"
                  >
                    {att.preview ? (
                      <img
                        src={att.preview}
                        alt={att.file.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-iran-gold/10 text-xs font-bold uppercase text-iran-gold">
                        {att.file.name.split(".").pop()}
                      </div>
                    )}
                    <div className="max-w-[80px] overflow-hidden">
                      <p className="truncate text-[10px] font-medium text-foreground">
                        {att.file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(att.file.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-iran-red text-white opacity-0 transition-opacity group-hover/att:opacity-100"
                      aria-label={t("removeFile")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add file button */}
            {attachments.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-iran-green/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-iran-green hover:text-iran-green"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {t("attachFile")}
                <span className="text-[10px] opacity-60">
                  ({attachments.length}/{MAX_FILES})
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS}
              multiple
              onChange={handleFileSelect}
              className="hidden"
              aria-label={t("attachFile")}
            />

            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("fileHint")}
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || message.trim().length < 10}
            className="flex w-full items-center justify-center gap-2 rounded-lg gradient-iran px-4 py-2 text-sm font-medium text-white shadow-iran-green transition-all hover:shadow-iran-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {submitting ? t("submitting") : t("submit")}
          </button>
        </div>
      )}
    </>
  );
}
