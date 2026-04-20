"use client";

/**
 * Telegram deep-link sign-in. No phone number, no BotFather domain setup.
 *
 * Flow:
 *   1. POST /api/auth/telegram/start → { token, deepLink }
 *   2. Show the user a QR + "Open Telegram" button
 *   3. Poll /api/auth/telegram/poll every 2s until status="confirmed"
 *   4. Call signIn("telegram", { token }) to finalize the session
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, CheckCircle2, RotateCcw } from "lucide-react";

type FlowState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; token: string; deepLink: string; expiresAt: string; previewName: string | null }
  | { kind: "confirmed"; token: string; previewName: string | null }
  | { kind: "signing-in"; token: string }
  | { kind: "error"; message: string };

export default function TelegramLoginButton({
  onSuccess,
  redirectTo,
  onBeforeSignIn,
}: {
  onSuccess?: () => void;
  redirectTo?: string;
  /**
   * Called right before `signIn("telegram", …)` fires. Lets the parent
   * (e.g. AuthModal) stamp a "remember me" cookie so the server-side jwt
   * callback can read the user's session-length preference.
   */
  onBeforeSignIn?: () => void;
}) {
  const [state, setState] = useState<FlowState>({ kind: "idle" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => () => clearPoll(), []);

  const startSession = useCallback(async () => {
    clearPoll();
    setState({ kind: "starting" });
    try {
      const res = await fetch("/api/auth/telegram/start", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Could not start session (${res.status})`);
      }
      const { token, deepLink, expiresAt } = (await res.json()) as {
        token: string;
        deepLink: string;
        expiresAt: string;
      };
      setState({ kind: "waiting", token, deepLink, expiresAt, previewName: null });

      // Poll every 2s. Stop when confirmed / expired.
      pollTimer.current = setInterval(async () => {
        try {
          const poll = await fetch(
            `/api/auth/telegram/poll?token=${encodeURIComponent(token)}`,
            { cache: "no-store" }
          );
          if (!poll.ok) return;
          const data = (await poll.json()) as {
            status: "pending" | "confirmed" | "consumed" | "expired" | "not_found";
            previewName?: string | null;
          };

          if (data.status === "confirmed") {
            clearPoll();
            setState({
              kind: "confirmed",
              token,
              previewName: data.previewName || null,
            });
            // Finalize immediately — no extra click required.
            setState((prev) =>
              prev.kind === "confirmed" ? { kind: "signing-in", token: prev.token } : prev
            );
            // Give the parent a last chance to stamp the remember cookie.
            onBeforeSignIn?.();
            const res2 = await signIn("telegram", { token, redirect: false });
            if (res2?.ok) {
              toast.success("Signed in with Telegram");
              onSuccess?.();
              if (redirectTo) {
                window.location.href = redirectTo;
              } else {
                window.location.reload();
              }
            } else {
              setState({ kind: "error", message: "Could not finalize sign-in — please try again." });
            }
          } else if (data.status === "expired" || data.status === "not_found") {
            clearPoll();
            setState({ kind: "error", message: "That request expired. Tap Start again." });
          }
        } catch {
          /* transient — keep polling */
        }
      }, 2000);
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  }, [onSuccess, redirectTo, onBeforeSignIn]);

  if (state.kind === "idle") {
    return (
      <Button
        type="button"
        onClick={startSession}
        className="w-full bg-[#229ED9] text-white hover:bg-[#1f8ec5]"
        size="lg"
      >
        <MessageCircle className="me-2 h-5 w-5" />
        Continue with Telegram
      </Button>
    );
  }

  if (state.kind === "starting") {
    return (
      <Button type="button" disabled className="w-full bg-[#229ED9] text-white" size="lg">
        <Loader2 className="me-2 h-5 w-5 animate-spin" />
        Preparing…
      </Button>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-lg border border-iran-red/30 bg-iran-red/5 p-3 text-sm">
        <p className="text-iran-red">{state.message}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={startSession}
          className="mt-2"
        >
          <RotateCcw className="me-1.5 h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  // waiting / confirmed / signing-in — show the QR + deep link panel.
  const token = "token" in state ? state.token : "";
  const deepLink =
    state.kind === "waiting" ? state.deepLink : `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=login_${token}`;
  const previewName = "previewName" in state ? state.previewName : null;

  return (
    <div className="rounded-lg border border-[#229ED9]/30 bg-[#229ED9]/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#229ED9]">
        <MessageCircle className="h-4 w-4" />
        Sign in with Telegram
      </div>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <QRCodeSVG value={deepLink} size={140} level="M" includeMargin={false} />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-start">
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li>
              <span className="me-1 font-semibold text-foreground">1.</span>
              On your phone, open the{" "}
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#229ED9] underline underline-offset-2"
              >
                Telegram bot
              </a>{" "}
              — or scan the QR with your phone&apos;s camera.
            </li>
            <li>
              <span className="me-1 font-semibold text-foreground">2.</span>
              Tap <span className="font-medium">Start</span>, then{" "}
              <span className="font-medium">Yes, sign me in</span>.
            </li>
            <li>
              <span className="me-1 font-semibold text-foreground">3.</span>
              Come back here — you&apos;ll be signed in automatically.
            </li>
          </ol>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Button asChild size="sm" className="bg-[#229ED9] hover:bg-[#1f8ec5]">
              <a href={deepLink} target="_blank" rel="noopener noreferrer">
                Open Telegram
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={startSession}
              disabled={state.kind === "signing-in"}
            >
              <RotateCcw className="me-1 h-3.5 w-3.5" /> New link
            </Button>
          </div>

          <div
            className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {state.kind === "waiting" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for confirmation…
              </>
            )}
            {state.kind === "confirmed" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-iran-green" />
                Confirmed{previewName ? ` as ${previewName}` : ""} — finalising…
              </>
            )}
            {state.kind === "signing-in" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Signing you in…
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
