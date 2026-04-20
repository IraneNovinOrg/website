"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Upload,
  FileText,
  Trash2,
  Edit3,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";
import {
  type Any,
  type DocItem,
  type ResourceItem,
  FILE_RESOURCE_TYPES,
  timeAgo,
  genLocalId,
} from "../types";

interface FilesTabProps {
  projectDocs: DocItem[];
  projectResources: ResourceItem[];
  session: Any;
  ideaId: string;
  t: (key: string) => string;
  refresh: () => void;
  onAuthOpen: () => void;
}

export default function FilesTab({
  projectDocs, projectResources, session, ideaId, t, refresh, onAuthOpen,
}: FilesTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resTitle, setResTitle] = useState("");
  const [resType, setResType] = useState<string>("link");
  const [resUrl, setResUrl] = useState("");
  const [resBody, setResBody] = useState("");
  const [resDescription, setResDescription] = useState("");
  const [resFileData, setResFileData] = useState<string | null>(null);
  const [resFileName, setResFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const docs = projectDocs || [];
  const resources = projectResources || [];

  interface UnifiedItem {
    id: string; title: string; type: "link" | "document" | "file"; url?: string; body?: string;
    description?: string; fileData?: string; fileName?: string; authorName: string; createdAt: string; sourceType: "doc" | "resource";
  }

  const unifiedItems: UnifiedItem[] = [
    ...docs.map((d): UnifiedItem => ({ id: d.id, title: d.title, type: "document", body: d.body, authorName: d.authorName, createdAt: d.createdAt, sourceType: "doc" })),
    ...resources.map((r): UnifiedItem => ({
      id: r.id, title: r.title, type: r.type === "document" ? "document" : r.type === "file" ? "file" : "link",
      url: r.url, description: r.description, fileData: (r as Any).fileData, fileName: (r as Any).fileName,
      authorName: r.authorName, createdAt: r.createdAt, sourceType: "resource",
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("File too large. Maximum size is 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setResFileData(reader.result as string); setResFileName(file.name); };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setResTitle(""); setResType("link"); setResUrl(""); setResBody(""); setResDescription(""); setResFileData(null); setResFileName(""); setEditingId(null); setShowCreate(false);
  };

  const handleSave = async () => {
    if (!resTitle.trim()) return;
    if (resType === "link" && !resUrl.trim()) return;
    if (resType === "document" && !resBody.trim()) return;
    if (resType === "file" && !resFileData && !editingId) return;
    if (!session) { onAuthOpen(); return; }
    setSaving(true);
    try {
      const authorName = session.user?.name || session.user?.email || "Anonymous";
      if (resType === "document") {
        let updatedDocs: DocItem[];
        if (editingId) {
          updatedDocs = docs.map((d) => d.id === editingId ? { ...d, title: resTitle, body: resBody, updatedAt: new Date().toISOString() } : d);
        } else {
          updatedDocs = [...docs, { id: genLocalId(), title: resTitle, body: resBody, authorName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
        }
        const res = await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectDocs: updatedDocs }) });
        if (res.ok) { resetForm(); refresh(); }
      } else {
        const newResource: Any = { id: editingId || genLocalId(), title: resTitle, url: resType === "file" ? (resFileData || "") : resUrl, type: resType, description: resDescription, authorName, createdAt: new Date().toISOString() };
        if (resType === "file") { newResource.fileData = resFileData; newResource.fileName = resFileName; }
        let updatedResources: ResourceItem[];
        if (editingId) { updatedResources = resources.map((r) => r.id === editingId ? newResource : r); }
        else { updatedResources = [...resources, newResource]; }
        const res = await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectResources: updatedResources }) });
        if (res.ok) { resetForm(); refresh(); }
      }
    } catch (e) { console.error(e); toast.error("Something went wrong. Please try again."); } finally { setSaving(false); }
  };

  const handleDelete = async (item: UnifiedItem) => {
    if (!session) { onAuthOpen(); return; }
    try {
      if (item.sourceType === "doc") {
        await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectDocs: docs.filter((d) => d.id !== item.id) }) });
      } else {
        await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectResources: resources.filter((r) => r.id !== item.id) }) });
      }
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const startEdit = (item: UnifiedItem) => {
    setEditingId(item.id); setResTitle(item.title); setResDescription(item.description || "");
    if (item.type === "document") { setResType("document"); setResBody(item.body || ""); }
    else if (item.type === "file") { setResType("file"); setResFileData(item.fileData || null); setResFileName(item.fileName || ""); }
    else { setResType("link"); setResUrl(item.url || ""); }
    setShowCreate(true); setSelectedDoc(null);
  };

  const resourceIcon = (type: string) => {
    switch (type) {
      case "document": return <FileText className="h-5 w-5" />;
      case "file": return <Upload className="h-5 w-5" />;
      default: return <Globe className="h-5 w-5" />;
    }
  };

  if (selectedDoc) {
    const item = unifiedItems.find((d) => d.id === selectedDoc);
    if (!item || item.type !== "document") { setSelectedDoc(null); return null; }
    return (
      <div>
        <button onClick={() => setSelectedDoc(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> {t("backToList")}
        </button>
        <div className="rounded-lg border border-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">{item.title}</h2>
            {session && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(item)}><Edit3 className="mr-1 h-3 w-3" />{t("editDocument") || "Edit"}</Button>
                <Button variant="outline" size="sm" onClick={() => { handleDelete(item); setSelectedDoc(null); }}><Trash2 className="mr-1 h-3 w-3" />{t("deleteDocument") || "Delete"}</Button>
              </div>
            )}
          </div>
          <p className="mb-4 text-xs text-muted-foreground">By {item.authorName} - {timeAgo(item.createdAt)}</p>
          <MarkdownRenderer content={item.body || ""} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {!showCreate && (
        <Button variant="outline" size="sm" className="mb-4" onClick={() => { if (!session) { onAuthOpen(); return; } resetForm(); setShowCreate(true); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("addResource") || "Add Resource"}
        </Button>
      )}

      {showCreate && (
        <div className="mb-6 space-y-3 rounded-lg border border-border p-4">
          <h3 className="font-medium">{editingId ? (t("editDocument") || "Edit Resource") : (t("addResource") || "Add Resource")}</h3>
          <Input value={resTitle} onChange={(e) => setResTitle(e.target.value)} placeholder={t("resourceTitle") || "Title (required)"} required />
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {FILE_RESOURCE_TYPES.map((ft) => (
                <button key={ft} type="button" onClick={() => setResType(ft)} className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${resType === ft ? "border-primary bg-primary text-white" : "border-input bg-background text-muted-foreground hover:bg-muted"}`}>
                  {ft === "link" ? "Link" : ft === "document" ? "Document" : "File Upload"}
                </button>
              ))}
            </div>
          </div>
          {resType === "link" && <Input value={resUrl} onChange={(e) => setResUrl(e.target.value)} placeholder="https://..." type="url" required />}
          {resType === "document" && <Textarea value={resBody} onChange={(e) => setResBody(e.target.value)} placeholder={t("documentBody") || "Write your document in Markdown..."} rows={8} className="font-mono text-sm" required />}
          {resType === "file" && (
            <div className="space-y-2">
              <input type="file" accept="image/*,.pdf,.txt,.md,.csv" onChange={handleFileChange} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-white" />
              {resFileName && <p className="text-xs text-muted-foreground">Selected: {resFileName}</p>}
              <p className="text-xs text-muted-foreground">Max 2MB. Accepts images, PDFs, and text files.</p>
            </div>
          )}
          <Input value={resDescription} onChange={(e) => setResDescription(e.target.value)} placeholder={t("resourceDescription") || "Description (optional)"} />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || !resTitle.trim() || (resType === "link" && !resUrl.trim()) || (resType === "document" && !resBody.trim()) || (resType === "file" && !resFileData && !editingId)} className="bg-primary text-white hover:bg-primary/90">
              {saving ? "..." : (t("saveDocument") || "Save")}
            </Button>
            <Button variant="outline" onClick={resetForm}>{t("cancelEdit") || "Cancel"}</Button>
          </div>
        </div>
      )}

      {unifiedItems.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>{t("noResources") || "No files or resources yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {unifiedItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-lg border border-border p-4 transition-colors ${item.type === "document" ? "cursor-pointer hover:bg-muted/50" : ""}`}
              onClick={() => { if (item.type === "document") setSelectedDoc(item.id); }}
            >
              <div className="shrink-0 text-muted-foreground">{resourceIcon(item.type)}</div>
              <div className="min-w-0 flex-1">
                {item.type === "link" && item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {item.title} <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                ) : item.type === "file" && item.fileData ? (
                  <a href={item.fileData} download={item.fileName || "file"} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {item.title} {item.fileName && <span className="text-xs text-muted-foreground">({item.fileName})</span>}
                  </a>
                ) : (
                  <p className="font-medium">{item.title}</p>
                )}
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                <p className="text-xs text-muted-foreground">{item.authorName} - {timeAgo(item.createdAt)}</p>
              </div>
              <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
              {session && (
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(item); }} className="rounded p-1 text-muted-foreground hover:text-foreground"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="rounded p-1 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
