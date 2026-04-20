"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import AuthModal from "@/components/auth/AuthModal";
import { toast } from "sonner";
import { Copy, Send, Share2, Users, Clock } from "lucide-react";

interface Invitation {
  id: string;
  type: string;
  recipient_name: string;
  recipient_contact: string;
  status: string;
  created_at: string;
}

export default function InvitePage() {
  const t = useTranslations("invite");
  const { data: session } = useSession();
  const [authOpen, setAuthOpen] = useState(false);

  // Invite form
  const [recipientName, setRecipientName] = useState("");
  const [contactType, setContactType] = useState<"email" | "telegram" | "link">("link");
  const [recipientContact, setRecipientContact] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ code: string; url: string } | null>(null);

  // History
  const [history, setHistory] = useState<Invitation[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/invite?history=true")
      .then((r) => r.json())
      .then((data) => setHistory(data.invitations || []))
      .catch((e) => console.error("Failed to load invite history:", e))
      .finally(() => setHistoryLoaded(true));
  }, [session]);

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-iran-gold text-white shadow-iran-gold-lg">
            <Users className="h-8 w-8" aria-hidden="true" />
          </span>
        </div>
        <h1 className="mb-3 text-3xl font-bold text-gradient-iran md:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
          {t("subtitle")}
        </p>
        <div className="mx-auto mb-8 grid max-w-lg gap-3 text-start">
          <div className="flex items-start gap-3 rounded-lg border border-iran-gold/20 bg-iran-gold/5 p-4">
            <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-iran-gold" aria-hidden="true" />
            <p className="text-sm text-foreground">{t("shareInvite")}</p>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-iran-green/20 bg-iran-green/5 p-4">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-iran-green" aria-hidden="true" />
            <p className="text-sm text-foreground">{t("growCommunity")}</p>
          </div>
        </div>
        <Button
          onClick={() => setAuthOpen(true)}
          className="h-12 rounded-full bg-iran-bright-green px-8 text-base font-semibold text-white shadow-iran-green-lg transition-all hover:bg-iran-green hover:shadow-iran-gold-lg"
        >
          {t("signInToInvite")}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">{t("signInFirst")}</p>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  const handleInvite = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct",
          recipientName,
          recipientContact: contactType !== "link" ? recipientContact : undefined,
          contactType,
          personalMessage,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setInviteResult(data);
      toast.success(t("inviteSent"));
      // Refresh history
      const histRes = await fetch("/api/invite?history=true");
      const histData = await histRes.json().catch(() => ({ invitations: [] }));
      setHistory(histData.invitations || []);
      setRecipientName("");
      setRecipientContact("");
      setPersonalMessage("");
    } catch (e) {
      console.error("Send invite failed:", e);
      toast.error((e as Error).message || "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://iranenovin.com";
  const referralLink = `${appUrl}/en/join?ref=${session.user?.id || ""}`;

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const acceptedCount = history.filter((h) => h.status === "accepted").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("subtitle")}</p>

      <div className="space-y-6">
        {/* Card 1: Invite someone */}
        <div className="rounded-xl border border-border bg-white p-6 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{t("inviteSomeone")}</h2>
          </div>

          <div className="space-y-3">
            <div>
              <Label>{t("theirName")}</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div>
              <Label>{t("howToReach")}</Label>
              <div className="mt-1 flex gap-2">
                {(["link", "email", "telegram"] as const).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setContactType(ct)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      contactType === ct
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {ct === "link" ? t("justLink") : ct === "email" ? t("viaEmail") : t("viaTelegram")}
                  </button>
                ))}
              </div>
            </div>

            {contactType === "email" && (
              <div>
                <Label>{t("email")}</Label>
                <Input
                  type="email"
                  value={recipientContact}
                  onChange={(e) => setRecipientContact(e.target.value)}
                  placeholder="their@email.com"
                />
              </div>
            )}

            {contactType === "telegram" && (
              <div>
                <Label>Telegram</Label>
                <Input
                  value={recipientContact}
                  onChange={(e) => setRecipientContact(e.target.value)}
                  placeholder="@username"
                />
              </div>
            )}

            <div>
              <Label>{t("personalMessage")}</Label>
              <Textarea
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                rows={2}
              />
            </div>

            <Button
              onClick={handleInvite}
              disabled={sending || !recipientName.trim()}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {sending ? "..." : t("sendInvite")}
            </Button>

            {inviteResult && (
              <div className="mt-3 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                <p className="mb-1 text-sm font-medium text-green-700 dark:text-green-300">
                  {t("inviteCreated")}
                </p>
                <div className="flex items-center gap-2">
                  <Input value={inviteResult.url} readOnly className="text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copyLink(inviteResult.url)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Share referral link */}
        <div className="rounded-xl border border-border bg-white p-6 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{t("shareNetwork")}</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{t("shareDesc")}</p>
          <div className="flex items-center gap-2">
            <Input value={referralLink} readOnly className="text-xs" />
            <Button variant="outline" onClick={() => copyLink(referralLink)}>
              <Copy className="me-1 h-4 w-4" /> {t("copy")}
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join IranENovin — build Iran's future together!")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join IranENovin — build Iran's future together!")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                X / Twitter
              </a>
            </Button>
          </div>
        </div>

        {/* Card 3: History */}
        <div className="rounded-xl border border-border bg-white p-6 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{t("yourInvitations")}</h2>
            </div>
            {history.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {history.length} {t("sent")} · {acceptedCount} {t("joined")}
              </p>
            )}
          </div>

          {!historyLoaded ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noInvitations")}</p>
          ) : (
            <div className="space-y-2">
              {history.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.recipient_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.type} · {inv.recipient_contact || "link only"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        inv.status === "accepted"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }
                    >
                      {inv.status}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(inv.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
