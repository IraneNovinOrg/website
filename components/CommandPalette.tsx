"use client";

import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { useRouter, usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { Search, Lightbulb, FolderOpen, Users, Plus, Globe } from "lucide-react";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import {
  useCommandPalette,
  toggleCommandPalette,
  closeCommandPalette,
} from "@/lib/workspace/paletteStore";

interface IdeaResult {
  id: string;
  title: string;
  category: string;
  voteCount: number;
}

const ITEM_BASE =
  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors " +
  "hover:bg-iran-green/8 aria-selected:bg-iran-green/15 aria-selected:text-iran-deep-green " +
  "dark:aria-selected:text-iran-bright-green";

const GROUP_CLASS =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 " +
  "[&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:text-[11px] " +
  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider " +
  "[&_[cmdk-group-heading]]:text-iran-gold";

export default function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IdeaResult[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  // Listen for Cmd+K / Ctrl+K  (uses imperative store helpers — no stale closures)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === "Escape") closeCommandPalette();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, []);

  // Search ideas when typing
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ideas?search=${encodeURIComponent(search)}&limit=5`
        );
        const data = await res.json();
        setResults(data.ideas || []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-iran-green/20 bg-white shadow-iran-green-lg dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold gradient top border */}
        <div
          aria-hidden="true"
          className="h-[2px] w-full bg-gradient-to-r from-transparent via-iran-gold/60 to-transparent"
        />
        <Command className="overflow-hidden rounded-b-xl">
          <div className="flex items-center gap-3 border-b border-iran-green/15 px-4 py-2">
            <LionSunLogo size="sm" />
            <div className="relative flex flex-1 items-center">
              <Search className="absolute start-0 h-4 w-4 shrink-0 text-iran-green/70" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search ideas, projects, or type a command..."
                className="flex-1 rounded-lg border border-iran-green/30 bg-transparent py-2 ps-7 pe-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-iran-green focus:ring-2 focus:ring-iran-green/40"
                autoFocus
              />
            </div>
            <kbd className="rounded border border-iran-gold/40 bg-iran-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-iran-gold">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[320px] overflow-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className={GROUP_CLASS}>
              <Command.Item
                onSelect={() => {
                  router.push("/submit");
                  setOpen(false);
                }}
                className={ITEM_BASE}
              >
                <Plus className="h-4 w-4 text-iran-green" /> Submit an Idea
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/projects");
                  setOpen(false);
                }}
                className={ITEM_BASE}
              >
                <FolderOpen className="h-4 w-4 text-iran-green" /> Browse Projects
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/members");
                  setOpen(false);
                }}
                className={ITEM_BASE}
              >
                <Users className="h-4 w-4 text-iran-green" /> View Members
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.replace(pathname, {
                    locale: locale === "en" ? "fa" : "en",
                  });
                  setOpen(false);
                }}
                className={ITEM_BASE}
              >
                <Globe className="h-4 w-4 text-iran-gold" /> Switch Language (
                {locale === "en" ? "\u0641\u0627\u0631\u0633\u06CC" : "English"})
              </Command.Item>
            </Command.Group>

            {/* Search Results */}
            {results.length > 0 && (
              <Command.Group heading="Ideas" className={GROUP_CLASS}>
                {results.map((idea) => (
                  <Command.Item
                    key={idea.id}
                    onSelect={() => {
                      router.push(`/projects/${idea.id}`);
                      setOpen(false);
                    }}
                    className={ITEM_BASE}
                  >
                    <Lightbulb className="h-4 w-4 shrink-0 text-iran-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{idea.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {idea.category} ·{" "}
                        <span className="text-iran-green">
                          {idea.voteCount} votes
                        </span>
                      </p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-iran-green/15 bg-iran-green/[0.03] px-4 py-2 text-[11px] text-muted-foreground">
            <span>
              Navigate with{" "}
              <kbd className="rounded border border-border px-1 text-iran-green">
                ↑↓
              </kbd>{" "}
              · Select with{" "}
              <kbd className="rounded border border-border px-1 text-iran-green">
                ↵
              </kbd>
            </span>
            <span className="text-iran-gold">IranENovin</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
