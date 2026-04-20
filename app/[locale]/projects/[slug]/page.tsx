"use client";

import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import {
  ArrowLeft,
  ThumbsUp,
  Copy,
  Plus,
  Bot,
  Bell,
  BellOff,
  X,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AuthModal from "@/components/auth/AuthModal";
import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import { resolveEmoji } from "@/lib/emoji-map";
import { toast } from "sonner";
import { useProject } from "@/lib/hooks/useProject";

// ---------- constants ----------
// Admin status comes from the server via /api/auth/me-admin — do NOT hardcode emails here.

const STATUS_STYLES: Record<string, string> = {
  idea: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "needs-contributors": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// ---------- main component ----------

export default function ProjectPage() {
  const t = useTranslations("project");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data: session } = useSession();
  const params = useParams();
  const id = params.slug as string;

  const { data, isLoading: loading, refresh: swrRefresh } = useProject(id);
  const [authOpen, setAuthOpen] = useState(false);
  const [votes, setVotes] = useState(0);
  const [adminChatOpen, setAdminChatOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSimilarId, setRejectSimilarId] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [togglingSub, setTogglingSub] = useState(false);

  // Fetch admin + lead status for this project from the server
  useEffect(() => {
    if (!session?.user?.email) { setIsAdmin(false); setCanManage(false); return; }
    fetch(`/api/auth/me?ideaId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(!!d.isAdmin);
        setCanManage(!!d.canManage);
      })
      .catch(() => { setIsAdmin(false); setCanManage(false); });
  }, [session?.user?.email, id]);

  // Load current subscription status
  useEffect(() => {
    if (!session?.user?.id) { setSubscribed(false); return; }
    fetch(`/api/projects/${id}/subscribe`)
      .then((r) => r.json())
      .then((d) => setSubscribed(!!d.subscribed))
      .catch(() => {});
  }, [session?.user?.id, id]);

  const handleToggleSubscribe = async () => {
    if (!session) { setAuthOpen(true); return; }
    setTogglingSub(true);
    try {
      const res = await fetch(`/api/projects/${id}/subscribe`, {
        method: subscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: subscribed ? undefined : JSON.stringify({ channels: ["in_app", "telegram"] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Could not update subscription");
        return;
      }
      const data = await res.json();
      setSubscribed(!!data.subscribed);
      toast.success(data.subscribed ? "You'll get updates on this project" : "Unsubscribed from project updates");
    } catch {
      toast.error("Network error");
    } finally {
      setTogglingSub(false);
    }
  };

  // Scroll to top when project page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (data?.voteCount !== undefined) setVotes(data.voteCount);
  }, [data]);

  const refresh = useCallback(() => {
    swrRefresh();
  }, [swrRefresh]);

  const handleVote = async () => {
    if (!session) { setAuthOpen(true); return; }
    try {
      const res = await fetch(`/api/ideas/${id}/vote`, { method: "POST" });
      const result = await res.json();
      if (result.voteCount !== undefined) setVotes(result.voteCount);
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t("linkCopied"));
  };

  const handleJoinProject = async () => {
    if (!session) { setAuthOpen(true); return; }
    try {
      const res = await fetch("/api/help-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: id, message: "I want to contribute to this project!", skills: [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not join. Please sign out and sign back in.");
        return;
      }
      if (data.alreadyJoined) {
        toast.success("You're already part of this project.");
      } else {
        toast.success("Joined project!");
      }
      refresh();
      // Fire-and-forget profile completion reminder as a dismissible toast — never block joining.
      fetch("/api/profile").then(async (profileRes) => {
        if (!profileRes.ok) return;
        const profileData = await profileRes.json().catch(() => ({}));
        if (profileData.profile && !profileData.profile.profile_completed) {
          toast.message("Complete your profile to get matched with tasks", {
            description: "Add your skills so leads can find you.",
            action: {
              label: "Complete",
              onClick: () => { window.location.href = "/profile"; },
            },
            duration: 8000,
          });
        }
      }).catch(() => { /* ignore */ });
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    }
  };

  // ---------- render ----------

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-8 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  if (!data?.idea) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-muted-foreground">{t("projectNotFound")}</p>
      </div>
    );
  }

  const idea = data.idea;
  const statusKey =
    data.projectStatus === "rejected"
      ? "statusRejected"
      : data.projectStatus === "needs-contributors"
        ? "statusNeedsContributors"
        : data.projectStatus === "active"
          ? "statusActive"
          : data.projectStatus === "completed"
            ? "statusCompleted"
            : "statusIdea";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* ===== Header ===== */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToProjects")}
        </Link>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {idea.category && (
            <Badge variant="secondary">
              {resolveEmoji(idea.category_emoji)} {idea.category}
            </Badge>
          )}
          <Badge className={STATUS_STYLES[data.projectStatus] || ""}>
            {t(statusKey)}
          </Badge>
        </div>

        <h1 className="mb-2 text-3xl font-bold">{idea.title}</h1>

        {data.projectLeads && data.projectLeads.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Leads: {data.projectLeads.join(", ")}
          </span>
        )}

        {idea.body_preview && (
          <p className="mt-2 text-base text-muted-foreground line-clamp-2">
            {idea.body_preview.split(".")[0]?.slice(0, 150)}
          </p>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <Button onClick={handleVote} variant="outline" className="gap-2 font-semibold">
            <ThumbsUp className="h-4 w-4" />
            {locale === "fa" ? votes.toLocaleString("fa-IR") : votes} {t("votes")}
          </Button>
          <Button onClick={handleJoinProject} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("joinProject")}
          </Button>
          <Button
            onClick={handleToggleSubscribe}
            variant={subscribed ? "default" : "outline"}
            className="gap-2"
            disabled={togglingSub}
            title={subscribed ? "You're subscribed — click to unsubscribe" : "Get notified about project updates"}
          >
            {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {subscribed ? "Following" : "Follow"}
          </Button>
          <Button variant="ghost" size="icon" onClick={copyLink} title={t("share")}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {/* Admin controls */}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data?.projectStatus === "idea" && (
              <Button size="sm" variant="outline" onClick={async () => {
                await fetch("/api/admin/ai-action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "activate", ideaId: id }),
                });
                toast.success("Project activated!");
                refresh();
              }}>
                Activate Project
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={async () => {
              await fetch("/api/admin/ai-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "analyze", ideaId: id }),
              });
              toast.success("AI analysis triggered!");
              refresh();
            }}>
              Run AI Analysis
            </Button>
            {data?.projectStatus !== "rejected" && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30" onClick={() => setRejectDialogOpen(!rejectDialogOpen)}>
                Reject Idea
              </Button>
            )}
          </div>
        )}

        {/* Reject dialog */}
        {isAdmin && rejectDialogOpen && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <h4 className="mb-2 text-sm font-semibold text-red-800 dark:text-red-200">Reject this idea</h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..."
              className="mb-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm dark:border-red-700 dark:bg-gray-900"
              rows={3}
            />
            <input
              value={rejectSimilarId}
              onChange={(e) => setRejectSimilarId(e.target.value)}
              placeholder="Similar idea/project ID (optional)"
              className="mb-3 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm dark:border-red-700 dark:bg-gray-900"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || rejecting}
                onClick={async () => {
                  setRejecting(true);
                  try {
                    const res = await fetch("/api/admin/ai-action", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "reject-idea",
                        ideaId: id,
                        data: { reason: rejectReason.trim(), similarIdeaId: rejectSimilarId.trim() || null },
                      }),
                    });
                    const result = await res.json();
                    if (result.success) {
                      toast.success("Idea rejected");
                      setRejectDialogOpen(false);
                      setRejectReason("");
                      setRejectSimilarId("");
                      refresh();
                    } else {
                      toast.error(result.error || "Failed to reject");
                    }
                  } catch {
                    toast.error("Failed to reject idea");
                  } finally {
                    setRejecting(false);
                  }
                }}
              >
                {rejecting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setRejectDialogOpen(false); setRejectReason(""); setRejectSimilarId(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Workspace (tabs + all content) ===== */}
      <ProjectWorkspace
        idea={data.idea}
        comments={data.comments || []}
        tasks={data.tasks || []}
        analysis={data.analysis}
        helpOffers={data.helpOffers || []}
        voteCount={votes}
        contributors={data.contributors || { commenters: [], taskClaimers: [], submitters: [], helpOffers: [] }}
        projectStatus={data.projectStatus}
        projectContent={data.projectContent || ""}
        projectDocMeta={data.projectDocMeta || {}}
        projectDocs={data.projectDocs || []}
        projectResources={data.projectResources || []}
        projectLeads={data.projectLeads || []}
        aiOpenQuestions={data.aiOpenQuestions || []}
        activityLog={data.activityLog || []}
        voteReasons={data.voteReasons || []}
        teaserImageUrl={data.teaserImageUrl}
        googleDocUrl={data.googleDocUrl}
        session={session}
        isAdmin={isAdmin}
        canManage={canManage}
        ideaId={id}
        locale={locale}
        t={t}
        tCommon={tCommon}
        refresh={refresh}
        onAuthOpen={() => setAuthOpen(true)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} action={t("joinProject")} />

      {/* Admin AI Chat */}
      {isAdmin && (
        <>
          <button
            onClick={() => setAdminChatOpen(!adminChatOpen)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all"
            title="Admin AI Assistant"
          >
            <Bot className="h-6 w-6" />
          </button>

          {adminChatOpen && (
            <AdminAIChat ideaId={id} idea={data.idea} onClose={() => setAdminChatOpen(false)} refresh={refresh} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// AdminAIChat (kept in page.tsx as it's page-level UI)
// ============================================================================

function AdminAIChat({ ideaId, idea, onClose, refresh }: { ideaId: string; idea: { title: string; body?: string }; onClose: () => void; refresh: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: `I'm your AI assistant for "${idea.title}". I can analyze this project, generate tasks, update the document, or answer questions. What would you like to do?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, ideaTitle: idea.title, ideaBody: idea.body?.slice(0, 4000) || "", message: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Something went wrong." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Done." }]);
        // If the action changed project state, refresh after a short delay
        if (data.action && data.action !== "answer_question") {
          setTimeout(refresh, 1500);
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const quickAction = async (action: string) => {
    if (action === "analyze") {
      setMessages((prev) => [...prev, { role: "assistant", content: "Triggering AI analysis..." }]);
      try {
        await fetch("/api/admin/ai-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", ideaId }) });
        setMessages((prev) => [...prev, { role: "assistant", content: "AI analysis has been triggered. The results will appear shortly." }]);
        setTimeout(refresh, 3000);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Failed to trigger analysis." }]);
      }
    } else if (action === "activate") {
      try {
        await fetch("/api/admin/ai-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate", ideaId }) });
        setMessages((prev) => [...prev, { role: "assistant", content: "Project has been activated! AI analysis will run next." }]);
        setTimeout(refresh, 3000);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Failed to activate project." }]);
      }
    } else if (action === "generate-doc") {
      setMessages((prev) => [...prev, { role: "assistant", content: "Generating project document..." }]);
      try {
        await fetch(`/api/projects/${ideaId}/generate-doc`, { method: "POST" });
        setMessages((prev) => [...prev, { role: "assistant", content: "Project document has been generated/updated." }]);
        setTimeout(refresh, 3000);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Failed to generate document." }]);
      }
    } else {
      setInput(action);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold">Admin AI Assistant</p>
            <p className="text-[10px] text-green-600">Online</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close AI assistant"
          title="Close"
          className="rounded p-1 text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-foreground dark:bg-gray-800"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-muted-foreground dark:bg-gray-800">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-border">
        {[
          { label: "Analyze Project", action: "analyze" },
          { label: "Generate Tasks", action: "What tasks should we create for this project?" },
          { label: "Update Document", action: "generate-doc" },
          { label: "Summarize Progress", action: "Summarize the current progress of this project" },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => quickAction(q.action)}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask AI anything about this project..."
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          title="Send"
          className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
