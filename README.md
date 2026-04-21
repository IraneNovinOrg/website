# IranENovin Community Platform

A **mission-driven collaboration operating system** for Iranians worldwide to collaborate on rebuilding Iran. Ideas are submitted, validated by the community, formed into structured projects with AI-generated tasks, and executed by distributed volunteer teams.

**Live at:** [iranenovin.com](https://iranenovin.com) | **Source ideas:** [IranAzadAbad/ideas](https://github.com/IranAzadAbad/ideas)

---

## One-stop setup (fresh machine)

```bash
# 1. Install pnpm (if you don't have it)
npm install -g pnpm

# 2. Clone the repo
git clone https://github.com/IraneNovinOrg/website.git
cd website

# 3. Install dependencies
pnpm install

# 4. Initialize the database, directories, and .env.local
pnpm setup

# 5. Fill in .env.local with your OAuth credentials (see below)
#    then start the dev server:
pnpm dev          # http://localhost:3000

# 6. (Optional) Pull ideas from IranAzadAbad GitHub Discussions
pnpm sync
```

`pnpm setup` is idempotent — safe to re-run. It creates:

- `_data/iranenovin.db` (SQLite database with full schema + migrations)
- `_data/` and `public/uploads/` directories
- `.env.local` copied from `.env.local.example` (if missing)

It then prints a checklist of any env vars that still need values.

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

### Required
| Variable | How to get it |
|----------|---------------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` for dev, full domain in prod |
| `GITHUB_BOT_TOKEN` | [Create a PAT](https://github.com/settings/tokens) with `repo` + `read:discussion` scopes |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | [Create an OAuth App](https://github.com/settings/developers) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | See [docs/GOOGLE_SIGNIN_SETUP.md](./docs/GOOGLE_SIGNIN_SETUP.md) |

### Optional
| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude AI fallback (AI features degrade without this) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHANNEL_ID` | Admin notifications |
| `RESEND_API_KEY` | Transactional emails |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_PRIVATE_KEY` | Google Docs integration |

---

## Available commands

```bash
pnpm setup        # Initialize DB, directories, .env.local
pnpm dev          # Next.js dev server (localhost:3000)
pnpm build        # Production build
pnpm start        # Run production build
pnpm lint         # ESLint
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright e2e tests
pnpm sync         # One-time bootstrap sync from GitHub Discussions
```

---

## Tech stack

Next.js 14 · TypeScript strict · SQLite (better-sqlite3, WAL) · NextAuth v5 · Tailwind CSS + shadcn/ui · Framer Motion · Multi-model AI (Codex CLI / Claude) · GitHub GraphQL · next-intl (EN/FA + RTL)

---

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](./CLAUDE.md) | Main project guide — architecture, decisions, critical files |
| [docs/FEATURES.md](./docs/FEATURES.md) | Complete feature list |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | File structure, tech stack, schema, performance |
| [docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md) | What works, what's pending |
| [docs/AI_AGENT.md](./docs/AI_AGENT.md) | AI system: models, playbooks, skills, triggers |
| [docs/KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) | Bugs, dead code, prioritized fix list |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Version history |
| [docs/COMPLETE_PROJECT_SPEC.md](./docs/COMPLETE_PROJECT_SPEC.md) | Full engineering spec |
| [docs/GOOGLE_SIGNIN_SETUP.md](./docs/GOOGLE_SIGNIN_SETUP.md) | Google OAuth setup |
| [docs/TELEGRAM_SIGNIN_SETUP.md](./docs/TELEGRAM_SIGNIN_SETUP.md) | Telegram login setup |
| [DEPLOY.md](./DEPLOY.md) | Deployment guide |

---

## Key features

- **Ideas → Projects pipeline** with community voting, AI-generated tasks, and volunteer claiming
- **7-tab project workspace** (Overview, Discussion, Tasks, Document, Files, Contributors, Activity)
- **AI agent** analyzes ideas, generates tasks, reviews submissions, auto-replies to comments
- **Lion & Sun design system** — Iranian heritage theme with Iran flag palette
- **GitHub Discussions-style** threaded comments with emoji reactions
- **Trust levels** (New → Contributor → Reviewer → Lead) with auto-promotion
- **Bilingual** (English + Farsi) with full RTL support
- **Command palette** (Cmd+K) for quick search and navigation
- **Admin panel** with AI control, analytics charts, structured logs
- **Drop-in brand override** — swap logo by dropping files into `public/brand/custom/`

---

## Notes on GitHub Actions

The workflows in `.github/workflows/` (`agent.yml`, `sync-iranazadabad.yml`, `update-pipeline-stages.yml`) have their cron schedules **disabled by default** so the repo doesn't spam failure emails before secrets are configured. To re-enable them:

1. Add the required secrets under **Settings → Secrets and variables → Actions**:
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `GITHUB_BOT_TOKEN`
2. Uncomment the `schedule:` / `cron:` lines at the top of each workflow file.

---

## License

MIT
