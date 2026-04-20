"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ChevronUp, ChevronDown, ExternalLink, Search, Shield } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  github_login: string | null;
  provider: string;
  reputation_score: number;
  trust_level: number;
  created_at: string;
  last_active_at: string | null;
}

type SortKey = "created" | "name" | "email" | "trust" | "active";

const TRUST_LEVEL_META: Record<number, { label: string; className: string }> = {
  1: { label: "L1 · New", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  2: { label: "L2 · Active", className: "bg-iran-green/10 text-iran-deep-green dark:text-iran-bright-green border border-iran-green/30" },
  3: { label: "L3 · Trusted", className: "bg-iran-gold/15 text-iran-gold border border-iran-gold/30" },
  4: { label: "L4 · Leader", className: "bg-gradient-iran-gold text-white" },
};

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [totalCount, setTotalCount] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", sort });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [search, sort]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const changeTrust = async (userId: string, delta: 1 | -1) => {
    const current = users.find(u => u.id === userId);
    if (!current) return;
    const next = Math.max(1, Math.min(4, current.trust_level + delta));
    if (next === current.trust_level) return;

    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, trust_level: next }),
      });
      if (res.ok) {
        toast.success(`Trust level → L${next}`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, trust_level: next } : u));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Update failed");
      }
    } catch (e) {
      toast.error(`Error: ${e}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or GitHub login…"
            className="ps-9 border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-iran-green/20 bg-background px-3 py-2 text-sm focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
        >
          <option value="created">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="email">Email A–Z</option>
          <option value="trust">Trust level</option>
          <option value="active">Last active</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          className="border-iran-green/30 hover:bg-iran-green/10"
          onClick={fetchUsers}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iran-green/20 text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3">User</th>
              <th className="pb-2 pr-3">Email</th>
              <th className="pb-2 pr-3">GitHub</th>
              <th className="pb-2 pr-3">Trust</th>
              <th className="pb-2 pr-3">Created</th>
              <th className="pb-2 pr-3">Last Active</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6">
                  <Skeleton className="h-6" />
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No users match your search.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const meta = TRUST_LEVEL_META[u.trust_level] || TRUST_LEVEL_META[1];
              return (
                <tr key={u.id} className="border-b border-iran-green/10 last:border-0 hover:bg-iran-green/5">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full border border-iran-green/20"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-iran text-[10px] font-bold text-white">
                          {(u.name || u.email)?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name || "(no name)"}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{u.provider}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[180px] truncate py-2 pr-3 font-mono text-xs">{u.email}</td>
                  <td className="py-2 pr-3 text-xs">
                    {u.github_login ? (
                      <a
                        href={`https://github.com/${u.github_login}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-iran-green hover:text-iran-deep-green hover:underline"
                      >
                        @{u.github_login} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={`${meta.className} text-[10px]`}>
                      <Shield className="me-1 h-3 w-3" /> {meta.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => changeTrust(u.id, -1)}
                        disabled={updatingId === u.id || u.trust_level <= 1}
                        title="Demote trust level"
                        className="rounded p-1 text-iran-red hover:bg-iran-red/10 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => changeTrust(u.id, 1)}
                        disabled={updatingId === u.id || u.trust_level >= 4}
                        title="Promote trust level"
                        className="rounded p-1 text-iran-green hover:bg-iran-green/10 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <a
                        href={`/users/${u.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1 text-iran-gold hover:bg-iran-gold/10"
                        title="Open profile"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Showing {users.length} of {totalCount.toLocaleString()} users · trust levels 1 (new) → 4 (leader)
      </p>
    </div>
  );
}

export default UserManagement;
