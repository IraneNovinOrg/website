# IranENovin Community Platform — Deployment Guide

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Git
- A GitHub account for the bot
- A Google Cloud project (for Google OAuth)
- A Resend account (for emails)

## 1. Clone and Install

```bash
git clone <your-repo-url>
cd iranenovin-community
pnpm install
```

## 2. GitHub Organization Setup

1. **Create GitHub Organization**: github.com → "+" → "New organization"
   - Name: `IranENovin`
   - Plan: Free

2. **Create `ideas` repo** in the org:
   - Initialize with README
   - Settings → Features → enable Discussions
   - Go to Discussions → Manage categories → set up:
     - AI, Education, Infrastructure, Health & Biotech, Finance, Energy, Agriculture, Smart Cities, Internet, Startup Ecosystem, Tourism, Art & Culture, Media, Manufacturing, General

3. **Create `iranenovin-bot` GitHub account**:
   - Add as org Owner
   - Go to Settings → Developer settings → Personal Access Tokens → Fine-grained
   - Scopes: Contents (read/write), Discussions (read/write), Issues (read/write), Members (read/write)
   - Save token as `GITHUB_BOT_TOKEN`

4. **Create GitHub OAuth App**:
   - github.com → Settings → Developer settings → OAuth Apps → New
   - Application name: IranENovin
   - Homepage URL: https://iranenovin.com
   - Authorization callback URL: https://iranenovin.com/api/auth/callback/github
   - Save Client ID + Secret

5. **Create Google OAuth App**:
   - console.cloud.google.com → New project → APIs & Services → Credentials
   - Create OAuth 2.0 Client ID → Web application
   - Authorized redirect URIs: https://iranenovin.com/api/auth/callback/google
   - Save Client ID + Secret

## 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`.

## 4. Get Discussion Category IDs

```bash
GITHUB_BOT_TOKEN=your-token GITHUB_ORG=IranENovin GITHUB_IDEAS_REPO=ideas node scripts/get-category-ids.js
```

Copy the appropriate category ID to `GITHUB_IDEAS_CATEGORY_ID` in `.env.local`.

## 5. Local Development

```bash
pnpm dev
```

Open http://localhost:3000 and verify:
- Homepage loads in both `/en` and `/fa`
- RTL works for Farsi
- Navigation works
- Sign in flows work (configure localhost callback URLs in OAuth apps)

## 6. Deploy to Vercel

1. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. Import to Vercel:
   - vercel.com → "Add New Project" → import the repo
   - Framework preset: Next.js (auto-detected)

3. Add environment variables in Vercel dashboard:
   - `NEXTAUTH_URL` = https://iranenovin.com
   - `NEXTAUTH_SECRET` = (generate with `openssl rand -base64 32`)
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GITHUB_BOT_TOKEN`
   - `GITHUB_ORG` = IranENovin
   - `GITHUB_IDEAS_REPO` = ideas
   - `GITHUB_IDEAS_CATEGORY_ID`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` = noreply@iranenovin.com
   - `NEXT_PUBLIC_APP_URL` = https://iranenovin.com
   - `NEXT_PUBLIC_COMMUNITY_PATH` = /community

4. Deploy!

## 7. Custom Domain

- Vercel → Project → Settings → Domains → add `iranenovin.com`
- Follow DNS instructions (add CNAME or A record)
- HTTPS is automatic

## 8. Post-Deploy Verification

- [ ] Homepage loads in both `/en` and `/fa` with correct RTL
- [ ] Category filter works
- [ ] Sign In with GitHub works end-to-end
- [ ] Sign In with Google works end-to-end
- [ ] Submit idea creates a GitHub Discussion
- [ ] Voting adds a reaction
- [ ] Anonymous suggestion creates a GitHub Issue
- [ ] Invite sends email via Resend
- [ ] All pages work on mobile (375px)
- [ ] Dark mode works
- [ ] Language switching works

## 9. Post-Launch

- Invite first members to the GitHub org
- Create initial ideas to seed the platform
- Share on social media
