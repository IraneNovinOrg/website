"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  kind: "project" | "task" | "doc" | "user";
}

export interface SearchResponse {
  projects: SearchResult[];
  tasks: SearchResult[];
  docs: SearchResult[];
  users: SearchResult[];
}

const EMPTY: SearchResponse = {
  projects: [],
  tasks: [],
  docs: [],
  users: [],
};

const fetcher = async (url: string): Promise<SearchResponse> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return (await r.json()) as SearchResponse;
};

/**
 * Debounced global search hook powering the command palette.
 *
 *  - Trims the query and skips SWR entirely for <2 char queries to avoid
 *    thrashing the DB with single-character inputs.
 *  - Debounces by 200ms (`debounceMs`).
 *  - Caches responses by query so navigating back to a previous search is
 *    instant.
 */
export function useGlobalSearch(query: string, limit = 20, debounceMs = 200) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(h);
  }, [query, debounceMs]);

  const trimmed = debounced.trim();
  const shouldFetch = trimmed.length >= 2;
  const key = shouldFetch
    ? `/api/workspace/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
    : null;

  const { data, error, isLoading } = useSWR<SearchResponse>(key, fetcher, {
    dedupingInterval: 2000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  return {
    results: data ?? EMPTY,
    isLoading,
    error,
    debouncedQuery: trimmed,
    hasQuery: shouldFetch,
  };
}
