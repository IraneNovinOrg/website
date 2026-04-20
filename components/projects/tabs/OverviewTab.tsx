"use client";

import { useState } from "react";
import {
  Circle,
  Clock,
  CheckCircle2,
  User,
  Zap,
  Bot,
  AlertCircle,
  ChevronRight,
  ImageIcon,
  Github,
  ExternalLink,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { Link } from "@/i18n/routing";
import { resolveEmoji } from "@/lib/emoji-map";
import { toast } from "sonner";
import {
  type Any,
  type ProjectTask,
  type ProjectComment,
  type ProjectWorkspaceProps,
  type DocItem,
  type ResourceItem,
  type ActivityEntry,
  timeAgo,
  mapTaskStatus,
} from "../types";

interface OverviewTabProps {
  idea: Any;
  analysis: Any | null;
  tasks: ProjectTask[];
  comments: ProjectComment[];
  contributors: ProjectWorkspaceProps["contributors"];
  projectDocs: DocItem[];
  projectResources: ResourceItem[];
  activityLog: ActivityEntry[];
  teaserImageUrl: string | null;
  voteReasons: Any[];
  locale: string;
  t: (key: string) => string;
  isAdmin: boolean;
  ideaId: string;
  refresh: () => void;
  onTabChange: (tab: string) => void;
}

export default function OverviewTab({
  idea,
  analysis,
  tasks,
  comments,
  contributors,
  projectDocs,
  projectResources,
  activityLog,
  teaserImageUrl,
  voteReasons,
  locale,
  t,
  isAdmin,
  ideaId,
  refresh,
  onTabChange,
}: OverviewTabProps) {
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((tk) => mapTaskStatus(tk.status) === "done").length;
  const openTasks = tasks.filter((tk) => mapTaskStatus(tk.status) === "open").length;
  const inProgressTasks = tasks.filter((tk) => mapTaskStatus(tk.status) === "in-progress").length;
  const inReviewTasks = tasks.filter((tk) => mapTaskStatus(tk.status) === "in-review").length;
  const progressPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const allContributorNames = [
    ...contributors.commenters.map((c) => c.login || c.name),
    ...contributors.taskClaimers.map((c) => c.name),
    ...contributors.submitters.map((c) => c.name),
    ...contributors.helpOffers.map((c) => c.name),
  ].filter(Boolean);
  const uniqueMembers = new Set(allContributorNames);

  const totalHoursEstimated = tasks.reduce((sum, t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (t as any).timeEstimate || (t as any).time_estimate || "";
    const hours = parseInt(raw.replace(/[^0-9]/g, "")) || 0;
    return sum + hours;
  }, 0);

  const stats = [
    { label: t("membersCount"), value: uniqueMembers.size },
    { label: t("tasksCount"), value: totalTasks },
    { label: t("discussionsCount"), value: comments.length },
    { label: t("filesCount") || "Files", value: (projectDocs?.length || 0) + (projectResources?.length || 0) },
    { label: "Est. Hours", value: `${totalHoursEstimated}h` },
  ];

  const topOpenTasks = tasks.filter((tk) => mapTaskStatus(tk.status) === "open").slice(0, 3);
  const recentActivity = (activityLog || []).slice(0, 5);

  const sourceBadge = idea.source === "iranazadabad" ? "IranAzadAbad" : idea.source === "iranenovin" ? "IranENovin" : idea.source || "";

  const handleSaveTeaserImage = async () => {
    if (!imageUrlInput.trim()) return;
    setSavingImage(true);
    try {
      await fetch(`/api/projects/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teaserImageUrl: imageUrlInput.trim() }),
      });
      toast.success("Image updated!");
      setShowImageInput(false);
      setImageUrlInput("");
      refresh();
    } catch {
      toast.error("Failed to update image");
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1 max-w-4xl">
        {/* Admin toolbar */}
        {isAdmin && (
          <div className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Admin:</span>
            <button
              onClick={async () => {
                await fetch("/api/admin/ai-action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "analyze", ideaId }),
                });
                toast.success("AI analysis triggered!");
                refresh();
              }}
              className="text-sm text-amber-700 hover:underline dark:text-amber-400"
            >
              Run AI Analysis
            </button>
            <button
              onClick={async () => {
                await fetch("/api/admin/ai-action", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "activate", ideaId }),
                });
                toast.success("Project activated!");
                refresh();
              }}
              className="text-sm text-amber-700 hover:underline dark:text-amber-400"
            >
              Activate Project
            </button>
          </div>
        )}

        {/* Rejection notice */}
        {idea.rejection_reason && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <h3 className="mb-1 font-semibold text-red-800 dark:text-red-200">This idea was not selected for development</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{idea.rejection_reason}</p>
            {idea.similar_idea_id && (
              <Link href={`/projects/${idea.similar_idea_id}`} className="mt-2 inline-block text-sm text-red-600 hover:underline dark:text-red-400">
                View similar project &rarr;
              </Link>
            )}
          </div>
        )}

        {/* GitHub Repository */}
        {idea.github_repo_url && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-border p-3">
            <Github className="h-5 w-5 text-muted-foreground" />
            <a href={idea.github_repo_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
              {idea.github_repo_url.replace("https://github.com/", "")}
            </a>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        {isAdmin && !idea.github_repo_url && (
          <Button variant="outline" size="sm" className="mb-6" onClick={async () => {
            try {
              const res = await fetch("/api/admin/ai-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create-repo", ideaId }),
              });
              const data = await res.json();
              if (data.success) { toast.success(`Repo created: ${data.repoUrl}`); refresh(); }
              else toast.error(data.error || "Failed");
            } catch { toast.error("Failed to create repo"); }
          }}>
            <Github className="mr-1 h-4 w-4" /> Create GitHub Repository
          </Button>
        )}

        {/* Teaser image */}
        <section className="mb-8">
          <div className="relative mb-6 h-48 w-full overflow-hidden rounded-xl">
            {teaserImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={teaserImageUrl} alt={idea.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <span className="text-6xl opacity-30">{resolveEmoji(idea.category_emoji)}</span>
              </div>
            )}
            <button
              onClick={() => setShowImageInput(!showImageInput)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70 transition-colors"
            >
              <ImageIcon className="h-3 w-3" />
              {t("editTeaser")}
            </button>
          </div>

          {showImageInput && (
            <div className="mb-4 space-y-3 rounded-lg border border-border p-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t("uploadImage") || "Upload image"}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || file.size > 2 * 1024 * 1024) {
                      toast.error("Max 2MB image");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const dataUrl = reader.result as string;
                      await fetch(`/api/projects/${ideaId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ teaserImageUrl: dataUrl }),
                      });
                      toast.success("Image uploaded!");
                      refresh();
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Paste image URL..."
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSaveTeaserImage} disabled={savingImage}>
                  {savingImage ? "..." : t("saveTeaser")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowImageInput(false); setImageUrlInput(""); }}>
                  {t("cancelTeaser")}
                </Button>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {idea.category && (
              <Badge variant="secondary">
                {resolveEmoji(idea.category_emoji)} {idea.category}
              </Badge>
            )}
            {sourceBadge && (
              <Badge variant="outline" className="text-xs">
                {sourceBadge}
              </Badge>
            )}
            {idea.author_login && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" /> {idea.author_login}
              </span>
            )}
          </div>

          {/* Full project description */}
          <div className="rounded-lg border border-border p-6">
            <MarkdownRenderer content={idea.body || ""} />
          </div>

          {/* Vote reasons */}
          {voteReasons?.length > 0 && (
            <div className="mt-6 rounded-lg border border-border p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Why people support this</h3>
              <div className="space-y-1">
                {voteReasons.map((r: { vote_reason: string }, i: number) => (
                  <p key={i} className="text-sm text-foreground">&ldquo;{r.vote_reason}&rdquo;</p>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* AI Analysis */}
        {analysis && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Bot className="h-5 w-5 text-primary" /> {t("aiSummary")}
            </h2>
            <div className="space-y-4">
              {analysis.feasibility && (
                <div className="mb-4">
                  <Badge
                    variant="outline"
                    className={`text-sm ${
                      analysis.feasibility === "high" || analysis.feasibility === "green"
                        ? "border-green-500 text-green-700 dark:text-green-300"
                        : analysis.feasibility === "medium" || analysis.feasibility === "yellow"
                          ? "border-amber-500 text-amber-700 dark:text-amber-300"
                          : "border-red-500 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {t("aiFeasibility")}: {analysis.feasibility}
                  </Badge>
                  {(analysis.feasibilityExplanation || analysis.feasibility_explanation) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {analysis.feasibilityExplanation || analysis.feasibility_explanation}
                    </p>
                  )}
                </div>
              )}

              {analysis.summary && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                  <p className="text-sm text-blue-900 dark:text-blue-100">{analysis.summary}</p>
                </div>
              )}

              {analysis.projectScope && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{t("projectScope")}</h3>
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
                    <p className="text-sm text-purple-900 dark:text-purple-100">{analysis.projectScope}</p>
                  </div>
                </div>
              )}

              {analysis.keyInsights && analysis.keyInsights.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{t("keyInsights")}</h3>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                    <ul className="list-inside list-disc space-y-1 text-sm text-amber-900 dark:text-amber-100">
                      {analysis.keyInsights.map((insight: string, idx: number) => (
                        <li key={idx}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* What's Needed: top open tasks */}
              {topOpenTasks.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">What&apos;s Needed</h3>
                  <div className="rounded-lg border border-iran-green/20 bg-iran-green/5 p-4 dark:border-iran-bright-green/30 dark:bg-iran-bright-green/10">
                    <ul className="space-y-2 text-sm">
                      {topOpenTasks.map((task) => (
                        <li key={task.id} className="flex items-start gap-2">
                          <Circle className="mt-0.5 h-3 w-3 shrink-0 text-iran-green" />
                          <button
                            onClick={() => onTabChange("tasks")}
                            className="text-start text-iran-deep-green hover:underline dark:text-iran-bright-green"
                          >
                            {task.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {tasks.filter((tk) => mapTaskStatus(tk.status) === "open").length > topOpenTasks.length && (
                      <button
                        onClick={() => onTabChange("tasks")}
                        className="mt-2 text-xs font-medium text-iran-deep-green hover:underline dark:text-iran-bright-green"
                      >
                        View all {tasks.filter((tk) => mapTaskStatus(tk.status) === "open").length} open tasks →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Risks */}
              {analysis.risks && analysis.risks.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Risks &amp; Considerations</h3>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                    <ul className="list-inside list-disc space-y-1 text-sm text-red-900 dark:text-red-100">
                      {analysis.risks.slice(0, 5).map((risk: string, idx: number) => (
                        <li key={idx}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Stats + Progress */}
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-bold">{t("stats")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold">
                  {typeof s.value === "number" ? (locale === "fa" ? s.value.toLocaleString("fa-IR") : s.value) : s.value}
                </p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {totalTasks > 0 && (
            <div className="mt-4 rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{t("progress")}</span>
                <span className="text-muted-foreground">
                  {doneTasks}/{totalTasks} ({progressPct}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Circle className="h-3 w-3 text-gray-400" /> {openTasks} {t("open")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-blue-500" /> {inProgressTasks} {t("inProgress")}
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" /> {inReviewTasks} {t("inReview")}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> {doneTasks} {t("done")}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* How to Contribute */}
        <section className="mb-8">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950/30">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-teal-800 dark:text-teal-200">
              <Zap className="h-5 w-5" /> {t("howToContribute")}
            </h3>
            <ol className="space-y-1 text-sm text-teal-700 dark:text-teal-300">
              <li>1. {t("step1")}</li>
              <li>2. {t("step2")}</li>
              <li>3. {t("step3")}</li>
            </ol>
          </div>
        </section>

        {/* Open Tasks Preview */}
        {topOpenTasks.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("openTasks")}</h2>
              <button onClick={() => onTabChange("tasks")} className="text-sm text-primary hover:underline">
                {t("viewAll")} <ChevronRight className="inline h-3 w-3" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {topOpenTasks.map((task) => (
                <div
                  key={task.id}
                  className="cursor-pointer rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  onClick={() => onTabChange("tasks")}
                >
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {task.skillsNeeded.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-[10px]">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Comments Preview removed — full discussion shown below */}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("recentActivity")}</h2>
              <button onClick={() => onTabChange("activity")} className="text-sm text-primary hover:underline">
                {t("viewAll")} <ChevronRight className="inline h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span>
                    <span className="font-medium">{entry.actor_name || "System"}</span>{" "}
                    <span className="text-muted-foreground">{entry.event_type.replace(/_/g, " ")}</span>
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{timeAgo(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Complete GitHub Discussion */}
        {comments.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Globe className="h-5 w-5" /> {t("originalDiscussion")}
              </h2>
              <div className="flex items-center gap-3">
                {idea.source_url && (
                  <a href={idea.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                    {t("viewOnGithub")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button onClick={() => onTabChange("discussion")} className="text-sm text-primary hover:underline">
                  {t("viewAll")} <ChevronRight className="inline h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Idea author + stats */}
            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={idea.author_avatar} />
                  <AvatarFallback>{(idea.author_login || "?")[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-bold">{idea.author_login || idea.author_name || "Unknown"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">Author</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  ↑ {idea.github_vote_count || 0} {t("statsUpvotes")}
                </span>
                <span>
                  {idea.comment_count ?? comments.filter((c: ProjectComment) => c.source === "github").length} {t("statsCommentsCount")}
                </span>
                <span>
                  {idea.replies_count ?? comments.filter((c: ProjectComment) => c.source === "github" && c.reply_to).length} {t("statsReplies")}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {comments
                .filter(c => !c.reply_to)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .slice(0, 5)
                .map(comment => {
                  const sourceBorderColor =
                    comment.source === "github"
                      ? "border-l-4 border-l-indigo-400 dark:border-l-indigo-500"
                      : comment.source === "ai"
                        ? "border-l-4 border-l-purple-400 dark:border-l-purple-500"
                        : "border-l-4 border-l-emerald-400 dark:border-l-emerald-500";
                  const replies = comments.filter(r => r.reply_to === comment.id)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  return (
                    <div key={comment.id}>
                      <div className={`rounded-xl border border-border bg-white shadow-sm dark:bg-gray-900 ${sourceBorderColor}`}>
                        {/* Author line */}
                        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.author_avatar} />
                            <AvatarFallback className="text-xs">{(comment.author_login || "?")[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-foreground text-sm truncate">
                              {comment.author_login || "Anonymous"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString(undefined, {
                                year: "numeric", month: "short", day: "numeric",
                              })}
                            </span>
                            {comment.source === "github" && (
                              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                From GitHub
                              </span>
                            )}
                            {comment.source === "ai" && (
                              <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                AI Assistant
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Body */}
                        <div className="px-4 py-3">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <MarkdownRenderer content={comment.body} />
                          </div>
                        </div>
                      </div>
                      {/* Threaded replies */}
                      {replies.length > 0 && (
                        <div className="ml-10 mt-2 space-y-2 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                          {replies.map(reply => {
                            const replyBorderColor =
                              reply.source === "github"
                                ? "border-l-4 border-l-indigo-400 dark:border-l-indigo-500"
                                : reply.source === "ai"
                                  ? "border-l-4 border-l-purple-400 dark:border-l-purple-500"
                                  : "border-l-4 border-l-emerald-400 dark:border-l-emerald-500";
                            return (
                              <div key={reply.id} className={`rounded-xl border border-border bg-white shadow-sm dark:bg-gray-900 ${replyBorderColor}`}>
                                <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/50">
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={reply.author_avatar} />
                                    <AvatarFallback className="text-[10px]">{(reply.author_login || "?")[0]?.toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-foreground text-sm truncate">{reply.author_login || "Anonymous"}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(reply.created_at).toLocaleDateString(undefined, {
                                      year: "numeric", month: "short", day: "numeric",
                                    })}
                                  </span>
                                  {reply.source === "github" && (
                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                      From GitHub
                                    </span>
                                  )}
                                </div>
                                <div className="px-4 py-3">
                                  <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <MarkdownRenderer content={reply.body} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            {comments.filter(c => !c.reply_to).length > 5 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => onTabChange("discussion")}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all {comments.filter(c => !c.reply_to).length} comments in Discussion tab
                  <ChevronRight className="inline h-3 w-3 ml-1" />
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
