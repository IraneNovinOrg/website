"use client";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LionSunLogo } from "@/components/brand/LionSunLogo";
import TelegramLoginButton from "@/components/auth/TelegramLoginButton";
import { setRememberPreference } from "@/lib/auth/remember";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  action?: string;
}

export default function AuthModal({ open, onClose, action }: AuthModalProps) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // "Keep me signed in" — on = 30d persistent session, off = 1d.
  // Default on: personal-device users are the majority.
  const [rememberMe, setRememberMe] = useState(true);

  // Set the short-lived preference cookie before handing off to the auth
  // provider. The NextAuth jwt callback reads this cookie on the return
  // leg and encodes the TTL into the token.
  const applyRememberPreference = () => setRememberPreference(rememberMe);

  const handleGitHub = () => {
    applyRememberPreference();
    signIn("github", { callbackUrl: window.location.href });
  };

  const handleGoogle = () => {
    applyRememberPreference();
    signIn("google", { callbackUrl: window.location.href });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "register") {
      // Register first, then sign in
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error);
          setLoading(false);
          return;
        }
      } catch {
        setError("Failed to create account");
        setLoading(false);
        return;
      }
    }

    applyRememberPreference();
    // Sign in with credentials
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        mode === "login"
          ? "Invalid email or password"
          : "Account created but login failed. Try signing in."
      );
    } else {
      // Stay on the same page — just close the modal
      // SessionProvider will pick up the new session automatically
      onClose();
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex justify-center">
            <LionSunLogo size="lg" />
          </div>
          <DialogTitle className="text-center font-display text-xl text-gradient-iran">
            {action ? t("signInReason", { action }) : t("signIn")}
          </DialogTitle>
          <div className="divider-ornament mx-auto max-w-[180px]" />
        </DialogHeader>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={handleGitHub}
            className="w-full bg-gray-900 text-white hover:bg-gray-800"
            size="lg"
          >
            <svg className="me-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {t("continueGithub")}
          </Button>

          <Button
            onClick={handleGoogle}
            variant="outline"
            size="lg"
            className="w-full border-iran-gold/40 text-iran-deep-green hover:bg-iran-gold/10 dark:text-iran-bright-green"
          >
            <svg className="me-2 h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("continueGoogle")}
          </Button>

          {/* Telegram deep-link sign-in. Only mounts when
              NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is set. */}
          <TelegramLoginButton
            onSuccess={onClose}
            // Set the remember cookie lazily — TelegramLoginButton calls
            // signIn("telegram") internally once the bot confirms.
            onBeforeSignIn={applyRememberPreference}
          />
        </div>

        {/* Keep-me-signed-in preference — shared across every sign-in method
            above *and* the email form below. Checked (default) = 30 days,
            unchecked = 1 day. */}
        <label className="mt-2 flex items-center gap-2 rounded-md border border-iran-green/15 bg-iran-green/5 px-3 py-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 accent-iran-green"
          />
          <span>
            Keep me signed in on this device
            <span className="ms-1 text-xs text-muted-foreground">
              ({rememberMe ? "30 days" : "1 day"})
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3 py-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {t("orEmail")}
          </span>
          <Separator className="flex-1" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <Label>{t("nameField")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
          )}
          <div>
            <Label>{t("emailField")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
            />
          </div>
          <div>
            <Label>{t("passwordField")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gradient-iran text-white shadow-iran-green hover:shadow-iran-green-lg"
            size="lg"
          >
            {loading
              ? "..."
              : mode === "login"
                ? t("emailSignIn")
                : t("emailSignUp")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              {t("noAccount")}{" "}
              <button
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className="font-medium text-iran-gold hover:text-iran-saffron hover:underline"
              >
                {t("createAccount")}
              </button>
            </>
          ) : (
            <>
              {t("haveAccount")}{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="font-medium text-iran-gold hover:text-iran-saffron hover:underline"
              >
                {t("signInInstead")}
              </button>
            </>
          )}
        </p>

        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
      </DialogContent>
    </Dialog>
  );
}
