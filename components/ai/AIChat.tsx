"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import { Bot, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/ai";

interface Props {
  ideaId: string;
  ideaTitle: string;
  ideaBody: string;
}

export default function AIChat({ ideaId, ideaTitle, ideaBody }: Props) {
  const t = useTranslations("ai");
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/ai/chat?ideaId=${ideaId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.history || []))
      .catch(() => {});
  }, [ideaId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !session) return;
    setSending(true);

    const userMsg = input;
    setInput("");

    // Optimistic: show user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMsg,
        authorName: session.user?.name || "You",
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          ideaTitle,
          ideaBody,
          message: userMsg,
        }),
      });

      const data = await res.json();

      if (res.ok && data.history) {
        setMessages(data.history);
      } else {
        const errMsg = data.error || "AI assistant returned an error. Please try again.";
        console.error("AI chat error:", res.status, data);
        toast.error(errMsg);
        // Remove the optimistic user message since the AI failed
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error. Please check your connection and try again.");
      // Remove the optimistic user message
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-gray-900">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-4 text-start hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-bold">{t("chatTitle")}</span>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({messages.length} {t("messages")})
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          {/* Messages */}
          <div className="max-h-96 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("chatEmpty")}
              </p>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-4 flex gap-3 ${
                  msg.role === "user" ? "" : "bg-gray-50 dark:bg-gray-800 -mx-4 px-4 py-3 rounded-lg"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                ) : (
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-xs">
                      {(msg.authorName || "U")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  {msg.role === "user" && msg.authorName && (
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                      {msg.authorName}
                    </p>
                  )}
                  {msg.role === "assistant" ? (
                    <MarkdownRenderer content={msg.content} className="text-sm" />
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="mb-4 flex gap-3 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800">
                <Bot className="mt-0.5 h-6 w-6 shrink-0 animate-pulse text-primary" />
                <p className="text-sm text-muted-foreground">{t("thinking")}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {session ? (
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("chatPlaceholder")}
                  rows={2}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  size="icon"
                  className="shrink-0 bg-primary text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">
              {t("signInToChat")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
