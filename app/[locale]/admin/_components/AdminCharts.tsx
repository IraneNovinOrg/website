"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = {
  green: "#009B3A",
  gold: "#D4A843",
  red: "#C8102E",
  turquoise: "#20B2AA",
};

interface ActivityPoint { date: string; comments: number; votes: number; tasks: number }
interface CategoryPoint { category: string; votes: number; ideas: number }
interface AIUsagePoint { operation_type: string; count: number; success_rate: number; avg_latency: number }

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-iran-green/20 bg-white p-4 dark:bg-gray-900">
      <div className="mb-3">
        <h4 className="font-bold text-sm">{title}</h4>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
      <span>No {label} data yet.</span>
    </div>
  );
}

export function AdminCharts() {
  const [activity, setActivity] = useState<ActivityPoint[] | null>(null);
  const [categories, setCategories] = useState<CategoryPoint[] | null>(null);
  const [aiUsage, setAIUsage] = useState<AIUsagePoint[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/charts/activity").then(r => r.ok ? r.json() : []).then(setActivity).catch(() => setActivity([]));
    fetch("/api/admin/charts/categories").then(r => r.ok ? r.json() : []).then(setCategories).catch(() => setCategories([]));
    fetch("/api/admin/charts/ai-usage").then(r => r.ok ? r.json() : []).then(setAIUsage).catch(() => setAIUsage([]));
  }, []);

  const activityHasData = activity && activity.some(a => a.comments || a.votes || a.tasks);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Activity over time */}
      <div className="md:col-span-2">
        <ChartCard title="Activity (last 30 days)" subtitle="Comments, votes and tasks per day">
          {activity === null ? (
            <Skeleton className="h-full w-full" />
          ) : !activityHasData ? (
            <EmptyState label="activity" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activity} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)}
                  stroke="currentColor"
                  opacity={0.6}
                />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: COLORS.green }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="comments" stroke={COLORS.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="votes" stroke={COLORS.gold} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="tasks" stroke={COLORS.red} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Top categories */}
      <ChartCard title="Top Categories by Votes" subtitle="Top 10 categories across all ideas">
        {categories === null ? (
          <Skeleton className="h-full w-full" />
        ) : categories.length === 0 ? (
          <EmptyState label="category" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 11 }}
                width={110}
                stroke="currentColor"
                opacity={0.6}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderColor: COLORS.green }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="votes" fill={COLORS.green} radius={[0, 4, 4, 0]} />
              <Bar dataKey="ideas" fill={COLORS.gold} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* AI usage */}
      <ChartCard title="AI Usage (last 7 days)" subtitle="Operations by skill / task type">
        {aiUsage === null ? (
          <Skeleton className="h-full w-full" />
        ) : aiUsage.length === 0 ? (
          <EmptyState label="AI usage" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aiUsage} margin={{ top: 4, right: 16, bottom: 40, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
              <XAxis
                dataKey="operation_type"
                tick={{ fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                stroke="currentColor"
                opacity={0.6}
              />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderColor: COLORS.green }}
                formatter={(value, name) => {
                  if (name === "count") return [value, "Calls"];
                  return [value, name];
                }}
              />
              <Bar dataKey="count" fill={COLORS.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

export default AdminCharts;
