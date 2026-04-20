"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console for local debugging; real reporting goes
    // through the structured logger on the server side.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <LionSunLogo size="lg" className="opacity-90" />
      <div className="flex items-center gap-2 text-iran-red">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm font-medium uppercase tracking-wide">
          Something went wrong
        </span>
      </div>
      <h1 className="display-text text-3xl md:text-4xl">
        <span className="text-gradient-iran">We hit a snag.</span>
      </h1>
      <p className="text-base text-muted-foreground">
        An unexpected error occurred on this page. You can try again, go
        home, or report this so we can look into it.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference:{" "}
          <code className="rounded bg-iran-green/10 px-1.5 py-0.5 font-mono">
            {error.digest}
          </code>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={reset}
          className="bg-iran-green hover:bg-iran-deep-green"
        >
          <RefreshCw className="me-1.5 h-4 w-4" /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <Home className="me-1.5 h-4 w-4" /> Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
