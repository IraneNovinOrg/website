"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import IdeaCard from "./IdeaCard";
import CategoryFilter from "./CategoryFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import type { UnifiedIdea } from "@/types";

type SortOption = "top" | "new" | "trending" | "comments";
type SourceOption = "all" | "iranenovin" | "iranazadabad";
type ProjectFilter = "all" | "active";

const ITEMS_PER_PAGE = 20;

export default function IdeasFeed() {
  const t = useTranslations("ideas");

  const [ideas, setIdeas] = useState<UnifiedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("top");
  const [source, setSource] = useState<SourceOption>("all");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Search state: `searchInput` = live value, `search` = debounced value used in fetch.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchPending = searchInput.trim() !== search.trim();

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  // Debounce the search input (300ms) before kicking off a new fetch.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const fetchIdeas = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          sort,
          source,
          page: pageNum.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        });
        if (category !== "all") params.set("category", category);
        if (projectFilter === "active") params.set("projectFilter", "active");
        if (search) params.set("search", search);

        const res = await fetch(`/api/ideas?${params}`);
        const data = await res.json();

        setIdeas(data.ideas);
        setTotal(data.total ?? 0);
      } catch (e) {
        console.error(e);
        toast.error("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [category, sort, source, projectFilter, search]
  );

  // Reset to page 1 when filters change (including debounced search)
  useEffect(() => {
    setPage(1);
    fetchIdeas(1);
  }, [fetchIdeas]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    fetchIdeas(p);
    const el = document.getElementById("ideas-feed");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Build the visible page numbers with ellipses
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [1];
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: "top", label: t("sortTop") },
    { key: "new", label: t("sortNew") },
    { key: "comments", label: t("sortComments") },
    { key: "trending", label: t("sortTrending") },
  ];

  const sourceOptions: { key: SourceOption; label: string }[] = [
    { key: "all", label: t("sourceAll") },
    { key: "iranenovin", label: t("sourceIranENovin") },
    { key: "iranazadabad", label: t("sourceIranAzadAbad") },
  ];

  return (
    <div id="ideas-feed" className="space-y-6">
      {/* Search input */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="ps-9 pe-10"
        />
        <div className="pointer-events-none absolute end-3 top-1/2 flex -translate-y-1/2 items-center">
          {searchPending || (loading && search) ? (
            <Loader2 className="h-4 w-4 animate-spin text-iran-deep-green/70 dark:text-iran-bright-green/80" />
          ) : searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="pointer-events-auto rounded-full p-1 text-muted-foreground transition hover:bg-iran-green/10 hover:text-iran-deep-green dark:hover:text-iran-bright-green"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Category filter */}
      <CategoryFilter selected={category} onChange={setCategory} />

      {/* Sort and source controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Sort buttons */}
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                sort === opt.key
                  ? "bg-iran-green text-white shadow-iran-green"
                  : "text-iran-deep-green/80 hover:bg-iran-green/10 hover:text-iran-deep-green dark:text-iran-bright-green/80 dark:hover:bg-iran-green/20 dark:hover:text-iran-bright-green"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Source filter + Active Projects toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {sourceOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSource(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                source === opt.key
                  ? "bg-iran-gold/20 text-iran-deep-green border border-iran-gold/40 dark:bg-iran-gold/25 dark:text-iran-gold"
                  : "text-muted-foreground hover:bg-iran-gold/10 hover:text-iran-deep-green dark:hover:text-iran-gold"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-iran-green/20" />
          <button
            onClick={() =>
              setProjectFilter((prev) => (prev === "all" ? "active" : "all"))
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              projectFilter === "active"
                ? "bg-iran-green text-white shadow-iran-green"
                : "text-muted-foreground hover:bg-iran-green/10 hover:text-iran-deep-green dark:hover:text-iran-bright-green"
            }`}
          >
            {t("filterActiveProjects")}
          </button>
        </div>
      </div>

      {/* Total count */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          {t("totalIdeas", { count: total })}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-iran-green/10 bg-card p-5"
            >
              <Skeleton className="mb-3 h-5 w-20" />
              <Skeleton className="mb-2 h-6 w-3/4" />
              <Skeleton className="mb-4 h-4 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LionSunLogo size="lg" className="mb-4 opacity-80" />
          <p className="text-lg font-semibold text-gradient-iran">
            {t("noIdeas")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("beFirst")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => goToPage(page - 1)}
                className="border-iran-green/30 text-iran-deep-green hover:bg-iran-gold/10 hover:text-iran-deep-green hover:border-iran-gold/40 dark:text-iran-bright-green dark:hover:text-iran-gold"
              >
                {t("paginationPrev")}
              </Button>

              {getPageNumbers().map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className={
                      p === page
                        ? "min-w-[36px] bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green"
                        : "min-w-[36px] border-iran-green/30 text-iran-deep-green hover:bg-iran-gold/10 hover:border-iran-gold/40 hover:text-iran-deep-green dark:text-iran-bright-green dark:hover:text-iran-gold"
                    }
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => goToPage(page + 1)}
                className="border-iran-green/30 text-iran-deep-green hover:bg-iran-gold/10 hover:text-iran-deep-green hover:border-iran-gold/40 dark:text-iran-bright-green dark:hover:text-iran-gold"
              >
                {t("paginationNext")}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
