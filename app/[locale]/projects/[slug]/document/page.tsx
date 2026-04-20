"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface DocMeta {
  lastEditedBy?: string;
  lastEditedAt?: string;
  version?: number;
}

interface ProjectPayload {
  idea?: { title?: string };
  projectContent?: string;
  projectDocMeta?: DocMeta;
  googleDocUrl?: string | null;
}

/**
 * Standalone document viewer route.
 * Clean URL: /projects/<slug>/document — good for sharing.
 * Read-only view — editing happens on the main project page's Document tab.
 */
export default function ProjectDocumentPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<ProjectPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data?.idea) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/projects" className="mt-4 inline-block text-sm text-iran-green hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const content = data.projectContent || "";
  const meta = data.projectDocMeta || {};
  const googleUrl = data.googleDocUrl;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/projects/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-iran-green"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyShareLink}>
            <Copy className="me-1 h-4 w-4" /> Share
          </Button>
          {googleUrl && (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Google Doc <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{data.idea.title}</h1>
        {(meta.lastEditedBy || meta.lastEditedAt) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {meta.lastEditedBy && <>Last edited by {meta.lastEditedBy}</>}
            {meta.lastEditedAt && <> · {new Date(meta.lastEditedAt).toLocaleString()}</>}
            {meta.version && <> · v{meta.version}</>}
          </p>
        )}
      </div>

      {content ? (
        <article className="prose prose-sm max-w-none rounded-xl border border-border bg-card p-8 dark:prose-invert">
          <MarkdownRenderer content={content} />
        </article>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center text-muted-foreground">
          No document has been generated for this project yet.
        </div>
      )}
    </div>
  );
}
