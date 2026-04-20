"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Edit3,
  LinkIcon,
  BookOpen,
  RefreshCw,
  Check,
  X,
  Sparkles,
  AlertTriangle,
  ImageIcon,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";

interface DocumentTabProps {
  docContent: string;
  googleDocUrl: string | null;
  docMeta: { lastEditedBy?: string; lastEditedAt?: string; version?: number };
  ideaId: string;
  isAdmin: boolean;
  /** True if admin OR project lead — can approve/reject suggestions */
  canManage?: boolean;
  /** True if the user is signed in — can submit suggestions */
  signedIn?: boolean;
  refresh: () => void;
  t: (key: string) => string;
}

interface SuggestionRow {
  id: string;
  idea_id: string;
  user_id: string;
  user_name: string;
  original_content: string;
  suggested_content: string;
  status: "pending" | "approved" | "rejected";
  ai_verdict: "approve" | "reject" | "defer" | null;
  ai_reason: string | null;
  ai_reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Returns a simple visual diff — added lines in green, removed lines struck-through in red. */
function renderDiff(original: string, suggested: string) {
  const origLines = (original || "").split("\n");
  const newLines = (suggested || "").split("\n");
  const origSet = new Set(origLines);
  const newSet = new Set(newLines);

  const removed = origLines.filter((l) => !newSet.has(l));
  const added = newLines.filter((l) => !origSet.has(l));

  return (
    <div className="space-y-2 font-mono text-xs">
      {removed.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-red-600 dark:text-red-400">Removed</p>
          {removed.slice(0, 30).map((line, i) => (
            <div key={`r-${i}`} className="rounded bg-red-50 px-2 py-0.5 text-red-900 line-through dark:bg-red-950/30 dark:text-red-200">
              − {line || "\u00A0"}
            </div>
          ))}
          {removed.length > 30 && <p className="text-[10px] text-muted-foreground">…and {removed.length - 30} more removed lines</p>}
        </div>
      )}
      {added.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Added</p>
          {added.slice(0, 30).map((line, i) => (
            <div key={`a-${i}`} className="rounded bg-green-50 px-2 py-0.5 text-green-900 dark:bg-green-950/30 dark:text-green-200">
              + {line || "\u00A0"}
            </div>
          ))}
          {added.length > 30 && <p className="text-[10px] text-muted-foreground">…and {added.length - 30} more added lines</p>}
        </div>
      )}
      {removed.length === 0 && added.length === 0 && (
        <p className="text-muted-foreground">No line-level changes detected (formatting only).</p>
      )}
    </div>
  );
}

function SuggestionCard({ s, canReview, onReviewed }: {
  s: SuggestionRow;
  canReview: boolean;
  onReviewed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const verdictBadge = s.ai_verdict === "approve"
    ? <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300"><Sparkles className="me-1 h-3 w-3" />AI: approve</Badge>
    : s.ai_verdict === "reject"
      ? <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-300"><AlertTriangle className="me-1 h-3 w-3" />AI: reject</Badge>
      : s.ai_verdict === "defer"
        ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300"><Sparkles className="me-1 h-3 w-3" />AI: defer</Badge>
        : <Badge variant="outline">AI: reviewing…</Badge>;

  const statusBadge = s.status === "approved"
    ? <Badge className="bg-green-600 text-white">Approved</Badge>
    : s.status === "rejected"
      ? <Badge className="bg-red-600 text-white">Rejected</Badge>
      : <Badge className="bg-amber-500 text-white">Pending</Badge>;

  const review = async (action: "approved" | "rejected") => {
    setBusy(true);
    try {
      const res = await fetch("/api/document-suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: s.id, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed");
      } else {
        toast.success(action === "approved" ? "Suggestion applied to document" : "Suggestion rejected");
        onReviewed();
      }
    } catch {
      toast.error("Network error");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{s.user_name}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(s.created_at).toLocaleString()}
        </span>
        {statusBadge}
        {verdictBadge}
      </div>
      {s.ai_reason && (
        <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{s.ai_reason}&rdquo;</p>
      )}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 text-xs font-medium text-iran-green hover:underline"
      >
        {expanded ? "Hide changes" : "View changes"}
      </button>
      {expanded && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-2">
          {renderDiff(s.original_content || "", s.suggested_content || "")}
        </div>
      )}
      {canReview && s.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => review("approved")} disabled={busy} className="bg-green-600 text-white hover:bg-green-700">
            <Check className="me-1 h-3 w-3" /> Approve &amp; apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => review("rejected")} disabled={busy}>
            <X className="me-1 h-3 w-3" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DocumentTab({
  docContent, googleDocUrl, docMeta, ideaId, isAdmin, canManage, signedIn, refresh, t,
}: DocumentTabProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(docContent);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [docUrl, setDocUrl] = useState(googleDocUrl || "");
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MDEditor = useMemo(() => {
    return dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
  }, []);

  const uploadImageFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return null; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image is too big (max 5MB)"); return null; }
    setUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the "data:image/xxx;base64," prefix
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content: base64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Upload failed");
        return null;
      }
      const data = await res.json();
      return data.url as string;
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
      return null;
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const insertImageAtCursor = useCallback((url: string, alt = "image") => {
    setEditContent((prev) => `${prev}\n\n![${alt}](${url})\n`);
  }, []);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageFile(file);
    if (url) {
      insertImageAtCursor(url, file.name);
      toast.success("Image uploaded and inserted");
    }
    // reset so picking the same file twice triggers onChange
    e.target.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((i) => i.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const url = await uploadImageFile(file);
    if (url) { insertImageAtCursor(url, "pasted-image"); toast.success("Pasted image uploaded"); }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    e.preventDefault();
    const url = await uploadImageFile(file);
    if (url) { insertImageAtCursor(url, file.name); toast.success("Image dropped and uploaded"); }
  };

  const effectiveCanManage = isAdmin || !!canManage;

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/document-suggestions?ideaId=${encodeURIComponent(ideaId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch { /* ignore */ }
  }, [ideaId]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const pending = suggestions.filter((s) => s.status === "pending");

  const handleSave = async () => {
    setSaving(true);
    try {
      if (effectiveCanManage) {
        // Admin/lead: direct save
        const res = await fetch(`/api/projects/${ideaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectContent: editContent }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed");
        }
        setEditing(false); refresh(); toast.success("Document saved!");
      } else {
        // Regular user: submit as suggestion
        const res = await fetch("/api/document-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ideaId, originalContent: docContent, suggestedContent: editContent }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed");
        }
        setEditing(false);
        toast.success("Suggestion submitted! AI will auto-review and apply or flag for admins.");
        loadSuggestions();
      }
    } catch (e) { toast.error((e as Error).message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/projects/${ideaId}/generate-doc`, { method: "POST" });
      if (res.ok) { refresh(); toast.success("Document regenerated!"); }
      else toast.error("Failed to regenerate");
    } catch { toast.error("Failed to regenerate"); } finally { setRegenerating(false); }
  };

  const handleSetDocUrl = async () => {
    try {
      await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleDocUrl: docUrl || null }) });
      setShowUrlInput(false); refresh();
      toast.success(docUrl ? "Document URL set!" : "Document URL removed");
    } catch { toast.error("Failed to update"); }
  };

  if (googleDocUrl) {
    return (
      <div className="mx-auto max-w-5xl">
        {isAdmin && (
          <div className="mb-4 flex items-center justify-between">
            <Badge variant="outline">Google Docs</Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowUrlInput(true)}>Change URL</Button>
              <Button variant="outline" size="sm" onClick={async () => {
                await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleDocUrl: null }) });
                refresh();
              }}>Switch to built-in editor</Button>
            </div>
          </div>
        )}
        {showUrlInput && (
          <div className="mb-4 flex gap-2">
            <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="Google Docs URL" className="flex-1" />
            <Button onClick={handleSetDocUrl}>Save</Button>
            <Button variant="outline" onClick={() => setShowUrlInput(false)}>Cancel</Button>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-border">
          <iframe src={googleDocUrl.replace(/\/edit.*$/, "/edit?embedded=true")} className="h-[80vh] w-full border-0" title="Project Document" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Pending suggestions panel */}
      {pending.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold">
              {pending.length} pending edit suggestion{pending.length > 1 ? "s" : ""}
            </h3>
            {!effectiveCanManage && (
              <span className="ms-auto text-xs text-muted-foreground">Awaiting admin or lead review</span>
            )}
          </div>
          <div className="space-y-2">
            {pending.map((s) => (
              <SuggestionCard key={s.id} s={s} canReview={effectiveCanManage} onReviewed={() => { loadSuggestions(); refresh(); }} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {!editing && signedIn && (
            <Button variant="outline" size="sm" onClick={() => { setEditContent(docContent); setEditing(true); }}>
              <Edit3 className="me-1 h-4 w-4" /> {effectiveCanManage ? "Edit" : "Suggest edit"}
            </Button>
          )}
          {effectiveCanManage && (
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
              <RefreshCw className={`me-1 h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Regenerating..." : "Regenerate with AI"}
            </Button>
          )}
          {docContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/projects/${ideaId}/document`;
                navigator.clipboard.writeText(url);
                toast.success("Shareable link copied");
              }}
            >
              <Share2 className="me-1 h-4 w-4" /> Copy share link
            </Button>
          )}
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowUrlInput(true)}>
            <LinkIcon className="me-1 h-4 w-4" /> Use Google Docs
          </Button>
        )}
      </div>

      {showUrlInput && (
        <div className="mb-4 rounded-lg border border-border p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Paste a Google Docs URL to embed it as the project document. The doc should be set to &quot;Anyone with the link can view&quot;.
          </p>
          <div className="flex gap-2">
            <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://docs.google.com/document/d/..." className="flex-1" />
            <Button onClick={handleSetDocUrl}>Save</Button>
            <Button variant="outline" onClick={() => setShowUrlInput(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {docMeta.lastEditedBy && (
        <p className="mb-3 text-xs text-muted-foreground">
          Last edited by {docMeta.lastEditedBy} · {docMeta.lastEditedAt ? new Date(docMeta.lastEditedAt).toLocaleDateString() : ""} · v{docMeta.version || 1}
        </p>
      )}

      {editing ? (
        <div>
          {!effectiveCanManage && (
            <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Your edit will be submitted as a suggestion. AI will auto-approve clear improvements or flag for admins/leads to review.
            </p>
          )}

          {/* Image upload toolbar */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImagePick}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              <ImageIcon className="me-1 h-4 w-4" />
              {uploadingImage ? "Uploading..." : "Upload image"}
            </Button>
            <span className="text-xs text-muted-foreground">
              You can also paste or drag-and-drop images into the editor.
            </span>
          </div>

          <div
            data-color-mode="light"
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <MDEditor
              value={editContent}
              onChange={(val: string | undefined) => setEditContent(val || "")}
              height={500}
              preview="live"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleSave} disabled={saving || editContent === docContent}>
              {saving ? "Saving..." : (effectiveCanManage ? "Save Document" : "Submit suggestion")}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : docContent ? (
        <div className="rounded-lg border border-border p-6">
          <MarkdownRenderer content={docContent} />
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>{t("noDocumentYet")}</p>
          {effectiveCanManage && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? "Generating..." : "Generate with AI"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
