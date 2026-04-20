"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { LayoutGrid, MessageSquare, ListTodo, FileText, FolderOpen, Users, Activity, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { ProjectWorkspaceProps } from "./types";

const VALID_TABS = [
  "overview",
  "discussion",
  "tasks",
  "document",
  "files",
  "contributors",
  "chat",
  "activity",
] as const;
type ValidTab = (typeof VALID_TABS)[number];

function isValidTab(value: string | null): value is ValidTab {
  return !!value && (VALID_TABS as readonly string[]).includes(value);
}

const OverviewTab = dynamic(() => import("./tabs/OverviewTab"));
const DiscussionTab = dynamic(() => import("./tabs/DiscussionTab"));
const TasksTab = dynamic(() => import("./tabs/TasksTab"));
const DocumentTab = dynamic(() => import("./tabs/DocumentTab"));
const FilesTab = dynamic(() => import("./tabs/FilesTab"));
const ContributorsTab = dynamic(() => import("./tabs/ContributorsTab"));
const ActivityTab = dynamic(() => import("./tabs/ActivityTab"));
const ChatTab = dynamic(() => import("./tabs/ChatTab"));

export type { ProjectWorkspaceProps };

export default function ProjectWorkspace(props: ProjectWorkspaceProps) {
  const {
    idea,
    comments,
    tasks,
    analysis,
    contributors,
    projectContent,
    projectDocMeta,
    projectDocs,
    projectResources,
    projectLeads,
    activityLog,
    voteReasons,
    teaserImageUrl,
    googleDocUrl,
    session,
    isAdmin,
    canManage,
    ideaId,
    locale,
    t,
    tCommon,
    refresh,
    onAuthOpen,
  } = props;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const activeTab: ValidTab = isValidTab(tabParam) ? tabParam : "overview";

  const handleTabChange = useCallback(
    (newTab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", newTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setActiveTab = handleTabChange;

  const allContributorNames = [
    ...contributors.commenters.map((c) => c.login || c.name),
    ...contributors.taskClaimers.map((c) => c.name),
    ...contributors.submitters.map((c) => c.name),
    ...contributors.helpOffers.map((c) => c.name),
  ].filter(Boolean);
  const uniqueContributors = Array.from(new Set(allContributorNames));

  // Sidebar navigation items — defined once, rendered in both desktop sidebar and mobile bar
  const navItems: Array<{ key: ValidTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number | string }> = [
    { key: "overview", label: t("overview"), icon: LayoutGrid },
    { key: "discussion", label: t("discussion"), icon: MessageSquare, badge: comments.length || undefined },
    { key: "tasks", label: t("tasks"), icon: ListTodo, badge: tasks.length || undefined },
    { key: "document", label: t("document"), icon: FileText },
    { key: "files", label: t("filesAndResources") || "Files", icon: FolderOpen },
    { key: "contributors", label: t("members"), icon: Users, badge: uniqueContributors.length || undefined },
    { key: "chat", label: t("chat") || "Chat", icon: MessagesSquare },
    { key: "activity", label: t("activity"), icon: Activity },
  ];

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      {/* Sticky top tab bar — stays visible on scroll, single row, horizontally scrollable on mobile */}
      <div className="sticky top-16 z-30 -mx-4 mb-4 overflow-x-auto border-b border-border bg-background/95 px-4 backdrop-blur-md">
        <div className="flex snap-x items-center gap-1 py-2">
          {navItems.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-iran-green text-white shadow-iran-green"
                  : "text-muted-foreground hover:bg-iran-green/5 hover:text-iran-green"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {badge !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === key ? "bg-white/20" : "bg-muted"}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        <TabsContent value="overview" className="mt-0">
          <OverviewTab
            idea={idea}
            analysis={analysis}
            tasks={tasks}
            comments={comments}
            contributors={contributors}
            projectDocs={projectDocs}
            projectResources={projectResources}
            activityLog={activityLog}
            teaserImageUrl={teaserImageUrl}
            voteReasons={voteReasons || []}
            locale={locale}
            t={t}
            isAdmin={isAdmin}
            ideaId={ideaId}
            refresh={refresh}
            onTabChange={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="discussion" className="mt-0">
          <DiscussionTab
            idea={idea}
            comments={comments}
            voteCount={props.voteCount}
            session={session}
            ideaId={ideaId}
            t={t}
            tCommon={tCommon}
            refresh={refresh}
            onAuthOpen={onAuthOpen}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          <TasksTab
            tasks={tasks}
            session={session}
            ideaId={ideaId}
            isAdmin={isAdmin}
            t={t}
            tCommon={tCommon}
            refresh={refresh}
            onAuthOpen={onAuthOpen}
          />
        </TabsContent>

        <TabsContent value="document" className="mt-0">
          <DocumentTab
            docContent={projectContent || ""}
            googleDocUrl={googleDocUrl}
            docMeta={projectDocMeta || {}}
            ideaId={ideaId}
            isAdmin={isAdmin}
            canManage={!!canManage}
            signedIn={!!session}
            refresh={refresh}
            t={t}
          />
        </TabsContent>

        <TabsContent value="files" className="mt-0">
          <FilesTab
            projectDocs={projectDocs}
            projectResources={projectResources}
            session={session}
            ideaId={ideaId}
            t={t}
            refresh={refresh}
            onAuthOpen={onAuthOpen}
          />
        </TabsContent>

        <TabsContent value="contributors" className="mt-0">
          <ContributorsTab
            idea={idea}
            contributors={contributors}
            helpOffers={props.helpOffers}
            projectLeads={projectLeads}
            isAdmin={isAdmin}
            canManage={!!canManage}
            ideaId={ideaId}
            t={t}
            refresh={refresh}
          />
        </TabsContent>

        <TabsContent value="chat" className="mt-0">
          <ChatTab
            ideaId={ideaId}
            session={session}
            t={t}
            onAuthOpen={onAuthOpen}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <ActivityTab activityLog={activityLog} t={t} />
        </TabsContent>
      </div>
    </Tabs>
    </div>
  );
}
