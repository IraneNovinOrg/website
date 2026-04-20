"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Send, Save, Filter, Eye, CheckCircle2, AlertCircle } from "lucide-react";

interface IdeaRow {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  project_status: string | null;
  github_vote_count: number | null;
  github_invite_posted_at: string | null;
  github_invite_comment_url: string | null;
}

interface Totals {
  total: number;
  posted: number;
  pending: number;
}

export function GitHubOutreachPanel() {
  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, posted: 0, pending: 0 });
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Template editor state
  const [templateBody, setTemplateBody] = useState("");
  const [templateEnabled, setTemplateEnabled] = useState(true);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  // Bulk filter state
  const [minVotes, setMinVotes] = useState(5);
  const [status, setStatus] = useState<string>("active");
  const [source, setSource] = useState<string>("all");
  const [limit, setLimit] = useState(25);
  const [force, setForce] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<null | {
    matched: number;
    posted: number;
    skipped: number;
    failed: number;
    dryRun: boolean;
    candidates?: Array<{ id: string; title: string; project_status: string | null; github_vote_count: number | null }>;
  }>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [listRes, tmplRes] = await Promise.all([
        fetch("/api/admin/github-invite"),
        fetch("/api/admin/github-invite/template"),
      ]);
      if (!listRes.ok) throw new Error("Failed to load invite list");
      if (!tmplRes.ok) throw new Error("Failed to load template");
      const listJson = await listRes.json();
      const tmplJson = await tmplRes.json();
      setIdeas(listJson.ideas || []);
      setTotals(listJson.totals || { total: 0, posted: 0, pending: 0 });
      setTemplateBody(tmplJson.body || "");
      setTemplateEnabled(tmplJson.enabled !== false);
      setTemplateDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function postOne(ideaId: string, opts: { force?: boolean } = {}) {
    setBusyIds((s) => new Set(s).add(ideaId));
    try {
      const res = await fetch("/api/admin/github-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, force: opts.force }),
      });
      const json = await res.json();
      if (!res.ok || (json.ok === false && !json.skipped)) {
        throw new Error(json.error || `Failed (${res.status})`);
      }
      if (json.skipped === "already_posted" && !opts.force) {
        toast.message("Already posted — use Force to re-post");
      } else {
        toast.success("Invitation posted");
      }
      await loadData();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(ideaId);
        return n;
      });
    }
  }

  async function runBulk(dryRun: boolean) {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/github-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          force,
          filter: {
            minVotes,
            limit,
            dryRun,
            source: source === "all" ? "all" : source,
            projectStatus: status === "any" ? ["any"] : [status],
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setBulkResult(json);
      if (!dryRun) {
        toast.success(`Posted ${json.posted}, skipped ${json.skipped}, failed ${json.failed}`);
        await loadData();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  async function saveTemplate() {
    setTemplateSaving(true);
    try {
      const res = await fetch("/api/admin/github-invite/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: templateBody, enabled: templateEnabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      toast.success("Template saved");
      setTemplateDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTemplateSaving(false);
    }
  }

  const pendingIdeas = useMemo(
    () => ideas.filter((i) => !i.github_invite_posted_at),
    [ideas]
  );
  const postedIdeas = useMemo(
    () => ideas.filter((i) => !!i.github_invite_posted_at),
    [ideas]
  );

  return (
    <div className="space-y-8">
      {/* Totals strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Eligible ideas" value={totals.total} />
        <StatCard label="Invites posted" value={totals.posted} tone="ok" />
        <StatCard label="Pending" value={totals.pending} tone="warn" />
      </div>

      {/* Template editor */}
      <section className="rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Invitation template</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={templateEnabled}
              onChange={(e) => { setTemplateEnabled(e.target.checked); setTemplateDirty(true); }}
            />
            Enabled
          </label>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Posted as a comment on the original GitHub discussion. Variables:{" "}
          <code className="rounded bg-iran-green/10 px-1">{"{{projectUrl}}"}</code>,{" "}
          <code className="rounded bg-iran-green/10 px-1">{"{{title}}"}</code>
        </p>
        <textarea
          value={templateBody}
          onChange={(e) => { setTemplateBody(e.target.value); setTemplateDirty(true); }}
          className="min-h-[180px] w-full rounded-md border border-iran-green/20 bg-background px-3 py-2 font-mono text-sm focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            disabled={!templateDirty || templateSaving}
            onClick={saveTemplate}
            className="bg-iran-green hover:bg-iran-deep-green"
          >
            <Save className="mr-1 h-4 w-4" />
            {templateSaving ? "Saving…" : "Save template"}
          </Button>
          {templateDirty && <span className="text-xs text-iran-saffron">Unsaved changes</span>}
        </div>
      </section>

      {/* Bulk panel */}
      <section className="rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Filter className="h-4 w-4" /> Bulk post
        </h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-muted-foreground">Min. votes</label>
            <input
              type="number"
              min={0}
              value={minVotes}
              onChange={(e) => setMinVotes(Math.max(0, parseInt(e.target.value) || 0))}
              className="mt-1 w-full rounded-md border border-iran-green/20 bg-background px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-iran-green/20 bg-background px-2 py-1 text-sm"
            >
              <option value="active">Active</option>
              <option value="needs-contributors">Needs contributors</option>
              <option value="idea">Idea</option>
              <option value="any">Any</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded-md border border-iran-green/20 bg-background px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              <option value="iranazadabad">IranAzadAbad</option>
              <option value="iranenovin">IranENovin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Limit per run</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(parseInt(e.target.value) || 25, 200)))}
              className="mt-1 w-full rounded-md border border-iran-green/20 bg-background px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force re-post (ignore already-posted flag)
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={bulkBusy}
            onClick={() => runBulk(true)}
          >
            <Eye className="mr-1 h-4 w-4" />
            Dry run (preview)
          </Button>
          <Button
            size="sm"
            disabled={bulkBusy}
            onClick={() => runBulk(false)}
            className="bg-iran-green hover:bg-iran-deep-green"
          >
            <Send className="mr-1 h-4 w-4" />
            {bulkBusy ? "Posting…" : "Post to matching"}
          </Button>
        </div>

        {bulkResult && (
          <div className="mt-4 rounded-md border border-iran-green/15 bg-iran-green/5 p-3 text-sm">
            <p className="font-medium">
              {bulkResult.dryRun ? "Preview" : "Result"}: matched {bulkResult.matched}
              {!bulkResult.dryRun && (
                <> — posted {bulkResult.posted}, skipped {bulkResult.skipped}, failed {bulkResult.failed}</>
              )}
            </p>
            {bulkResult.candidates && bulkResult.candidates.length > 0 && (
              <ul className="mt-2 max-h-60 list-disc overflow-auto pl-5">
                {bulkResult.candidates.slice(0, 50).map((c) => (
                  <li key={c.id} className="text-xs">
                    <span className="font-mono">{c.id}</span> — {c.title}
                    <span className="ml-2 text-muted-foreground">
                      ({c.project_status || "idea"}, {c.github_vote_count || 0}★)
                    </span>
                  </li>
                ))}
                {bulkResult.candidates.length > 50 && (
                  <li className="text-xs text-muted-foreground">
                    …and {bulkResult.candidates.length - 50} more
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Per-idea table */}
      <section className="rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Ideas</h3>
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <IdeaTable
          title={`Pending (${pendingIdeas.length})`}
          rows={pendingIdeas}
          busyIds={busyIds}
          onPost={(id) => postOne(id)}
          showPosted={false}
        />

        {postedIdeas.length > 0 && (
          <div className="mt-6">
            <IdeaTable
              title={`Already posted (${postedIdeas.length})`}
              rows={postedIdeas}
              busyIds={busyIds}
              onPost={(id) => postOne(id, { force: true })}
              showPosted
            />
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color =
    tone === "ok" ? "text-iran-green" : tone === "warn" ? "text-iran-saffron" : "text-foreground";
  return (
    <div className="rounded-lg border border-iran-green/20 bg-white px-4 py-3 dark:bg-gray-900">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function IdeaTable({
  title,
  rows,
  busyIds,
  onPost,
  showPosted,
}: {
  title: string;
  rows: IdeaRow[];
  busyIds: Set<string>;
  onPost: (id: string) => void;
  showPosted: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <div className="max-h-[500px] overflow-auto rounded-md border border-iran-green/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-iran-green/10 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Idea</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5 text-right">Votes</th>
                <th className="px-2 py-1.5">GitHub</th>
                <th className="px-2 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => {
                const busy = busyIds.has(r.id);
                return (
                  <tr key={r.id} className="border-t border-iran-green/10">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{r.id}</span> · {r.source}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {r.project_status || "idea"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">
                      {r.github_vote_count || 0}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.source_url && (
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-iran-green hover:underline"
                        >
                          discussion <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {showPosted && r.github_invite_comment_url ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={r.github_invite_comment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-iran-green hover:underline"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            posted
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onPost(r.id)}
                          >
                            Re-post
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => onPost(r.id)}
                          className="bg-iran-green hover:bg-iran-deep-green"
                        >
                          {busy ? "…" : (<><Send className="mr-1 h-3 w-3" /> Post</>)}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p className="p-2 text-xs text-muted-foreground">
              Showing first 200 of {rows.length}. Use filters on the bulk panel.
            </p>
          )}
        </div>
      )}
      {rows.length > 0 && rows.some((r) => !r.source_url) && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-iran-saffron">
          <AlertCircle className="h-3 w-3" /> Rows without a GitHub discussion URL cannot receive invitations.
        </p>
      )}
    </div>
  );
}
