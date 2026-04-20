"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";

export default function AnonymousSuggestForm() {
  const t = useTranslations("anonymous");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/anonymous-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: body.slice(0, 60),
          body: body,
          email: email || undefined,
        }),
      });

      if (res.status === 429) {
        const msg = t("rateLimit");
        setError(msg);
        toast.error(msg);
        return;
      }

      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setSubmitted(true);
      setBody("");
      setName("");
      setEmail("");
    } catch (e) {
      console.error("Anonymous suggest failed:", e);
      const msg =
        (e as Error).message || "Failed to submit. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl bg-primary/5 p-8 text-center">
        <Lightbulb className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="text-lg font-medium text-primary">{t("success")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 p-8">
      <h3 className="mb-1 text-xl font-bold text-foreground">{t("title")}</h3>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          required
          rows={3}
          className="resize-none"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("nameOptional")}
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailOptional")}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between">
          <Button
            type="submit"
            disabled={submitting || !body.trim()}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {submitting ? "..." : t("submit")}
          </Button>
          <p className="text-xs text-muted-foreground">
            <Lightbulb className="me-1 inline h-3 w-3" />
            {t("hint")}
          </p>
        </div>
      </form>
    </div>
  );
}
