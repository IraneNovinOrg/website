"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { timeAgo } from "../types";

interface ChatMessage {
  id: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

interface ChatTabProps {
  ideaId: string;
  session: unknown;
  t: (key: string) => string;
  onAuthOpen?: () => void;
}

export default function ChatTab({ ideaId, session, t, onAuthOpen }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${ideaId}/chat`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    loadMessages();
    // Poll every 10s for new messages (lightweight — only this tab)
    const iv = setInterval(loadMessages, 10_000);
    return () => clearInterval(iv);
  }, [loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (!session) { onAuthOpen?.(); return; }
    const text = input.trim();
    setInput("");
    setSending(true);
    // Optimistic append
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      author_id: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      author_name: (session as any)?.user?.name || "You",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      author_avatar: (session as any)?.user?.image || null,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch(`/api/projects/${ideaId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to send");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      } else {
        // Reload to get server-canonical message list
        loadMessages();
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      const res = await fetch(`/api/projects/${ideaId}/chat`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to delete");
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      toast.error("Network error");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUserName: string | null = (session as any)?.user?.name || (session as any)?.user?.email || null;

  return (
    <div className="flex h-[calc(100vh-20rem)] min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-base font-bold">{t("chat") || "Project Chat"}</h3>
        <p className="text-xs text-muted-foreground">
          Chat with everyone on this project. Messages are public to project members.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">Loading messages...</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.author_name && currentUserName && m.author_name === currentUserName;
          return (
            <div key={m.id} className={`group flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
              {!isMine && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={m.author_avatar || ""} />
                  <AvatarFallback className="text-xs">
                    {(m.author_name?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                isMine
                  ? "bg-iran-green text-white"
                  : "bg-muted text-foreground"
              }`}>
                {!isMine && (
                  <p className="mb-0.5 text-xs font-semibold opacity-80">
                    {m.author_name || "Anonymous"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${isMine ? "text-white/70" : "text-muted-foreground"}`}>
                  <span>{timeAgo(m.created_at)}</span>
                  {isMine && !m.id.startsWith("tmp-") && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="opacity-0 transition-opacity hover:text-iran-red group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              {isMine && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={m.author_avatar || ""} />
                  <AvatarFallback className="text-xs">
                    {(m.author_name?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-3">
        {session ? (
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Write a message..."
              rows={2}
              className="resize-none text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              size="icon"
              className="shrink-0 bg-iran-green text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Sign in to send messages.
          </p>
        )}
      </div>
    </div>
  );
}
