"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { X, Lightbulb, ThumbsUp, CheckSquare } from "lucide-react";

export default function WelcomeBanner() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Show banner for new/logged-in users who haven't dismissed it
    if (session?.user) {
      const key = `welcome-dismissed-${session.user.email}`;
      if (!localStorage.getItem(key)) {
        setDismissed(false);
      }
    }
  }, [session]);

  const dismiss = () => {
    setDismissed(true);
    if (session?.user?.email) {
      localStorage.setItem(`welcome-dismissed-${session.user.email}`, "1");
    }
  };

  if (dismissed || !session) return null;

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <button
          onClick={dismiss}
          aria-label="Dismiss welcome banner"
          title="Dismiss"
          className="absolute top-3 end-3 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="mb-3 text-lg font-bold">Welcome to IranENovin! Here&apos;s how to get started:</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">1. Browse Ideas</p>
              <p className="text-xs text-muted-foreground">Explore 300+ community ideas from Iranians worldwide</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <ThumbsUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">2. Vote &amp; Comment</p>
              <p className="text-xs text-muted-foreground">Support ideas you believe in and join the discussion</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CheckSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">3. Claim a Task</p>
              <p className="text-xs text-muted-foreground">Pick a task that matches your skills and contribute</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button asChild size="sm" className="bg-primary text-white">
            <Link href="/projects">Browse Projects</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/submit">Submit an Idea</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
