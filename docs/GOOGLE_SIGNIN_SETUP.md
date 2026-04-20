# Google Sign-in Setup

## TL;DR — the "risky app" warning

When users see *"Google hasn't verified this app"* or *"This app is blocked"*, it means the Google Cloud OAuth Consent Screen is still in **Testing** mode or hasn't been submitted for verification. The sign-in code in this repo is correct — you just need to complete the Google Cloud console setup.

## What's in the codebase

- `lib/auth.ts` registers the Google provider when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars are set.
- `lib/auth.ts` jwt callback (the `account.provider === "google"` branch) creates/updates the user row in `users` and sets `token.dbId` so `/api/auth/me` returns a valid identity.

**No code changes are needed.** The problem is configuration on the Google side.

## One-time setup on Google Cloud

1. Go to https://console.cloud.google.com/ and select (or create) a project.

2. **OAuth consent screen**
   - User Type: **External**
   - App name: `IranENovin` (or any clear name)
   - User support email: your admin email
   - App logo: upload `public/brand/iranenovin_no_bg1_white_logo.png`
   - App domain: `iranenovin.com`
   - Authorized domains: add `iranenovin.com` (and your dev/preview domains if any)
   - Developer contact email: your admin email
   - Scopes: add only `openid`, `email`, `profile` — these are **non-sensitive** scopes and do NOT require Google verification.
   - Save.

3. **Credentials → Create OAuth client ID**
   - Application type: **Web application**
   - Name: `IranENovin Web`
   - Authorized JavaScript origins:
     - `https://iranenovin.com`
     - `http://localhost:3000` (for local dev)
   - Authorized redirect URIs:
     - `https://iranenovin.com/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
   - Create — copy the Client ID + Client Secret.

4. **Env vars** (add to `.env.local` in dev, Vercel project settings in prod):
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
   NEXTAUTH_URL=https://iranenovin.com
   NEXTAUTH_SECRET=<a random 32+ char string>
   ```

5. **Publish the OAuth consent screen**
   - Go to **OAuth consent screen → Publishing status** and click **Publish app**.
   - Because we only request `openid`, `email`, `profile` (non-sensitive scopes), Google **does not require verification** for this flow. Anyone can sign in immediately.
   - The warning goes away as soon as the app status is "In production".

## Testing

After env vars + console setup:
1. Restart the dev server (`pnpm dev`).
2. Click "Sign in → Google" — should redirect to Google, then back to `/`.
3. If you still see the warning, recheck that the consent screen is **Published**, not in "Testing" mode.

## Optional: request sensitive scopes later

If we ever need Gmail/Calendar/Drive scopes, we'd need to go through Google's verification (a one-time review, takes 2-6 weeks). For basic sign-in this is **not** needed.

## Where to look if sign-in fails

- Server logs: `lib/auth.ts` logs `[auth]` errors to console.
- Network tab in browser: the failing request is `POST /api/auth/callback/google`. Google's error JSON tells you what's wrong (redirect URI mismatch, invalid client, etc.).
- Check that `NEXTAUTH_URL` matches the actual deployed URL exactly (no trailing slash, right protocol).
