"use client";

import { useEffect, useRef } from "react";

interface GiscusProps {
  repo: string;          // "IranAzadAbad/ideas" or "IraneNovinOrg/ideas"
  repoId: string;        // GitHub repo ID
  category: string;      // Discussion category name
  categoryId: string;    // Discussion category ID
  discussionNumber: number; // The discussion number (e.g., 51)
  theme?: string;        // "light" or "dark"
}

export default function GiscusDiscussion({
  repo,
  repoId,
  category,
  categoryId,
  discussionNumber,
  theme = "light",
}: GiscusProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Clear previous giscus instance
    el.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", repo);
    script.setAttribute("data-repo-id", repoId);
    script.setAttribute("data-category", category);
    script.setAttribute("data-category-id", categoryId);
    script.setAttribute("data-mapping", "number");
    script.setAttribute("data-term", String(discussionNumber));
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", theme);
    script.setAttribute("data-lang", "en");
    script.setAttribute("data-loading", "lazy");
    script.crossOrigin = "anonymous";
    script.async = true;

    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [repo, repoId, category, categoryId, discussionNumber, theme]);

  return <div ref={ref} className="giscus-container" />;
}
