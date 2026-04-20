import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db/index";

/**
 * App-router sitemap. Emits canonical URLs for both locales plus all active
 * projects and recent ideas, so search engines can crawl them efficiently.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com").replace(/\/$/, "");
  const now = new Date();

  const staticPaths = ["", "ideas", "projects", "members", "submit", "join"];
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of ["en", "fa"] as const) {
    for (const p of staticPaths) {
      entries.push({
        url: `${base}/${locale}${p ? `/${p}` : ""}`,
        lastModified: now,
        changeFrequency: p === "" ? "daily" : "weekly",
        priority: p === "" ? 1.0 : 0.7,
        alternates: {
          languages: {
            en: `${base}/en${p ? `/${p}` : ""}`,
            fa: `${base}/fa${p ? `/${p}` : ""}`,
          },
        },
      });
    }
  }

  try {
    const db = getDb();
    // Projects + recent ideas — cap to avoid unwieldy sitemaps on busy days.
    const rows = db
      .prepare(
        `SELECT id, updated_at, project_status
         FROM ideas
         WHERE project_status IS NOT NULL
            OR github_vote_count >= 3
         ORDER BY updated_at DESC
         LIMIT 2000`
      )
      .all() as Array<{ id: string; updated_at: string | null; project_status: string | null }>;

    for (const r of rows) {
      const last = r.updated_at ? new Date(r.updated_at) : now;
      const isActive =
        r.project_status === "active" || r.project_status === "needs-contributors";
      const path = isActive ? "projects" : "ideas";
      for (const locale of ["en", "fa"] as const) {
        entries.push({
          url: `${base}/${locale}/${path}/${r.id}`,
          lastModified: last,
          changeFrequency: "weekly",
          priority: isActive ? 0.8 : 0.5,
        });
      }
    }
  } catch {
    // DB unreachable at build time — still return the static entries.
  }

  return entries;
}
