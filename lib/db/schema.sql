-- IranENovin SQLite Schema

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  github_login TEXT UNIQUE,
  telegram_chat_id TEXT UNIQUE,
  bio TEXT,
  skills TEXT DEFAULT '[]',
  location TEXT,
  timezone TEXT,
  languages TEXT DEFAULT '[]',
  hours_per_week TEXT,
  categories TEXT DEFAULT '[]',
  telegram_handle TEXT,
  linkedin_url TEXT,
  is_public_profile INTEGER DEFAULT 0,
  profile_completed INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  provider TEXT DEFAULT 'email',
  password_hash TEXT,
  notification_prefs TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  -- Workspace V2 additions (added via migration; listed here for reference)
  workspace_v2_enabled INTEGER DEFAULT 0
);

-- Votes
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(idea_id, user_id)
);

CREATE TABLE IF NOT EXISTS vote_counts (
  idea_id TEXT PRIMARY KEY,
  github_votes INTEGER DEFAULT 0,
  local_votes INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'software',
  status TEXT DEFAULT 'forming',
  lead_user_id TEXT REFERENCES users(id),
  source_idea_id TEXT,
  source_idea_title TEXT,
  mission TEXT,
  github_repo_url TEXT,
  jitsi_url TEXT,
  last_activity_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Project roles
CREATE TABLE IF NOT EXISTS project_roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  is_filled INTEGER DEFAULT 0,
  filled_by TEXT REFERENCES users(id),
  filled_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Project applicants
CREATE TABLE IF NOT EXISTS project_applicants (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL,
  user_name TEXT,
  role TEXT NOT NULL,
  message TEXT,
  skills TEXT DEFAULT '[]',
  applied_at TEXT DEFAULT (datetime('now'))
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills_needed TEXT DEFAULT '[]',
  time_estimate TEXT,
  output_type TEXT,
  status TEXT DEFAULT 'open',
  assignee_id TEXT REFERENCES users(id),
  assignee_name TEXT,
  claimed_at TEXT,
  due_date TEXT,
  source TEXT DEFAULT 'ai',
  parent_task_id TEXT REFERENCES tasks(id),
  task_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  -- Workspace V2 additions (added via migration; listed here for reference)
  priority TEXT DEFAULT 'medium',
  labels TEXT DEFAULT '[]',
  rich_description TEXT,
  sprint_id TEXT,
  story_points INTEGER,
  start_date TEXT
);

-- Task notes
CREATE TABLE IF NOT EXISTS task_notes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  author_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  idea_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  ai_confidence TEXT,
  ai_decision TEXT,
  ai_review TEXT,
  status TEXT DEFAULT 'pending',
  accepted_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Expert reviews
CREATE TABLE IF NOT EXISTS expert_reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  decision TEXT NOT NULL,
  comment TEXT,
  via TEXT DEFAULT 'website',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI analyses
CREATE TABLE IF NOT EXISTS ai_analyses (
  idea_id TEXT PRIMARY KEY,
  feasibility TEXT,
  feasibility_explanation TEXT,
  summary TEXT,
  full_analysis TEXT,
  model_used TEXT,
  generated_at TEXT DEFAULT (datetime('now'))
);

-- AI chat messages
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  model_used TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Help offers
CREATE TABLE IF NOT EXISTS help_offers (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  skills TEXT DEFAULT '[]',
  message TEXT,
  hours_per_week TEXT,
  want_notifications INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Telegram links
CREATE TABLE IF NOT EXISTS telegram_links (
  user_id TEXT PRIMARY KEY,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  linked_at TEXT DEFAULT (datetime('now'))
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  idea_id TEXT,
  project_id TEXT,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Telegram subscribers (unlinked users who want updates)
CREATE TABLE IF NOT EXISTS telegram_subscribers (
  chat_id TEXT PRIMARY KEY,
  username TEXT,
  subscribed_at TEXT DEFAULT (datetime('now')),
  last_digest_sent TEXT
);

-- Telegram link tokens (temporary, for account linking flow)
-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  inviter_id TEXT NOT NULL,
  inviter_name TEXT,
  type TEXT DEFAULT 'direct',
  recipient_name TEXT,
  recipient_contact TEXT,
  contact_type TEXT DEFAULT 'link',
  personal_message TEXT,
  status TEXT DEFAULT 'pending',
  invite_code TEXT UNIQUE NOT NULL,
  accepted_by_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token TEXT PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT (datetime('now', '+10 minutes')),
  used INTEGER DEFAULT 0
);

-- ─── Local-First Cached Data ──────────────────────────────────────────────

-- Ideas (both IAB and native, fully cached locally)
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  native_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  body_preview TEXT,
  category TEXT,
  category_emoji TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  author_login TEXT,
  author_avatar TEXT,
  author_name TEXT,
  author_profile_url TEXT,
  github_vote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  stage TEXT DEFAULT 'submitted',
  graduated_to TEXT,
  created_at TEXT,
  updated_at TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  -- Workspace V2 additions (added via migration; listed here for reference)
  rich_content TEXT
);

-- Idea comments (cached locally)
CREATE TABLE IF NOT EXISTS idea_comments (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author_login TEXT,
  author_avatar TEXT,
  created_at TEXT,
  source TEXT DEFAULT 'github',
  synced_at TEXT DEFAULT (datetime('now'))
);

-- GitHub discussion categories (cached)
CREATE TABLE IF NOT EXISTS github_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  repo TEXT NOT NULL
);

-- Project GitHub data (cached)
CREATE TABLE IF NOT EXISTS project_github_cache (
  slug TEXT PRIMARY KEY,
  repo_url TEXT,
  description TEXT,
  language TEXT,
  star_count INTEGER DEFAULT 0,
  fork_count INTEGER DEFAULT 0,
  topics TEXT DEFAULT '[]',
  readme_content TEXT,
  homepage TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);

-- Project issues from GitHub (cached)
CREATE TABLE IF NOT EXISTS project_issues_cache (
  id INTEGER,
  project_slug TEXT,
  title TEXT,
  body TEXT,
  state TEXT,
  labels TEXT DEFAULT '[]',
  assignee_login TEXT,
  assignee_avatar TEXT,
  milestone_title TEXT,
  html_url TEXT,
  created_at TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (id, project_slug)
);

-- Project milestones from GitHub (cached)
CREATE TABLE IF NOT EXISTS project_milestones_cache (
  id INTEGER,
  project_slug TEXT,
  title TEXT,
  description TEXT,
  open_issues INTEGER DEFAULT 0,
  closed_issues INTEGER DEFAULT 0,
  html_url TEXT,
  due_on TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (id, project_slug)
);

-- Project contributors from GitHub (cached)
CREATE TABLE IF NOT EXISTS project_contributors_cache (
  login TEXT,
  project_slug TEXT,
  avatar_url TEXT,
  html_url TEXT,
  contributions INTEGER DEFAULT 0,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (login, project_slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_stage ON ideas(stage);
CREATE INDEX IF NOT EXISTS idx_ideas_votes ON ideas(github_vote_count);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_idea ON idea_comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_votes_idea ON votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_tasks_idea ON tasks(idea_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task ON submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_idea ON ai_chat_messages(idea_id);
CREATE INDEX IF NOT EXISTS idx_roles_project ON project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_applicants_project ON project_applicants(project_id);
CREATE INDEX IF NOT EXISTS idx_help_offers_idea ON help_offers(idea_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_idea ON ai_analyses(idea_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_idea ON activity_log(idea_id);
-- idx_ideas_project_status moved to migrations (project_status column is added via ALTER TABLE)
CREATE INDEX IF NOT EXISTS idx_ideas_updated ON ideas(updated_at);

-- Comment reactions
CREATE TABLE IF NOT EXISTS comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'upvote',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(comment_id, user_id, reaction_type)
);

-- Accepted work (replaces JSON file storage)
CREATE TABLE IF NOT EXISTS accepted_work (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  accepted_at TEXT DEFAULT (datetime('now'))
);

-- Project milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  user_name TEXT,
  type TEXT DEFAULT 'general',
  message TEXT NOT NULL,
  url TEXT,
  screenshot TEXT,
  attachments TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_accepted_work_idea ON accepted_work(idea_id);
CREATE INDEX IF NOT EXISTS idx_milestones_idea ON project_milestones(idea_id);

-- Logs
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context TEXT,
  actor_name TEXT,
  idea_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

-- ─── Workspace V2 (Phase 0 scaffolding) ─────────────────────────────────
-- Note: ALTER TABLE statements for existing tables (tasks, ideas, users,
-- notifications) live in lib/db/index.ts migrations array. The new tables
-- below are also created there (with IF NOT EXISTS) but mirrored here for
-- documentation and idempotent cold starts.

-- Sprints (scrum-style sprint tracking per project/idea)
CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'planned',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Doc pages (hierarchical TipTap documents per project)
CREATE TABLE IF NOT EXISTS doc_pages (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  content_json TEXT,
  content_plain TEXT,
  author_id TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Mentions (user tagging across any source)
CREATE TABLE IF NOT EXISTS mentions (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  mentioned_user_id TEXT NOT NULL,
  author_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task label definitions (per project)
CREATE TABLE IF NOT EXISTS task_label_defs (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sprints_idea ON sprints(idea_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_idea ON doc_pages(idea_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON doc_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id);
-- Note: indexes that depend on ALTER-added columns (idx_notifications_user_read_at,
-- idx_tasks_sprint) live in lib/db/index.ts migrations so they run after the
-- ALTER TABLE statements that add the underlying columns.
