import { Octokit } from "@octokit/rest";
import { GITHUB_ORG, GITHUB_BOT_TOKEN } from "./constants";

function getOctokit(): Octokit | null {
  if (!GITHUB_BOT_TOKEN) return null;
  return new Octokit({ auth: GITHUB_BOT_TOKEN });
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "");
}

function sanitizeOneLine(text: string): string {
  return text
    .replace(/[\r\n\t\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .trim();
}

function firstSentence(text: string, maxLen: number): string {
  const cleaned = sanitizeOneLine(text);
  if (!cleaned) return "";
  // Prefer first sentence boundary
  const sentMatch = cleaned.match(/^(.+?[.!?])(\s|$)/);
  const candidate = sentMatch ? sentMatch[1] : cleaned;
  if (candidate.length <= maxLen) return candidate;
  return candidate.slice(0, maxLen - 1).trimEnd() + "…";
}

function deriveTagline(title: string, description: string): string {
  const snippet = firstSentence(description, 120);
  if (snippet) return snippet;
  return `A community-driven initiative: ${title}`;
}

function sanitizeCategorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const TECH_CATEGORIES: string[] = [
  "software",
  "technical",
  "technology",
  "ai",
  "web",
  "mobile",
  "devtools",
  "infrastructure",
  "data",
];

function isTechCategory(category: string): boolean {
  const slug = sanitizeCategorySlug(category);
  return TECH_CATEGORIES.some((t) => slug.includes(t));
}

function buildTechStackSection(category: string): string {
  if (isTechCategory(category)) {
    return `## 🏗️ Tech Stack

_Fill in as the project evolves. Suggested starting points:_

- **Language:** TypeScript / Python (TBD by team)
- **Framework:** TBD
- **Database:** TBD
- **Testing:** TBD
- **CI/CD:** GitHub Actions
- **Deployment:** TBD
`;
  }
  return `## 🏗️ Tools & Methods

_Fill in as the project evolves. Suggested starting points:_

- **Research:** Interviews, surveys, field notes
- **Documentation:** Markdown + Google Docs
- **Collaboration:** IranENovin platform + GitHub Discussions
- **Decision log:** \`docs/decisions/\`
`;
}

function buildProjectStructureSection(): string {
  return `## 📁 Project Structure

\`\`\`
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/            # Design docs, decisions, specifications
├── src/             # Source code and primary artifacts
├── tests/           # Tests and validation
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── README.md
\`\`\`
`;
}

function buildGettingStartedSection(isTech: boolean): string {
  if (isTech) {
    return `## 🚀 Getting Started

### Prerequisites

- Git
- Node.js 18+ (or relevant runtime for the chosen stack)
- A GitHub account and access to the IranENovin platform

### Setup

\`\`\`bash
# 1. Clone the repository
git clone https://github.com/${GITHUB_ORG}/REPO_NAME.git
cd REPO_NAME

# 2. Install dependencies (once the stack is chosen)
# npm install   # or pnpm install / yarn / pip install -r requirements.txt

# 3. Run locally
# npm run dev
\`\`\`

> Replace the placeholder commands once the team finalizes the tech stack.
`;
  }
  return `## 🚀 Getting Started

### Prerequisites

- A GitHub account
- Access to the IranENovin platform
- Familiarity with the problem domain (see docs/)

### Setup

1. Read through the \`docs/\` folder to understand the current state.
2. Visit the project page on IranENovin to see open tasks.
3. Introduce yourself on the project's discussion board.
4. Claim a task that matches your skills and get started.
`;
}

function renderTasks(tasks: { title: string; status: string; description?: string; skills?: string[] | string }[]): string {
  if (!tasks || tasks.length === 0) {
    return "_No tasks generated yet. Visit the platform to help shape the task list._";
  }
  return tasks
    .map((t) => {
      const done = t.status === "accepted" || t.status === "completed" ? "x" : " ";
      const skillsArr = Array.isArray(t.skills)
        ? t.skills
        : typeof t.skills === "string" && t.skills
        ? t.skills.split(/[,;]\s*/).filter(Boolean)
        : [];
      const skillsLine = skillsArr.length > 0 ? ` _(skills: ${skillsArr.join(", ")})_` : "";
      const statusBadge = `\`${t.status || "open"}\``;
      return `- [${done}] **${sanitizeOneLine(t.title)}** — ${statusBadge}${skillsLine}`;
    })
    .join("\n");
}

function renderLeads(leads: unknown): string {
  if (!leads) return "";
  let list: { name?: string; role?: string; github?: string }[] = [];
  if (typeof leads === "string") {
    try {
      const parsed = JSON.parse(leads);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      // Treat as comma-separated names
      list = leads
        .split(/[,\n]/)
        .map((n) => n.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
    }
  } else if (Array.isArray(leads)) {
    list = leads as { name?: string; role?: string; github?: string }[];
  }
  if (list.length === 0) return "";
  const rows = list
    .map((l) => {
      const name = l.name || "Anonymous";
      const role = l.role ? ` — ${l.role}` : "";
      const gh = l.github ? ` ([@${l.github}](https://github.com/${l.github}))` : "";
      return `- ${name}${role}${gh}`;
    })
    .join("\n");
  return `## 👥 Project Leads

${rows}
`;
}

function buildReadme(opts: {
  title: string;
  tagline: string;
  aboutParagraph: string;
  visionGoals: string;
  techStackSection: string;
  projectStructureSection: string;
  gettingStartedSection: string;
  taskListMd: string;
  platformProjectUrl: string;
  discussionUrl?: string;
  website?: string;
  category: string;
  categoryBadge: string;
  statusBadge: string;
  leadsSection: string;
}): string {
  const platformBadge = `[![IranENovin Community](https://img.shields.io/badge/IranENovin-Community-00a86b?style=flat-square)](${opts.platformProjectUrl})`;
  const catBadge = `![Category](https://img.shields.io/badge/category-${opts.categoryBadge}-blue?style=flat-square)`;
  const stBadge = `![Status](https://img.shields.io/badge/status-${opts.statusBadge}-orange?style=flat-square)`;

  const linksSection = [
    `- 🌍 **Platform project page:** ${opts.platformProjectUrl}`,
    opts.discussionUrl ? `- 💬 **Discussion:** ${opts.discussionUrl}` : "",
    opts.website ? `- 🔗 **Website:** ${opts.website}` : "",
    `- 🏠 **Community home:** https://iranenovin.com`,
  ]
    .filter(Boolean)
    .join("\n");

  return `# ${opts.title}

> ${opts.tagline}

${platformBadge} ${catBadge} ${stBadge}

## About

${opts.aboutParagraph}

## Table of Contents

- [About](#about)
- [✨ Vision & Goals](#-vision--goals)
- [🏗️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [🤝 Contributing](#-contributing)
- [📋 Current Tasks](#-current-tasks)
- [🌐 Links](#-links)
- [👥 Project Leads](#-project-leads)
- [📜 License](#-license)

## ✨ Vision & Goals

${opts.visionGoals}

${opts.techStackSection}

${opts.projectStructureSection}

${opts.gettingStartedSection}

## 🤝 Contributing

We welcome contributions from everyone — coders, designers, researchers, writers, and domain experts. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

**Quick three-step summary:**

1. **Find a task** on the [project task board](${opts.platformProjectUrl}) that matches your skills.
2. **Claim it** through the IranENovin platform so the team knows you're on it.
3. **Submit your work** via a pull request and link it back to the task.

## 📋 Current Tasks

${opts.taskListMd}

> Tasks are synced from the [IranENovin platform](${opts.platformProjectUrl}). Visit the project page for the authoritative, up-to-date list.

## 🌐 Links

${linksSection}

${opts.leadsSection}

## 📜 License

This project is released under the [MIT License](./LICENSE). See the LICENSE file for details.

---

_Part of the [IranENovin](https://iranenovin.com) community platform — building Iran's future together._
`;
}

function buildLicenseMit(): string {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year} IranENovin Community Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

function buildContributingMd(platformProjectUrl: string): string {
  return `# Contributing

Welcome, and thank you for your interest in contributing! This project is part of the [IranENovin community platform](https://iranenovin.com) — a mission-driven collaboration operating system for Iranians worldwide working together to rebuild Iran.

Whether you're a developer, designer, researcher, writer, translator, or domain expert, there's a place for you here.

## How to Find Tasks

All tasks live on the IranENovin platform, not in GitHub Issues. This keeps the source of truth in one place.

- Visit the [project task board](${platformProjectUrl}).
- Browse open tasks filtered by skill, difficulty, and time estimate.
- Read the task description, acceptance criteria, and linked resources.

## How to Claim a Task

1. Sign in to the [IranENovin platform](https://iranenovin.com).
2. Open the task you're interested in.
3. Click **Claim task** and leave a short note on what approach you plan to take.
4. The task will be marked with your name and a reasonable deadline will be negotiated.

## How to Submit Work

1. **Fork** this repository.
2. **Create a branch** from \`main\` named after the task, e.g. \`task/123-add-login-form\`.
3. **Make your changes** in small, logical commits.
4. **Push your branch** and open a **pull request** against \`main\`.
5. **Link the task** in the PR description using the platform task URL.
6. Wait for review. A project lead or reviewer will respond within a few days.

## Code Style Guidelines

- Keep changes focused — one concern per PR.
- Match the existing style of the surrounding code.
- Prefer clarity over cleverness. Comment non-obvious logic.
- Add or update tests when you change behavior.
- Run the project's linter and formatter (if defined) before pushing.

## Commit Message Format

We follow a lightweight [Conventional Commits](https://www.conventionalcommits.org/) style:

\`\`\`
<type>(<scope>): <short summary>

<optional body>

<optional footer>
\`\`\`

**Types:** \`feat\`, \`fix\`, \`docs\`, \`style\`, \`refactor\`, \`test\`, \`chore\`

**Example:**

\`\`\`
feat(auth): add password reset flow

Implements the forgot-password endpoint and UI, wired to the
platform's email service.

Closes: https://iranenovin.com/en/tasks/42
\`\`\`

## Pull Request Review Process

- At least **one reviewer** (project lead or trusted contributor) must approve.
- CI checks (if configured) must pass.
- Reviewers look for: correctness, tests, docs, security, and alignment with project goals.
- Expect constructive feedback — reviews are a conversation, not a gate.
- Once approved, a maintainer will merge using squash-merge to keep history clean.

## Community Guidelines

All contributors must follow the [IranENovin Community Guidelines](https://iranenovin.com/en/guidelines). In short:

- Be respectful and assume good intent.
- No harassment, hate speech, or personal attacks.
- Keep discussions on-topic and constructive.
- Respect privacy — don't share personal info without consent.
- Credit others for their work.

Thank you for helping build Iran's future — together. 🌱
`;
}

function buildGitignore(): string {
  return `# Dependencies
node_modules/
jspm_packages/

# Build output
dist/
build/
out/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Misc
.cache/
tmp/
temp/
`;
}

function buildBugReportTemplate(): string {
  return `---
name: Bug report
about: Report a problem so we can fix it
title: "[Bug] "
labels: bug
assignees: ''
---

## Describe the bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected behavior

What you expected to happen.

## Screenshots / Logs

If applicable, add screenshots or paste relevant log output.

## Environment

- OS: [e.g. macOS 14, Ubuntu 22.04]
- Browser / Runtime: [e.g. Chrome 120, Node 20]
- Version / Commit: [e.g. v0.1.0 or commit sha]

## Additional context

Add any other context about the problem here.
`;
}

function buildFeatureRequestTemplate(): string {
  return `---
name: Feature request
about: Suggest an idea for this project
title: "[Feature] "
labels: enhancement
assignees: ''
---

## Is your feature request related to a problem?

A clear and concise description of the problem. Ex: "I'm always frustrated when..."

## Describe the solution you'd like

A clear and concise description of what you want to happen.

## Describe alternatives you've considered

Any alternative solutions or features you've considered.

## Additional context

Add any other context, mockups, or screenshots about the feature request here.

> 💡 Many ideas are better discussed on the [IranENovin platform](https://iranenovin.com) first so they can become formal tasks.
`;
}

function buildPrTemplate(): string {
  return `## Summary

<!-- Briefly describe what this PR does and why. -->

## Linked Task

<!-- Paste the IranENovin platform task URL, e.g. https://iranenovin.com/en/tasks/42 -->

## Changes

<!-- Bullet list of the key changes in this PR. -->

-
-
-

## Testing

<!-- How did you test this? What should reviewers verify? -->

## Checklist

- [ ] I read the [CONTRIBUTING.md](../CONTRIBUTING.md) guide
- [ ] My code follows the project's style
- [ ] I added/updated tests where appropriate
- [ ] I updated documentation where appropriate
- [ ] The linked task is referenced in the description
- [ ] This PR is focused on a single concern

## Screenshots (if applicable)

<!-- Drag images here or paste them. -->
`;
}

async function safeCreateFile(
  octokit: Octokit,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  try {
    // Check if file already exists (so we can update with sha)
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner: GITHUB_ORG,
        repo,
        path,
      });
      sha = (existing.data as Record<string, unknown>).sha as string | undefined;
    } catch {
      // Doesn't exist, will create fresh
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_ORG,
      repo,
      path,
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: "main",
      ...(sha ? { sha } : {}),
    });
  } catch (e) {
    console.error(`[GitHubRepos] Failed to create ${path}:`, e);
    // Graceful continue
  }
}

export interface ProjectLead {
  name?: string;
  role?: string;
  github?: string;
}

export async function createProjectRepo(params: {
  ideaId: string;
  title: string;
  description: string;
  tasks: { title: string; status: string; description: string; skills?: string[] | string }[];
  category: string;
  // New optional params for richer content
  project_content?: string;
  project_docs?: string;
  project_resources?: string;
  project_leads?: string | ProjectLead[];
  slug?: string;
  discussionUrl?: string;
  website?: string;
  status?: string;
}): Promise<{ repoUrl: string; repoName: string } | null> {
  const octokit = getOctokit();
  if (!octokit) {
    console.log("[GitHubRepos] No bot token configured, skipping repo creation");
    return null;
  }

  // Consult AI for a professional repo name (fallback to default if AI unavailable)
  let repoName = `project-${slugify(params.title)}`;
  let aiDescription: string | undefined;
  try {
    const { callAI } = await import("./ai/router");
    const { loadSystemPrompt } = await import("./ai/playbooks");
    const { extractJson } = await import("./ai/skills");
    const systemPrompt = loadSystemPrompt();
    const skillPrompt = `Suggest a short, professional GitHub repository name for this project.
Project Title: ${params.title}
Category: ${params.category}
Description: ${(params.description || "").slice(0, 500)}

Respond with ONLY valid JSON: {"repoName":"suggested-name","description":"One-line description"}`;
    const { text } = await callAI("chat", systemPrompt, skillPrompt, { maxTokens: 200 });
    const parsed = extractJson<{ repoName?: string; description?: string }>(text);
    if (parsed?.repoName && /^[a-z0-9][a-z0-9-]*$/.test(parsed.repoName) && parsed.repoName.length <= 50) {
      repoName = parsed.repoName;
      aiDescription = parsed.description;
      console.log(`[GitHubRepos] AI suggested repo name: ${repoName}`);
    }
  } catch (e) {
    console.log(`[GitHubRepos] AI repo name suggestion failed, using default: ${(e as Error).message}`);
  }

  // Build the short repo description (About field)
  // Prefer AI description, then project_content, then body/description
  const aboutSource = aiDescription || (params.project_content && params.project_content.trim()) || params.description || "";
  const shortDescription = firstSentence(aboutSource, 180) || sanitizeOneLine(params.title).slice(0, 180);

  // Build platform project URL — do NOT hardcode locale.
  // Ideally we would respect the user's locale, but the admin trigger
  // doesn't have that context; default to /en/ as a neutral fallback.
  const platformBase = (process.env.NEXTAUTH_URL || "https://iranenovin.com").replace(/\/+$/, "");
  const ideaSlugOrId = params.slug || params.ideaId;
  const platformProjectUrl = `${platformBase}/en/projects/${ideaSlugOrId}`;

  try {
    // Check if repo already exists
    try {
      await octokit.repos.get({ owner: GITHUB_ORG, repo: repoName });
      console.log(`[GitHubRepos] Repo ${repoName} already exists`);
      return { repoUrl: `https://github.com/${GITHUB_ORG}/${repoName}`, repoName };
    } catch {
      // Repo doesn't exist, create it
    }

    // Create the repo
    await octokit.repos.createInOrg({
      org: GITHUB_ORG,
      name: repoName,
      description: shortDescription,
      auto_init: true, // Creates with README
      has_issues: true,
      has_projects: true,
    });

    // Build README content sections
    const tagline = deriveTagline(params.title, aboutSource);
    const aboutParagraph = (() => {
      const src = (params.project_content || params.description || "").trim();
      if (!src) return `_${tagline}_`;
      const cleaned = src.replace(/\r\n/g, "\n").trim();
      if (cleaned.length <= 500) return cleaned;
      return cleaned.slice(0, 497).trimEnd() + "…";
    })();

    const visionGoals = (() => {
      const src = (params.project_content || "").trim();
      if (src) {
        const cleaned = src.replace(/\r\n/g, "\n").trim();
        // Limit vision section to ~1200 chars to keep readme scannable
        return cleaned.length <= 1200 ? cleaned : cleaned.slice(0, 1197).trimEnd() + "…";
      }
      return `This project aims to deliver meaningful, lasting impact as part of the IranENovin community. The detailed vision and goals will be refined collaboratively by the project leads and contributors. Join the discussion on the [project page](${platformProjectUrl}) to help shape them.`;
    })();

    const techStackSection = buildTechStackSection(params.category);
    const projectStructureSection = buildProjectStructureSection();
    const gettingStartedSection = buildGettingStartedSection(isTechCategory(params.category));
    const taskListMd = renderTasks(params.tasks || []);
    const leadsSection = renderLeads(params.project_leads);

    const catSlug = sanitizeCategorySlug(params.category || "general") || "general";
    const statusSlug = sanitizeCategorySlug(params.status || "active") || "active";

    const readme = buildReadme({
      title: params.title,
      tagline,
      aboutParagraph,
      visionGoals,
      techStackSection,
      projectStructureSection,
      gettingStartedSection,
      taskListMd,
      platformProjectUrl,
      discussionUrl: params.discussionUrl,
      website: params.website,
      category: params.category,
      categoryBadge: encodeURIComponent(catSlug),
      statusBadge: encodeURIComponent(statusSlug),
      leadsSection,
    });

    // Wait for GitHub to initialize the repo (auto_init takes a moment)
    await new Promise((r) => setTimeout(r, 2000));

    // Update README — try to get existing first, if not found create new
    try {
      const currentReadme = await octokit.repos.getContent({
        owner: GITHUB_ORG,
        repo: repoName,
        path: "README.md",
      });
      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_ORG,
        repo: repoName,
        path: "README.md",
        message: "Initial project setup from IranENovin",
        content: Buffer.from(readme, "utf8").toString("base64"),
        branch: "main",
        sha: (currentReadme.data as Record<string, unknown>).sha as string,
      });
    } catch {
      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_ORG,
        repo: repoName,
        path: "README.md",
        message: "Initial project setup from IranENovin",
        content: Buffer.from(readme, "utf8").toString("base64"),
        branch: "main",
      });
    }

    // Sequentially create supporting files (GitHub API doesn't support batch).
    // Errors are logged and we continue on each.
    const supportingFiles: Array<{ path: string; content: string; message: string }> = [
      { path: "LICENSE", content: buildLicenseMit(), message: "Add MIT License" },
      {
        path: "CONTRIBUTING.md",
        content: buildContributingMd(platformProjectUrl),
        message: "Add contributing guide",
      },
      { path: ".gitignore", content: buildGitignore(), message: "Add .gitignore" },
      {
        path: ".github/ISSUE_TEMPLATE/bug_report.md",
        content: buildBugReportTemplate(),
        message: "Add bug report issue template",
      },
      {
        path: ".github/ISSUE_TEMPLATE/feature_request.md",
        content: buildFeatureRequestTemplate(),
        message: "Add feature request issue template",
      },
      {
        path: ".github/PULL_REQUEST_TEMPLATE.md",
        content: buildPrTemplate(),
        message: "Add pull request template",
      },
      { path: "docs/.gitkeep", content: "", message: "Create docs/ directory" },
      { path: "src/.gitkeep", content: "", message: "Create src/ directory" },
      { path: "tests/.gitkeep", content: "", message: "Create tests/ directory" },
    ];

    for (const f of supportingFiles) {
      await safeCreateFile(octokit, repoName, f.path, f.content, f.message);
    }

    // Add topics
    const topics = [
      "iranenovin",
      "community-project",
      "open-source",
      catSlug,
    ].filter((t, i, arr) => t && arr.indexOf(t) === i);

    try {
      await octokit.repos.replaceAllTopics({
        owner: GITHUB_ORG,
        repo: repoName,
        names: topics,
      });
    } catch (e) {
      console.error("[GitHubRepos] Failed to set topics:", e);
    }

    const repoUrl = `https://github.com/${GITHUB_ORG}/${repoName}`;
    console.log(`[GitHubRepos] Created repo: ${repoUrl}`);
    return { repoUrl, repoName };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error("[GitHubRepos] Create failed:", e);
    if (e?.status === 403 || e?.response?.status === 403) {
      console.error(
        "[GitHubRepos] Permission denied. The token needs 'Administration: Read and write' permission for the organization."
      );
      throw new Error(
        "GitHub token lacks permission to create repos in the organization. " +
          "Go to GitHub Settings → Developer Settings → Personal Access Tokens → " +
          "edit the token → enable 'Administration: Read and write' for the organization."
      );
    }
    throw new Error(`Failed to create GitHub repo: ${e?.message || String(e)}`);
  }
}

export async function updateRepoReadme(params: {
  repoName: string;
  title: string;
  description: string;
  tasks: { title: string; status: string }[];
}): Promise<boolean> {
  const octokit = getOctokit();
  if (!octokit) return false;

  try {
    const taskList = params.tasks
      .map((t) => `- [${t.status === "accepted" ? "x" : " "}] ${t.title}`)
      .join("\n");

    const readme = `# ${params.title}\n\n${params.description.slice(0, 1000)}\n\n## Tasks\n\n${taskList || "No tasks yet."}\n`;

    const current = await octokit.repos.getContent({
      owner: GITHUB_ORG,
      repo: params.repoName,
      path: "README.md",
    });

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_ORG,
      repo: params.repoName,
      path: "README.md",
      message: "Update from IranENovin platform",
      content: Buffer.from(readme, "utf8").toString("base64"),
      branch: "main",
      sha: (current.data as Record<string, unknown>).sha as string,
    });

    return true;
  } catch (e) {
    console.error("[GitHubRepos] Update failed:", e);
    return false;
  }
}
