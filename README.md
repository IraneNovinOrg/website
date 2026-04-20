# IranENovin Community Platform

A **mission-driven collaboration operating system** for Iranians worldwide to collaborate on rebuilding Iran. Ideas are submitted, validated by the community, formed into structured projects with AI-generated tasks, and executed by distributed volunteer teams.

**Live at:** [iranenovin.com](https://iranenovin.com) | **Source ideas:** [IranAzadAbad/ideas](https://github.com/IranAzadAbad/ideas)

## Quick Start

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # Production build
```

## Tech Stack

Next.js 14 · TypeScript · SQLite · NextAuth v5 · Tailwind CSS + shadcn/ui · Framer Motion · Multi-model AI (Codex CLI / Claude) · GitHub GraphQL API · next-intl (EN/FA + RTL)

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](./CLAUDE.md) | Main project guide — architecture, decisions, critical files |
| [docs/FEATURES.md](./docs/FEATURES.md) | Complete feature list (15 major features) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | File structure, tech stack versions, schema, performance |
| [docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md) | Database stats, what works, what's blocked, what's pending |
| [docs/AI_AGENT.md](./docs/AI_AGENT.md) | AI system: models, playbooks, skills, triggers, troubleshooting |
| [docs/KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) | Bugs, failures, dead code, prioritized fix list |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Version history — what changed, when, why |
| [docs/COMPLETE_PROJECT_SPEC.md](./docs/COMPLETE_PROJECT_SPEC.md) | Full engineering spec (rebuild-from-scratch detail) |
| [DEPLOY.md](./DEPLOY.md) | Deployment guide — GitHub org, env vars, hosting |
| [docs/google-docs-setup.md](./docs/google-docs-setup.md) | Google Docs integration setup |

## Key Features

- **306 ideas** synced from IranAzadAbad GitHub Discussions
- **7-tab project workspace** (Overview, Discussion, Tasks, Document, Files, Contributors, Activity)
- **AI agent** analyzes ideas, generates tasks, reviews submissions, auto-replies to comments
- **Lion & Sun design system** — Iranian heritage theme with Iran flag color palette
- **GitHub Discussions-style** threaded comments with emoji reactions
- **Trust levels** (New -> Contributor -> Reviewer -> Lead) with auto-promotion
- **Bilingual** (English + Farsi) with full RTL support
- **Command palette** (Cmd+K) for quick search and navigation
- **Admin panel** with AI control, analytics charts, structured logs, agent configuration
- **Drop-in brand override** — swap logo by dropping files into `public/brand/custom/`

## License

MIT
