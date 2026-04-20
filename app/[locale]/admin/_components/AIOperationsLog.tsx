"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, XCircle, ExternalLink, Coins } from "lucide-react";

type Range = "24h" | "7d" | "30d";

interface AIOperation {
  id: string;
  operation_type: string;
  idea_id: string | null;
  model_used: string | null;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number;
  success: number;
  error_message: string | null;
  created_at: string;
}

export function AIOperationsLog() {
  const [ops, setOps] = useState<AIOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>("7d");
  const [modelFilter, setModelFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [successFilter, setSuccessFilter] = useState<string>("");
  const [totalCount, setTotalCount] = useState(0);
  const [totalTokensInput, setTotalTokensInput] = useState(0);
  const [totalTokensOutput, setTotalTokensOutput] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  const fetchOps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range, limit: "50" });
      if (modelFilter) params.set("model", modelFilter);
      if (typeFilter) params.set("operation_type", typeFilter);
      if (successFilter) params.set("success", successFilter);

      const res = await fetch(`/api/admin/ai-operations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOps(data.operations || []);
        setTotalCount(data.totalCount || 0);
        setTotalTokensInput(data.totalTokensInput || 0);
        setTotalTokensOutput(data.totalTokensOutput || 0);
        setEstimatedCost(data.estimatedCost || 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [range, modelFilter, typeFilter, successFilter]);

  useEffect(() => { fetchOps(); }, [fetchOps]);

  // Unique values for filters
  const models = Array.from(new Set(ops.map(o => o.model_used).filter(Boolean))) as string[];
  const types = Array.from(new Set(ops.map(o => o.operation_type)));

  return (
    <div className="rounded-lg border border-iran-green/20 bg-white p-5 shadow-iran-green/50 dark:bg-gray-900">
      {/* Summary strip */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-iran-green/15 bg-gradient-to-br from-iran-green/5 to-transparent p-3">
          <p className="text-xs text-muted-foreground">Operations ({range})</p>
          <p className="mt-1 text-2xl font-bold text-gradient-iran">{totalCount.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-iran-gold/20 bg-gradient-to-br from-iran-gold/10 to-transparent p-3">
          <p className="text-xs text-muted-foreground">Tokens In</p>
          <p className="mt-1 text-2xl font-bold">{totalTokensInput.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-iran-gold/20 bg-gradient-to-br from-iran-gold/10 to-transparent p-3">
          <p className="text-xs text-muted-foreground">Tokens Out</p>
          <p className="mt-1 text-2xl font-bold">{totalTokensOutput.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-iran-gold/30 bg-gradient-to-br from-iran-gold/20 to-iran-saffron/10 p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Coins className="h-3 w-3" /> Est. Cost
          </p>
          <p className="mt-1 text-2xl font-bold text-gradient-gold">${estimatedCost.toFixed(4)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {(["24h", "7d", "30d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-iran-green text-white shadow-iran-green"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-iran-green/20 bg-background px-2 py-1 text-xs focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
        >
          <option value="">All operation types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="rounded-md border border-iran-green/20 bg-background px-2 py-1 text-xs focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
        >
          <option value="">All models</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value)}
          className="rounded-md border border-iran-green/20 bg-background px-2 py-1 text-xs focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
        >
          <option value="">All</option>
          <option value="1">Success only</option>
          <option value="0">Failures only</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          className="ml-auto border-iran-green/30 hover:bg-iran-green/10"
          onClick={fetchOps}
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
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3">Model</th>
              <th className="pb-2 pr-3">Idea</th>
              <th className="pb-2 pr-3">Tokens (in/out)</th>
              <th className="pb-2 pr-3">Latency</th>
              <th className="pb-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && ops.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6">
                  <Skeleton className="h-6" />
                </td>
              </tr>
            )}
            {!loading && ops.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No AI operations in this time range.
                </td>
              </tr>
            )}
            {ops.map((op) => (
              <tr key={op.id} className="border-b border-iran-green/10 last:border-0 hover:bg-iran-green/5">
                <td className="py-2 pr-3">
                  {op.success ? (
                    <span className="inline-flex h-2 w-2 rounded-full bg-iran-green shadow-[0_0_6px_rgba(0,155,58,0.5)]" title="Success" />
                  ) : (
                    <span className="inline-flex h-2 w-2 rounded-full bg-iran-red shadow-[0_0_6px_rgba(200,16,46,0.5)]" title="Failure" />
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  <Badge variant="outline" className="border-iran-green/30 text-iran-deep-green dark:text-iran-bright-green">
                    {op.operation_type}
                  </Badge>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {op.model_used ? (
                    <span className="rounded bg-iran-gold/10 px-2 py-0.5 text-[10px] font-medium text-iran-gold">
                      {op.model_used}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {op.idea_id ? (
                    <a
                      href={`/ideas/${op.idea_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-iran-green hover:text-iran-deep-green hover:underline"
                    >
                      {op.idea_id} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs font-mono">
                  <span className="text-muted-foreground">{op.tokens_input}</span>
                  <span className="mx-1 text-muted-foreground">/</span>
                  <span>{op.tokens_output}</span>
                </td>
                <td className="py-2 pr-3 text-xs">
                  <span className={op.latency_ms > 8000 ? "text-iran-red" : op.latency_ms > 3000 ? "text-iran-gold" : "text-iran-green"}>
                    {op.latency_ms}ms
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                  {op.created_at ? new Date(op.created_at).toLocaleString() : "-"}
                  {!op.success && op.error_message && (
                    <p className="mt-0.5 max-w-xs truncate text-[10px] text-iran-red" title={op.error_message}>
                      {op.error_message}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-iran-green" /> success
        <XCircle className="h-3 w-3 text-iran-red" /> failure · Showing up to 50 of {totalCount.toLocaleString()} operations
      </p>
    </div>
  );
}

export default AIOperationsLog;
