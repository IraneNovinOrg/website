"use client";

import useSWR from "swr";
import { useCallback } from "react";
import type { Notification } from "@/lib/db/notifications";

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const fetcher = async (url: string): Promise<NotificationsResponse> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return (await r.json()) as NotificationsResponse;
};

/**
 * SWR hook for the notification bell. Polls every 30 seconds by default so
 * unread counts stay fresh without needing websockets.
 */
export function useNotifications(options: {
  limit?: number;
  onlyUnread?: boolean;
  refreshInterval?: number;
} = {}) {
  const limit = options.limit ?? 20;
  const unread = options.onlyUnread ?? false;
  // 2-minute poll (was 30s). The bell optimistically updates on markRead /
  // markAllRead via mutate(), and user actions that generate notifications
  // already mutate cache in-place, so a faster poll mostly just burns DB
  // reads. Callers can still override when they actually need near-real-time.
  const refreshInterval = options.refreshInterval ?? 120_000;

  const key = `/api/workspace/notifications?limit=${limit}${
    unread ? "&unread=true" : ""
  }`;

  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    key,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
    }
  );

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic update: strip from unread count, stamp read_at
      await mutate(
        (prev) => {
          if (!prev) return prev;
          const now = new Date().toISOString();
          const next = prev.notifications.map((n) =>
            n.id === id ? { ...n, readAt: now } : n
          );
          return {
            notifications: next,
            unreadCount: Math.max(0, prev.unreadCount - 1),
          };
        },
        { revalidate: false }
      );
      try {
        await fetch("/api/workspace/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "markRead" }),
        });
      } finally {
        await mutate();
      }
    },
    [mutate]
  );

  const markAllRead = useCallback(async () => {
    await mutate(
      (prev) => {
        if (!prev) return prev;
        const now = new Date().toISOString();
        return {
          notifications: prev.notifications.map((n) => ({
            ...n,
            readAt: n.readAt ?? now,
          })),
          unreadCount: 0,
        };
      },
      { revalidate: false }
    );
    try {
      await fetch("/api/workspace/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
    } finally {
      await mutate();
    }
  }, [mutate]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markRead,
    markAllRead,
    mutate,
  };
}
