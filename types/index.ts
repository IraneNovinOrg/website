export interface Idea {
  id: number;
  title: string;
  body: string;
  category: string;
  author: { login: string; avatarUrl: string; name?: string };
  voteCount: number;
  commentCount: number;
  createdAt: string;
  labels: string[];
  status: "open" | "in-progress" | "project-created" | "closed";
  url: string;
}

export interface IdeaDetail extends Idea {
  comments: Comment[];
}

export interface Comment {
  id: number;
  body: string;
  author: { login: string; avatarUrl: string; name?: string };
  createdAt: string;
}

export interface Project {
  id: number;
  slug: string;
  title: string;
  description: string;
  status: "planning" | "building" | "launched";
  techTags: string[];
  lookingFor: string[];
  contributorCount: number;
  contributors: { login: string; avatarUrl: string }[];
  sourceIdeaId?: number;
  repoUrl: string;
  externalUrl?: string;
  isCodeProject: boolean;
  createdAt: string;
}

export interface Member {
  login: string;
  name?: string;
  avatarUrl: string;
  role: "admin" | "member" | "contributor";
  skills: string[];
  joinedAt: string;
  bio?: string;
  ideasCount?: number;
  projectsCount?: number;
  location?: string | null;
  timezone?: string | null;
  languages?: string[];
  hoursPerWeek?: string | null;
  categories?: string[];
  telegramHandle?: string | null;
  linkedInUrl?: string | null;
  profileCompleted?: boolean;
  reputationScore?: number;
}

export interface ApiError {
  error: string;
  code: string;
}

// ─── IAB Sync / Unified Ideas ────────────────────────────────────────────────

export type PipelineStage =
  | "submitted"
  | "gaining"
  | "validated"
  | "team-forming"
  | "active-project"
  | "launched";

export type IdeaSource = "iranenovin" | "iranazadabad";

export interface UnifiedIdea {
  id: string; // "iae-{n}" for IAB, "ien-{n}" for IranENovin
  nativeId: number;
  title: string;
  body: string;
  bodyPreview: string;
  category: string;
  categoryEmoji: string;
  source: IdeaSource;
  sourceUrl: string;
  author: {
    login: string;
    avatarUrl: string;
    name?: string;
    profileUrl?: string;
  };
  voteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
  labels: Array<{ name: string; color?: string }>;
  stage: PipelineStage;
  helpOffersCount: number;
  graduatedTo: string | null;
  projectStatus?: string;
  taskCounts?: { total: number; open: number; completed: number };
  feasibility?: string | null;
  /** True only for the top 3-5 genuinely trending ideas (computed dynamically) */
  isTrending?: boolean;
  /** Raw trending score (votes + recency + engagement) for debug/sort */
  trendingScore?: number;
  /** True when the current (authenticated) viewer has upvoted this idea. */
  hasVoted?: boolean;
}

export interface IABComment {
  id: number;
  body: string;
  author: { login: string; avatarUrl: string; profileUrl: string };
  createdAt: string;
}

export interface IABCache {
  fetchedAt: string;
  lastIncrementalAt?: string | null;
  totalCount: number;
  ideas: UnifiedIdea[];
}
