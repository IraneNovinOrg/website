"use client";

import {
  User,
  Users,
  Crown,
  Shield,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  type Any,
  type ProjectWorkspaceProps,
  timeAgo,
} from "../types";

interface ContributorsTabProps {
  idea: Any;
  contributors: ProjectWorkspaceProps["contributors"];
  helpOffers: Any[];
  projectLeads: string[];
  isAdmin: boolean;
  /** True if current user is a platform admin or a lead on this project. */
  canManage?: boolean;
  ideaId: string;
  t: (key: string) => string;
  refresh: () => void;
}

export default function ContributorsTab({
  idea, contributors, helpOffers, projectLeads, isAdmin, canManage, ideaId, t, refresh,
}: ContributorsTabProps) {
  const effectiveCanManage = isAdmin || !!canManage;
  type MemberRole = "owner" | "lead" | "contributor";
  type MemberEntry = { name: string; login?: string; avatar?: string; role: MemberRole; joined: string };

  const membersMap = new Map<string, MemberEntry>();

  if (idea.author_login) {
    membersMap.set(idea.author_login, { name: idea.author_login, login: idea.author_login, avatar: idea.author_avatar, role: "owner", joined: idea.created_at || "" });
  }

  contributors.commenters.forEach((c) => {
    const key = c.login || c.name || "";
    if (key && !membersMap.has(key)) {
      membersMap.set(key, { name: key, login: c.login, avatar: c.avatar, role: projectLeads.includes(key) ? "lead" : "contributor", joined: "" });
    }
  });

  contributors.taskClaimers.forEach((c) => {
    const key = c.name || "";
    if (key && !membersMap.has(key)) {
      membersMap.set(key, { name: key, login: key, role: projectLeads.includes(key) ? "lead" : "contributor", joined: "" });
    }
  });

  contributors.submitters.forEach((c) => {
    const key = c.name || "";
    if (key && !membersMap.has(key)) {
      membersMap.set(key, { name: key, login: key, role: projectLeads.includes(key) ? "lead" : "contributor", joined: "" });
    }
  });

  contributors.helpOffers.forEach((c) => {
    const key = c.name || "";
    if (key && !membersMap.has(key)) {
      membersMap.set(key, { name: key, login: key, role: projectLeads.includes(key) ? "lead" : "contributor", joined: "" });
    }
  });

  helpOffers.forEach((h: Any) => {
    const key = h.name || "";
    if (key && membersMap.has(key)) {
      const existing = membersMap.get(key);
      if (existing && !existing.joined) existing.joined = h.created_at || "";
    }
  });

  projectLeads.forEach((leadKey: string) => {
    if (!membersMap.has(leadKey)) {
      membersMap.set(leadKey, { name: leadKey, login: leadKey, role: "lead", joined: "" });
    }
  });

  const members = Array.from(membersMap.values());
  const roleOrder: Record<MemberRole, number> = { owner: 0, lead: 1, contributor: 2 };
  members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  const handleMakeLead = async (memberKey: string) => {
    const newLeads = [...projectLeads, memberKey];
    const res = await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectLeads: newLeads }) });
    if (res.ok) { toast.success(`${memberKey} is now a project lead`); refresh(); }
    else { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to update leads"); }
  };

  const handleRemoveLead = async (memberKey: string) => {
    const newLeads = projectLeads.filter((l: string) => l !== memberKey);
    const res = await fetch(`/api/projects/${ideaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectLeads: newLeads }) });
    if (res.ok) { toast.success(`${memberKey} removed from project leads`); refresh(); }
    else { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to update leads"); }
  };

  const handleRemoveMember = async (memberKey: string) => {
    if (!confirm(`Remove ${memberKey} from this project?`)) return;
    const res = await fetch(`/api/projects/${ideaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeContributor: memberKey }),
    });
    if (res.ok) { toast.success(`${memberKey} removed from project`); refresh(); }
    else { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to remove member"); }
  };

  const roleBadge = (role: MemberRole) => {
    switch (role) {
      case "owner":
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 dark:text-amber-300"><Crown className="h-3 w-3" /> Idea Owner</Badge>;
      case "lead":
        return <Badge variant="outline" className="gap-1 border-blue-500 text-blue-700 dark:text-blue-300"><Shield className="h-3 w-3" /> Project Lead</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><User className="h-3 w-3" /> {t("contributor") || "Contributor"}</Badge>;
    }
  };

  if (members.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p>{t("noMembers")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border p-3 sm:p-4">
          <Avatar className="h-10 w-10 shrink-0">
            {member.avatar && <AvatarImage src={member.avatar} />}
            <AvatarFallback>{(member.name || "?")[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{member.name}</p>
            {member.joined && <p className="text-xs text-muted-foreground">{t("joined")} {timeAgo(member.joined)}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {roleBadge(member.role)}
            {isAdmin && member.role === "contributor" && (
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400" onClick={() => handleMakeLead(member.login || member.name)}>
                <Shield className="me-1 h-3 w-3" /> Make Lead
              </Button>
            )}
            {isAdmin && member.role === "lead" && (
              <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-800 dark:text-red-400" onClick={() => handleRemoveLead(member.login || member.name)}>
                <X className="me-1 h-3 w-3" /> Remove Lead
              </Button>
            )}
            {effectiveCanManage && member.role === "contributor" && (
              <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-800 dark:text-red-400" onClick={() => handleRemoveMember(member.login || member.name)}>
                <X className="me-1 h-3 w-3" /> Remove
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
