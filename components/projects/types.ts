// Backward-compat alias for tab files that still use `Any`.
// New code should use the proper interfaces defined below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

// ---------- interfaces ----------

export interface ProjectCardProject {
  id: string;
  slug: string;
  title: string;
  category?: string;
  categoryEmoji?: string;
  status: string;
  bodyPreview?: string;
  totalTaskCount?: number;
  completedTaskCount?: number;
  leadName?: string;
  leadAvatar?: string;
  openRoleCount?: number;
}

export interface IdeaData {
  id: string;
  native_id?: number;
  title: string;
  body?: string;
  body_preview?: string;
  category?: string;
  category_emoji?: string;
  source?: string;
  source_url?: string;
  author_login?: string;
  author_avatar?: string;
  author_name?: string;
  author_profile_url?: string;
  github_vote_count?: number;
  comment_count?: number;
  replies_count?: number;
  stage?: string;
  graduated_to?: string | null;
  created_at?: string;
  updated_at?: string;
  project_status?: string;
  project_content?: string;
  project_leads?: string[] | string;
  rejection_reason?: string | null;
  similar_idea_id?: string | null;
  github_repo_url?: string | null;
  teaser_image_url?: string | null;
  google_doc_url?: string | null;
  author?: { login?: string; avatarUrl?: string; name?: string };
}

export interface ProjectAnalysis {
  summary?: string;
  feasibility?: string;
  feasibility_explanation?: string;
  feasibilityExplanation?: string;
  keyInsights?: string[];
  projectScope?: string;
  [key: string]: unknown;
}

export interface ProjectDocMeta {
  lastEditedBy?: string;
  lastEditedAt?: string;
  version?: number;
}

export interface HelpOfferRecord {
  id?: string;
  name?: string;
  email?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface VoteReason {
  vote_reason: string;
  [key: string]: unknown;
}

export interface SessionUser {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export interface SessionData {
  user?: SessionUser;
  expires?: string;
}

export interface TaskNote {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  replyTo?: string | null;
  editedAt?: string | null;
}

export interface SubmissionAttachment {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface TaskSubmission {
  id: string;
  authorName: string;
  content: string;
  status: string;
  createdAt: string;
  attachments?: SubmissionAttachment[];
}

export interface ProjectTask {
  id: string;
  ideaId: string;
  title: string;
  description: string;
  status: string;
  skillsNeeded: string[];
  timeEstimate: string;
  assigneeId?: string;
  assigneeName?: string;
  claimedAt?: string;
  dueDate?: string;
  source: string;
  notes: TaskNote[];
  submissions: TaskSubmission[];
  createdAt: string;
}

export interface ProjectComment {
  id: string;
  body: string;
  author_login: string;
  author_avatar: string;
  created_at: string;
  source: string;
  reply_to?: string | null;
  github_vote_count?: number;
}

export interface DocItem {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  url: string;
  type: string;
  description: string;
  authorName: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  idea_id: string;
  event_type: string;
  actor_name: string;
  details: string;
  created_at: string;
}

export interface Contributor {
  login?: string;
  name?: string;
  avatar?: string;
  skills?: string[];
  role?: string;
}

export interface ProjectWorkspaceProps {
  idea: IdeaData;
  comments: ProjectComment[];
  tasks: ProjectTask[];
  analysis: ProjectAnalysis | null;
  helpOffers: HelpOfferRecord[];
  voteCount: number;
  contributors: {
    commenters: Contributor[];
    taskClaimers: Contributor[];
    submitters: Contributor[];
    helpOffers: Contributor[];
  };
  projectStatus: string;
  projectContent: string;
  projectDocMeta: ProjectDocMeta;
  projectDocs: DocItem[];
  projectResources: ResourceItem[];
  projectLeads: string[];
  aiOpenQuestions: string[];
  activityLog: ActivityEntry[];
  voteReasons: VoteReason[];
  teaserImageUrl: string | null;
  googleDocUrl: string | null;
  session: SessionData | null;
  isAdmin: boolean;
  /** True if admin OR project lead — grants member-management rights for this project. */
  canManage?: boolean;
  ideaId: string;
  locale: string;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  refresh: () => void;
  onAuthOpen: () => void;
}

// ---------- constants ----------

export const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-yellow-400",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export const TIME_ESTIMATES = [
  "~1 hour",
  "~2 hours",
  "~4 hours",
  "~1 day",
  "~2 days",
  "~1 week",
];

export const SKILL_TYPES = [
  "research",
  "writing",
  "design",
  "development",
  "translation",
  "marketing",
  "data-analysis",
  "project-management",
];

export const TASK_STATUSES = ["open", "in-progress", "in-review", "done"] as const;

export const DISCUSSION_CATEGORIES = [
  "all",
  "general",
  "ideas",
  "qa",
  "announcements",
] as const;

export const FILE_RESOURCE_TYPES = ["link", "document", "file"] as const;

// ---------- helpers ----------

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  // SQLite datetime('now') doesn't include Z — normalize to UTC
  const normalized = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
  const now = Date.now();
  const then = new Date(normalized).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function genLocalId(): string {
  return `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function mapTaskStatus(
  status: string
): "open" | "in-progress" | "in-review" | "done" {
  switch (status) {
    case "open":
    case "proposed":
      return "open";
    case "claimed":
    case "in-progress":
    case "changes-requested":
      return "in-progress";
    case "submitted":
      return "in-review";
    case "accepted":
      return "done";
    default:
      return "open";
  }
}

export function getPriorityKey(timeEstimate: string): string {
  const hours = parseInt(timeEstimate?.replace(/[^0-9]/g, "") || "2");
  return hours <= 1 ? "low" : hours <= 2 ? "medium" : "high";
}
