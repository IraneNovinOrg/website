"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, RefreshCw, Database, Users, Lightbulb, BarChart3,
  Play, CheckCircle2, XCircle, Settings, Send, MessageCircle,
  Zap, FileText, ArrowRight, Save, Loader2, ScrollText,
  Activity, Sparkles, LineChart as LineChartIcon, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { GirihPattern } from "@/components/brand/GirihPattern";
import { AIOperationsLog } from "./_components/AIOperationsLog";
import { SkillTriggerPanel } from "./_components/SkillTriggerPanel";
import { AdminCharts } from "./_components/AdminCharts";
import { UserManagement } from "./_components/UserManagement";
import { GitHubOutreachPanel } from "./_components/GitHubOutreachPanel";
import { AdminSettings } from "./_components/AdminSettings";
import { AnnouncementsPanel } from "./_components/AnnouncementsPanel";

// ─── Agent Config Editor Component ──────────────────────────────
function AgentConfigEditor() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        setConfig(await res.json());
      } else {
        toast.error("Failed to load agent config");
      }
    } catch {
      toast.error("Failed to load agent config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success("Agent configuration saved!");
      } else {
        toast.error("Failed to save agent config");
      }
    } catch {
      toast.error("Failed to save agent config");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) return <Skeleton className="h-48" />;
  if (!config) return <p className="text-sm text-muted-foreground">Could not load agent configuration.</p>;

  const fields: { key: string; label: string; type: "toggle" | "number" }[] = [
    { key: "enabled", label: "Agent Enabled", type: "toggle" },
    { key: "maxAnalysesPerCycle", label: "Max Analyses Per Cycle", type: "number" },
    { key: "maxReviewsPerCycle", label: "Max Reviews Per Cycle", type: "number" },
    { key: "autoActivateMinVotes", label: "Auto-Activate Min Votes", type: "number" },
    { key: "analyzeMinVotes", label: "Analyze Min Votes", type: "number" },
    { key: "cooldownMinutes", label: "Cooldown (minutes)", type: "number" },
    { key: "cyclePeriodMinutes", label: "Cycle Period (minutes)", type: "number" },
  ];

  return (
    <div className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, type }) => (
          <div key={key} className="flex items-center justify-between rounded border border-iran-green/10 bg-iran-green/5 p-3 dark:bg-gray-800">
            <label className="text-sm font-medium">{label}</label>
            {type === "toggle" ? (
              <button
                onClick={() => updateField(key, !config[key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config[key] ? "bg-iran-green shadow-iran-green" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            ) : (
              <Input
                type="number"
                value={config[key] ?? ""}
                onChange={(e) => updateField(key, Number(e.target.value))}
                className="w-24 text-right border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button variant="outline" size="sm" onClick={fetchConfig} disabled={saving} className="border-iran-green/30 hover:bg-iran-green/10">
          <RefreshCw className="mr-1 h-4 w-4" /> Reset
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green">
          {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-1 h-4 w-4" /> Save Configuration</>}
        </Button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [debug, setDebug] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Control
  const [analyzeIdeaId, setAnalyzeIdeaId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  // AI Chat
  const [chatProject, setChatProject] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Data
  const [showTableCounts, setShowTableCounts] = useState(false);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logLevel, setLogLevel] = useState<string>("all");
  const [logsLoading, setLogsLoading] = useState(false);

  // Tabs
  type TabKey = "overview" | "ai" | "charts" | "users" | "data" | "logs" | "outreach" | "announcements" | "settings";
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Authoritative admin check — delegated to the server which reads the
  // admin list from `_config/ai.json` (see `lib/admin.ts`). Keeps the client
  // bundle from having to know the admin list.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!session?.user?.email) { setIsAdmin(false); return; }
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((j) => { if (!cancelled) setIsAdmin(!!j.isAdmin); })
      .catch(() => { if (!cancelled) setIsAdmin(false); });
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  const fetchData = () => {
    Promise.all([
      fetch("/api/admin/stats").then(r => r.ok ? r.json() : null),
      fetch("/api/debug").then(r => r.json()).catch(() => null),
      fetch("/api/ideas?limit=500&sort=top").then(r => r.json()).catch(() => ({ ideas: [] })),
    ]).then(([s, d, p]) => {
      setStats(s);
      setDebug(d);
      setProjects(p?.ideas || []);
    }).finally(() => setLoading(false));
  };

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const url = logLevel === "all" ? "/api/admin/logs?limit=50" : `/api/admin/logs?level=${logLevel}&limit=50`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch { /* ignore */ } finally {
      setLogsLoading(false);
    }
  }, [logLevel]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Auto-refresh logs every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs, isAdmin]);

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <LionSunLogo size="xl" className="mx-auto mb-4" />
        <h1 className="text-display-md text-gradient-iran font-display">Admin Panel</h1>
        <p className="mt-2 text-muted-foreground">Sign in with an admin account.</p>
      </div>
    );
  }

  // Admin check pending — render a skeleton instead of "Access Denied".
  if (isAdmin === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-iran-green" />
        <p className="text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <XCircle className="mx-auto mb-4 h-12 w-12 text-iran-red" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">{session.user?.email} is not an admin.</p>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────

  const runSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      // Fallback: use the agent cycle directly
      if (!res.ok) {
        // Try triggering via the cycle
        toast.info("Triggering full sync cycle...");
        await fetch("/api/admin/ai-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze", ideaId: "__sync_only__" }),
        }).catch(() => {});
      }
      toast.success("Sync triggered!");
      setTimeout(fetchData, 5000);
    } catch (e) {
      toast.error(`Sync failed: ${e}`);
    } finally {
      setSyncing(false);
    }
  };

  const analyzeIdea = async () => {
    if (!analyzeIdeaId.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/admin/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", ideaId: analyzeIdeaId.trim() }),
      });
      if (res.ok) {
        toast.success(`Analysis triggered for ${analyzeIdeaId}`);
        setAnalyzeIdeaId("");
        setTimeout(fetchData, 5000);
      } else {
        const err = await res.json();
        toast.error(err.error || err.message || "Failed");
      }
    } catch (e) {
      toast.error(`Error: ${e}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeAllUnanalyzed = async () => {
    setBulkAnalyzing(true);
    setBulkProgress("Starting...");
    try {
      // Get unanalyzed ideas
      const ideasRes = await fetch("/api/ideas?limit=500&sort=top");
      const ideasData = await ideasRes.json();
      const allIdeas = ideasData.ideas || [];

      // Filter to those without analysis (feasibility = null)
      const unanalyzed = allIdeas.filter((i: any) => !i.feasibility);
      setBulkProgress(`Found ${unanalyzed.length} unanalyzed ideas`);

      let done = 0;
      for (const idea of unanalyzed.slice(0, 10)) { // Max 10 at a time
        setBulkProgress(`Analyzing ${done + 1}/${Math.min(unanalyzed.length, 10)}: ${idea.title?.slice(0, 40)}...`);
        try {
          await fetch("/api/admin/ai-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "analyze", ideaId: idea.id }),
          });
          done++;
          // Wait between analyses
          await new Promise(r => setTimeout(r, 3000));
        } catch {
          setBulkProgress(`Failed on ${idea.id}, continuing...`);
        }
      }
      setBulkProgress(`Done! Analyzed ${done} ideas. ${Math.max(0, unanalyzed.length - 10)} remaining.`);
      toast.success(`Analyzed ${done} ideas`);
      setTimeout(fetchData, 3000);
    } catch (e) {
      setBulkProgress(`Error: ${e}`);
      toast.error(`Bulk analysis failed: ${e}`);
    } finally {
      setBulkAnalyzing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatProject || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);

    try {
      const proj = projects.find((p: any) => p.id === chatProject);
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId: chatProject,
          ideaTitle: proj?.title || chatProject,
          ideaBody: proj?.body?.slice(0, 4000) || "",
          message: msg,
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || data.error || "No response"
      }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `Error: ${e}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "ai", label: "AI Operations", icon: Activity },
    { key: "charts", label: "Analytics", icon: LineChartIcon },
    { key: "users", label: "Users", icon: UserCog },
    { key: "outreach", label: "GitHub Outreach", icon: Sparkles },
    { key: "announcements", label: "Announcements", icon: Send },
    { key: "data", label: "Data", icon: Database },
    { key: "logs", label: "Logs", icon: ScrollText },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-8">
      {/* Subtle Girih pattern overlay on the top section */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
        <GirihPattern position="top-right" opacity={0.05} color="text-iran-gold" size={100} />
      </div>

      {/* Header */}
      <div className="relative mb-6 flex flex-wrap items-center gap-3">
        <LionSunLogo size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-display-md text-gradient-iran font-display">Admin Panel</h1>
          <p className="truncate text-sm text-muted-foreground">Logged in as {session.user?.email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ms-auto border-iran-green/30 hover:bg-iran-green/10"
          onClick={fetchData}
        >
          <RefreshCw className="me-1 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Tab navigation — horizontally scrollable on narrow screens (8 tabs). */}
      <div className="relative mb-8 -mx-4 overflow-x-auto border-b border-iran-green/20 px-4 sm:mx-0 sm:px-0">
        <div className="flex snap-x snap-mandatory items-center gap-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex shrink-0 snap-start items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                  active
                    ? "text-iran-deep-green dark:text-iran-bright-green"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-iran-green" : ""}`} />
                {label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-iran-gold" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          {/* ═══ SECTION 1: Platform Stats ═══ */}
          {activeTab === "overview" && (
          <>
          {/* ═══ Community — signup funnel ═══ */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Users className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Community</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[
                { label: "Total Signups", value: stats?.totalUsers ?? 0, sub: "all providers" },
                { label: "New Today", value: stats?.usersToday ?? 0, sub: "last 24h" },
                { label: "New This Week", value: stats?.usersThisWeek ?? 0, sub: "last 7 days" },
                { label: "New This Month", value: stats?.usersThisMonth ?? 0, sub: "last 30 days" },
                { label: "Contributing Users", value: stats?.contributingUsers ?? 0, sub: "voted, commented, or joined a project" },
                { label: "Project Joins", value: stats?.projectJoins ?? 0, sub: "help offers + follows" },
                { label: "Profiles Completed", value: stats?.completedProfiles ?? 0, sub: "filled out their bio" },
                {
                  label: "By Provider",
                  value: stats?.usersByProvider
                    ? Object.entries(stats.usersByProvider)
                        .map(([p, c]) => `${p}: ${c}`)
                        .join(" · ")
                    : "—",
                  sub: "sign-in method mix",
                  isString: true,
                },
              ].map(({ label, value, sub, isString }) => (
                <div
                  key={label}
                  className="card-hover rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className={`mt-1 font-bold text-gradient-iran ${isString ? "text-sm" : "text-2xl"}`}>
                    {value}
                  </p>
                  {sub && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
                  )}
                </div>
              ))}
            </div>
            {/* 30-day sparkline */}
            {stats?.signupSeries && stats.signupSeries.length > 0 && (
              <div className="mt-4 rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Signups · last 30 days
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stats.signupSeries.reduce((s: number, p: { c: number }) => s + p.c, 0)} total
                  </span>
                </div>
                <div className="flex h-16 items-end gap-0.5">
                  {(() => {
                    const series = stats.signupSeries as Array<{ day: string; c: number }>;
                    const max = Math.max(...series.map((p) => p.c), 1);
                    return series.map((p) => (
                      <div
                        key={p.day}
                        title={`${p.day}: ${p.c}`}
                        className="flex-1 rounded-t bg-gradient-to-t from-iran-green to-iran-bright-green"
                        style={{ height: `${Math.max((p.c / max) * 100, 4)}%` }}
                      />
                    ));
                  })()}
                </div>
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <BarChart3 className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Platform Stats</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[
                { label: "Total Ideas", value: stats?.totalIdeas ?? 0, icon: Lightbulb, color: "text-iran-green" },
                { label: "With AI Analysis", value: stats?.analyzedIdeas ?? 0, icon: Bot, color: "text-iran-deep-green" },
                { label: "Without Analysis", value: stats?.unanalyzedIdeas ?? 0, icon: XCircle, color: "text-iran-gold" },
                { label: "Active Projects", value: stats?.activeProjects ?? 0, icon: Zap, color: "text-persia-turquoise" },
                { label: "Total Tasks", value: stats?.totalTasks ?? 0, icon: CheckCircle2, color: "text-iran-green" },
                { label: "Open Tasks", value: stats?.openTasks ?? 0, icon: ArrowRight, color: "text-iran-saffron" },
                { label: "Completed Tasks", value: stats?.completedTasks ?? 0, icon: CheckCircle2, color: "text-iran-green" },
                { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-persia-indigo" },
                { label: "Comments", value: stats?.totalComments ?? 0, icon: MessageCircle, color: "text-persia-turquoise" },
                { label: "GitHub Comments", value: stats?.githubComments ?? 0, icon: FileText, color: "text-muted-foreground" },
                { label: "Local Comments", value: stats?.localComments ?? 0, icon: MessageCircle, color: "text-iran-green" },
                { label: "Help Offers", value: stats?.totalHelpOffers ?? 0, icon: Users, color: "text-iran-red" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="card-hover relative flex items-center gap-3 overflow-hidden rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900"
                >
                  {/* Gold accent dot */}
                  <span className="absolute right-2 top-2 inline-block h-1.5 w-1.5 rounded-full bg-iran-gold/70" />
                  <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                  <div>
                    <p className="text-2xl font-bold text-gradient-iran">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            {stats?.lastSync && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="inline-flex h-2 w-2 -translate-y-[1px] rounded-full bg-iran-green me-1" />
                Last sync: {new Date(stats.lastSync).toLocaleString()} · Last analysis: {stats.lastAnalysis ? new Date(stats.lastAnalysis).toLocaleString() : "Never"}
              </p>
            )}
          </section>
          </>
          )}

          {/* ═══ SECTION 2: AI Control ═══ */}
          {activeTab === "ai" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Bot className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">AI Control</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Sync */}
              <div className="card-hover rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
                <h3 className="mb-2 font-bold">Run Sync Now</h3>
                <p className="mb-3 text-sm text-muted-foreground">Sync ideas from GitHub and run the agent cycle.</p>
                <Button
                  onClick={runSync}
                  disabled={syncing}
                  variant="outline"
                  className="border-iran-green/30 hover:bg-iran-green/10"
                >
                  {syncing ? <><RefreshCw className="mr-1 h-4 w-4 animate-spin" /> Syncing...</> : <><RefreshCw className="mr-1 h-4 w-4" /> Sync Now</>}
                </Button>
              </div>

              {/* Analyze single idea */}
              <div className="card-hover rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
                <h3 className="mb-2 font-bold">Analyze Idea</h3>
                <p className="mb-3 text-sm text-muted-foreground">Enter an idea ID to trigger AI analysis.</p>
                <div className="flex gap-2">
                  <Input
                    value={analyzeIdeaId}
                    onChange={(e) => setAnalyzeIdeaId(e.target.value)}
                    placeholder="e.g. iae-42"
                    onKeyDown={(e) => e.key === "Enter" && analyzeIdea()}
                    className="border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
                  />
                  <Button
                    onClick={analyzeIdea}
                    disabled={analyzing || !analyzeIdeaId.trim()}
                    className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green"
                  >
                    {analyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
                  </Button>
                </div>
              </div>

              {/* Bulk analyze */}
              <div className="card-hover rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900 md:col-span-2">
                <h3 className="mb-2 font-bold">Analyze All Unanalyzed</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Queue AI analysis for all ideas without analysis. Runs up to 10 at a time with delays.
                  Currently {stats?.unanalyzedIdeas ?? "?"} ideas need analysis.
                </p>
                <Button
                  onClick={analyzeAllUnanalyzed}
                  disabled={bulkAnalyzing}
                  className="bg-gradient-iran-gold text-white shadow-iran-gold hover:opacity-95"
                >
                  {bulkAnalyzing ? <><RefreshCw className="mr-1 h-4 w-4 animate-spin" /> Running...</> : <><Zap className="mr-1 h-4 w-4" /> Analyze All ({stats?.unanalyzedIdeas ?? 0})</>}
                </Button>
                {bulkProgress && (
                  <p className="mt-3 rounded border border-iran-green/15 bg-iran-green/5 p-2 text-sm text-muted-foreground">{bulkProgress}</p>
                )}
              </div>

              {/* System status */}
              <div className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900 md:col-span-2">
                <h3 className="mb-2 font-bold">AI Configuration</h3>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded border border-iran-green/10 bg-iran-green/5 p-2">
                    <span>Default Model</span>
                    <Badge variant="outline" className="border-iran-green/30">{debug?.aiConfig?.defaultModel || "?"}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border border-iran-green/10 bg-iran-green/5 p-2">
                    <span>GitHub Token</span>
                    <Badge className={debug?.github?.tokenSet
                      ? "bg-iran-green/10 text-iran-deep-green border border-iran-green/30 dark:text-iran-bright-green"
                      : "bg-iran-red/10 text-iran-red border border-iran-red/30"
                    }>
                      <span className={`me-1 inline-block h-2 w-2 rounded-full ${debug?.github?.tokenSet ? "bg-iran-green" : "bg-iran-red"}`} />
                      {debug?.github?.tokenSet ? "Set" : "Missing"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border border-iran-green/10 bg-iran-green/5 p-2">
                    <span>Anthropic Key</span>
                    <Badge className={debug?.ai?.anthropicKeySet
                      ? "bg-iran-green/10 text-iran-deep-green border border-iran-green/30 dark:text-iran-bright-green"
                      : "bg-iran-gold/10 text-iran-gold border border-iran-gold/30"
                    }>
                      <span className={`me-1 inline-block h-2 w-2 rounded-full ${debug?.ai?.anthropicKeySet ? "bg-iran-green" : "bg-iran-gold"}`} />
                      {debug?.ai?.anthropicKeySet ? "Set" : "Not set"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border border-iran-green/10 bg-iran-green/5 p-2">
                    <span>Enabled Models</span>
                    <span className="text-xs">{(debug?.aiConfig?.enabledModels || []).join(", ") || "None"}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}

          {/* ═══ SECTION 2.3: Skill Trigger Panel (NEW) ═══ */}
          {activeTab === "ai" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-iran-gold" />
              <span className="text-gradient-gold font-display">Skill Trigger</span>
            </h2>
            <SkillTriggerPanel />
          </section>
          )}

          {/* ═══ SECTION 2.4: AI Operations Log (NEW) ═══ */}
          {activeTab === "ai" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">AI Operations Log</span>
            </h2>
            <AIOperationsLog />
          </section>
          )}

          {/* ═══ SECTION 2.5: Agent Configuration ═══ */}
          {activeTab === "ai" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Settings className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Agent Configuration</span>
            </h2>
            <AgentConfigEditor />
          </section>
          )}

          {/* ═══ SECTION 3: AI Chat (Admin Co-Pilot) ═══ */}
          {activeTab === "ai" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <MessageCircle className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">AI Co-Pilot</span>
            </h2>
            <div className="rounded-lg border border-iran-green/20 bg-white dark:bg-gray-900">
              {/* Project selector */}
              <div className="border-b border-iran-green/15 p-4">
                <label className="mb-1 block text-sm font-medium">Select Project</label>
                <select
                  value={chatProject}
                  onChange={(e) => { setChatProject(e.target.value); setChatMessages([]); }}
                  className="w-full rounded-md border border-iran-green/20 bg-background px-3 py-2 text-sm focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
                >
                  <option value="">Choose a project...</option>
                  {projects.slice(0, 100).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title?.slice(0, 80)} ({p.id})</option>
                  ))}
                </select>
              </div>

              {/* Chat messages */}
              <div className="h-[350px] overflow-auto p-4 space-y-3">
                {chatMessages.length === 0 && chatProject && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Ask the AI anything about this project. Try: &quot;What tasks should we create?&quot; or &quot;Summarize this project.&quot;
                  </p>
                )}
                {!chatProject && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Select a project above to start chatting with the AI.
                  </p>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-iran-green text-white shadow-iran-green"
                        : "bg-iran-green/5 border border-iran-green/15 text-foreground"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-iran-green/5 border border-iran-green/15 px-3 py-2 text-sm text-muted-foreground animate-pulse">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick actions */}
              {chatProject && (
                <div className="flex flex-wrap gap-1 border-t border-iran-green/15 px-4 py-2">
                  {["What should we do next?", "Summarize progress", "Generate task ideas", "Review open tasks"].map(q => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="rounded-full border border-iran-green/20 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-iran-green/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 border-t border-iran-green/15 p-4">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                  placeholder={chatProject ? "Ask the AI about this project..." : "Select a project first"}
                  disabled={!chatProject}
                  rows={2}
                  className="flex-1 text-sm resize-none border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
                />
                <Button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim() || !chatProject}
                  className="self-end bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
          )}

          {/* ═══ SECTION: Charts (NEW) ═══ */}
          {activeTab === "charts" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <LineChartIcon className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Analytics & Charts</span>
            </h2>
            <AdminCharts />
          </section>
          )}

          {/* ═══ SECTION: User Management (NEW) ═══ */}
          {activeTab === "users" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <UserCog className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">User Management</span>
            </h2>
            <UserManagement />
          </section>
          )}

          {/* ═══ SECTION: GitHub Outreach — invitation CTA ═══ */}
          {activeTab === "outreach" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">GitHub Outreach</span>
            </h2>
            <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
              Post a recruitment comment on the original GitHub discussion for each
              idea, pointing people to its IranENovin project page. Already-invited
              ideas are skipped automatically.
            </p>
            <GitHubOutreachPanel />
          </section>
          )}

          {/* ═══ SECTION: Site-wide announcements ═══ */}
          {activeTab === "announcements" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Send className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Announcements</span>
            </h2>
            <AnnouncementsPanel />
          </section>
          )}

          {/* ═══ SECTION 4: Data Management ═══ */}
          {activeTab === "data" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Database className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Data Management</span>
            </h2>
            <div className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
              <div className="flex flex-wrap gap-3 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-iran-green/30 hover:bg-iran-green/10"
                  onClick={() => setShowTableCounts(!showTableCounts)}
                >
                  <Database className="mr-1 h-4 w-4" /> {showTableCounts ? "Hide" : "Show"} SQLite Stats
                </Button>
                <Button variant="outline" size="sm" className="border-iran-gold/30 hover:bg-iran-gold/10" onClick={async () => {
                  try {
                    await fetch("/api/admin/ai-action", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "analyze", ideaId: "__test__" }),
                    });
                    toast.success("Test complete");
                  } catch { toast.error("Test failed"); }
                }}>
                  <Play className="mr-1 h-4 w-4 text-iran-gold" /> Test AI Connection
                </Button>
              </div>

              {showTableCounts && stats?.tableCounts && (
                <div className="rounded-lg border border-iran-green/15 bg-iran-green/5 p-4">
                  <h4 className="mb-2 font-bold text-sm">SQLite Table Row Counts</h4>
                  <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(stats.tableCounts).map(([table, count]) => (
                      <div key={table} className="flex items-center justify-between rounded border border-iran-green/10 bg-white px-3 py-1.5 dark:bg-gray-900">
                        <code className="text-xs">{table}</code>
                        <Badge variant="outline" className="border-iran-green/30">{String(count)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p>Database: <code className="rounded bg-iran-green/10 px-1">_data/iranenovin.db</code></p>
                <p>AI Config: <code className="rounded bg-iran-green/10 px-1">_config/ai.json</code></p>
                <p>Playbooks: <code className="rounded bg-iran-green/10 px-1">_config/ai-playbooks/</code></p>
              </div>
            </div>
          </section>
          )}

          {/* === SECTION 5: Logs === */}
          {activeTab === "logs" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <ScrollText className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Logs</span>
            </h2>
            <div className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
              {/* Level filter */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {["all", "info", "warn", "error", "critical"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLogLevel(lvl)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      logLevel === lvl
                        ? "bg-iran-green text-white shadow-iran-green"
                        : "bg-iran-green/5 text-muted-foreground hover:bg-iran-green/10"
                    }`}
                  >
                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto border-iran-green/30 hover:bg-iran-green/10"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${logsLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>

              {/* Logs table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-iran-green/20 text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3">Level</th>
                      <th className="pb-2 pr-3">Message</th>
                      <th className="pb-2 pr-3">Context</th>
                      <th className="pb-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          {logsLoading ? "Loading..." : "No logs found"}
                        </td>
                      </tr>
                    )}
                    {logs.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-iran-green/10 last:border-0">
                        <td className="py-2 pr-3">
                          <Badge
                            variant="outline"
                            className={
                              entry.level === "critical"
                                ? "border-iran-red bg-iran-red/10 text-iran-red"
                                : entry.level === "error"
                                  ? "border-iran-red/60 text-iran-red"
                                  : entry.level === "warn"
                                    ? "border-iran-gold/60 text-iran-gold"
                                    : "border-iran-green/40 text-iran-deep-green dark:text-iran-bright-green"
                            }
                          >
                            <span className={`me-1 inline-block h-1.5 w-1.5 rounded-full ${
                              entry.level === "critical" || entry.level === "error" ? "bg-iran-red"
                              : entry.level === "warn" ? "bg-iran-gold"
                              : "bg-iran-green"
                            }`} />
                            {entry.level}
                          </Badge>
                        </td>
                        <td className="max-w-md truncate py-2 pr-3 font-mono text-xs">{entry.message}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{entry.context || "-"}</td>
                        <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                          {entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Auto-refreshes every 30 seconds. Showing up to 50 entries.
              </p>
            </div>
          </section>
          )}

          {/* === SECTION 6: Settings (Admins) === */}
          {activeTab === "settings" && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Settings className="h-5 w-5 text-iran-green" />
              <span className="text-gradient-iran font-display">Admin Settings</span>
            </h2>
            <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
              Manage the list of admin emails for this platform. Changes are written to
              {" "}<code className="rounded bg-iran-green/10 px-1">_config/ai.json</code> and take
              effect within 30 seconds (admin cache TTL).
            </p>
            <AdminSettings />
          </section>
          )}
        </>
      )}
    </div>
  );
}
