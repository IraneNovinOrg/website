"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  Send,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Severity = "info" | "success" | "warning";

interface Announcement {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  severity: Severity;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

const SEVERITY_OPTIONS: Array<{ value: Severity; label: string; Icon: typeof Info }> = [
  { value: "info", label: "Info", Icon: Info },
  { value: "success", label: "Success", Icon: CheckCircle2 },
  { value: "warning", label: "Warning", Icon: AlertTriangle },
];

function severityBadge(s: Severity) {
  if (s === "success") return "bg-iran-green/15 text-iran-deep-green";
  if (s === "warning") return "bg-iran-saffron/15 text-iran-deep-green";
  return "bg-persia-indigo/10 text-persia-indigo";
}

export function AnnouncementsPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");
  const [endsAt, setEndsAt] = useState("");
  const [fanoutAll, setFanoutAll] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const remainingTitle = 140 - title.length;
  const remainingBody = 600 - body.length;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      if (!res.ok) throw new Error("Failed to load announcements");
      const json = await res.json();
      setItems(json.announcements || []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setTitle("");
    setBody("");
    setLinkUrl("");
    setLinkLabel("");
    setSeverity("info");
    setEndsAt("");
    setFanoutAll(false);
  }

  async function publish() {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          linkUrl: linkUrl.trim() || undefined,
          linkLabel: linkLabel.trim() || undefined,
          severity,
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          fanoutAll,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      toast.success(
        fanoutAll
          ? "Published — notifications firing to every user"
          : "Published — banner is live; notifications going to opt-ins"
      );
      resetForm();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function toggleActive(a: Announcement) {
    setBusyIds((s) => new Set(s).add(a.id));
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  }

  async function remove(a: Announcement) {
    if (!confirm(`Delete announcement "${a.title}"? This can't be undone.`)) return;
    setBusyIds((s) => new Set(s).add(a.id));
    try {
      const res = await fetch(`/api/admin/announcements/${a.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  }

  const activeCount = useMemo(() => items.filter((a) => a.active).length, [items]);

  return (
    <div className="space-y-8">
      {/* Composer */}
      <section className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-iran-green" />
          <h3 className="font-display text-lg font-semibold">Compose announcement</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Published announcements appear as a dismissable banner on every page, and are
          also sent as notifications to subscribers (or every user if you flip the
          &ldquo;All users&rdquo; toggle below).
        </p>

        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 140))}
              placeholder="We just launched!"
              className="mt-1 border-iran-green/20 focus-visible:ring-iran-green/40"
            />
            <p className="mt-1 text-xs text-muted-foreground">{remainingTitle} chars remaining</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Body</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 600))}
              placeholder="Thanks for being part of the community. Here's what's new…"
              rows={3}
              className="mt-1 border-iran-green/20 focus-visible:ring-iran-green/40"
            />
            <p className="mt-1 text-xs text-muted-foreground">{remainingBody} chars remaining</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Link URL (optional)</label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/projects or https://…"
                className="mt-1 border-iran-green/20 focus-visible:ring-iran-green/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Link label</label>
              <Input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Learn more"
                className="mt-1 border-iran-green/20 focus-visible:ring-iran-green/40"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <div className="mt-1 flex gap-2">
                {SEVERITY_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeverity(value)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      severity === value
                        ? "border-iran-green bg-iran-green/10 text-iran-deep-green dark:text-iran-bright-green"
                        : "border-iran-green/20 text-muted-foreground hover:bg-iran-green/5"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Auto-deactivate at (optional)
              </label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 border-iran-green/20 focus-visible:ring-iran-green/40"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-iran-green/15 bg-iran-green/5 p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 accent-iran-green"
              checked={fanoutAll}
              onChange={(e) => setFanoutAll(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Notify every user</span>
              <span className="block text-xs text-muted-foreground">
                Off (default): notify opt-ins in <code>site_subscriptions</code> only. On:
                fan out to every account — use for launch-day messages.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              onClick={publish}
              disabled={publishing || !title.trim() || !body.trim()}
              className="bg-iran-green hover:bg-iran-deep-green"
            >
              <Send className="mr-1 h-4 w-4" />
              {publishing ? "Publishing…" : "Publish"}
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={publishing}>
              Clear
            </Button>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            History
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {activeCount} active · {items.length} total
            </span>
          </h3>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No announcements yet. Publish your first launch message above.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => {
              const busy = busyIds.has(a.id);
              return (
                <li
                  key={a.id}
                  className="rounded-md border border-iran-green/10 bg-iran-green/5 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityBadge(a.severity)}`}>
                          {a.severity}
                        </span>
                        {!a.active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            inactive
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString()} · {a.createdBy || "unknown"}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold">{a.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>
                      {a.linkUrl && (
                        <a
                          href={a.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-iran-green hover:underline"
                        >
                          {a.linkLabel || a.linkUrl}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {a.endsAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Auto-deactivates {new Date(a.endsAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => toggleActive(a)}
                      >
                        {a.active ? (
                          <>
                            <EyeOff className="mr-1 h-3 w-3" /> Deactivate
                          </>
                        ) : (
                          <>
                            <Eye className="mr-1 h-3 w-3" /> Reactivate
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => remove(a)}
                        className="text-iran-red hover:bg-iran-red/10"
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
