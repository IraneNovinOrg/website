"use client";

import {
  MessageCircle,
  CheckCircle2,
  FileText,
  LinkIcon,
  Users,
  Zap,
} from "lucide-react";
import { type ActivityEntry, timeAgo } from "../types";

interface ActivityTabProps {
  activityLog: ActivityEntry[];
  t: (key: string) => string;
}

export default function ActivityTab({ activityLog, t }: ActivityTabProps) {
  const activities = activityLog || [];

  const eventTypeIcon = (eventType: string) => {
    if (eventType.includes("task")) return <CheckCircle2 className="h-4 w-4" />;
    if (eventType.includes("comment") || eventType.includes("discussion")) return <MessageCircle className="h-4 w-4" />;
    if (eventType.includes("content") || eventType.includes("doc")) return <FileText className="h-4 w-4" />;
    if (eventType.includes("resource")) return <LinkIcon className="h-4 w-4" />;
    if (eventType.includes("join") || eventType.includes("help")) return <Users className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
        <Zap className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p>{t("noActivity")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((entry, idx) => (
        <div key={entry.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {eventTypeIcon(entry.event_type)}
            </div>
            {idx < activities.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="pb-6">
            <p className="text-sm">
              <span className="font-medium">{entry.actor_name || "System"}</span>{" "}
              <span className="text-muted-foreground">{entry.event_type.replace(/_/g, " ")}</span>
            </p>
            {entry.details && <p className="mt-0.5 text-xs text-muted-foreground">{entry.details}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
