# Telegram Sign-in Setup

IranENovin supports "Continue with Telegram" alongside GitHub + Google. It uses a **deep-link-via-bot** flow — the user taps a link or scans a QR, the bot asks them to confirm inside Telegram, and they're signed in. **No phone number prompt. No BotFather domain setup.**

## What's in the codebase (no changes needed)

- `lib/telegram/login-session.ts` — pending → confirmed → consumed state machine backed by `telegram_login_sessions` (10-min TTL, single-use tokens).
- `lib/telegram/bot.ts` — handles `/start login_<token>` + Yes/No confirm buttons.
- `app/api/auth/telegram/start/route.ts` — starts a session, returns `{ token, deepLink, appLink, expiresAt }`.
- `app/api/auth/telegram/poll/route.ts` — browser polls status every 2s.
- `lib/auth.ts` — NextAuth `Credentials` provider `id: "telegram"` that consumes a confirmed token and upserts the user.
- `lib/db/index.ts → upsertTelegramUser()` — creates/refreshes the `users` row keyed by `telegram_chat_id`. Uses a synthetic email (`tg-<id>@telegram.iranenovin.local`) only to satisfy NOT NULL UNIQUE; never shown, never sent.
- `components/auth/TelegramLoginButton.tsx` — the UI panel with QR + "Open Telegram" button + live status.
- `components/auth/AuthModal.tsx` — renders the button under GitHub + Google.

## One-time setup

### 1. Create / pick a Telegram bot

Use your existing bot (same `TELEGRAM_BOT_TOKEN` that runs notifications). If you need a new one:

1. Open a chat with [@BotFather](https://t.me/BotFather).
2. `/newbot` → pick a name + `@username` ending in `bot`.
3. Copy the token.

That's it — no `/setdomain`, no widget iframe, nothing else.

### 2. Env vars

```env
# Same token your notification bot uses
TELEGRAM_BOT_TOKEN=123456:ABC-DEF…

# The bot's username without the leading "@".
# NEXT_PUBLIC_ so the client can build the t.me link locally.
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=IranENovinBot
```

Restart dev server / redeploy. The button appears in the sign-in modal as soon as both vars are present; it's inert without them (never shown to users).

## How the flow works

1. User clicks **Continue with Telegram**.
2. Server generates a 24-byte token, inserts a row in `telegram_login_sessions` with `status=pending`, TTL 10 min.
3. UI renders:
   - A QR code encoding `https://t.me/<bot>?start=login_<token>`.
   - An "Open Telegram" button with the same URL.
   - A live spinner.
4. User scans / clicks. Telegram opens the bot. The bot receives `/start login_<token>`.
5. Bot verifies the token exists and is still pending, then replies with "Hi {name}! Someone is trying to sign in … [✅ Yes] [❌ Not me]".
6. User taps **Yes**. Bot:
   - Fetches the user's first profile photo if available (via `getUserProfilePhotos`).
   - Calls `confirmLoginSession(token, { chatId, username, firstName, lastName, photoUrl })` → row flips to `status=confirmed`.
   - Edits the message to "✅ Signed in — you can return to IranENovin."
7. Browser's 2-second poll sees `status=confirmed`. It calls `signIn("telegram", { token })`.
8. NextAuth authorize() runs `consumeLoginSession(token)` atomically — flips to `consumed`. Then `upsertTelegramUser()` creates or refreshes the user row.
9. JWT session issued, tab reloads, user is signed in.

## Security properties

- **One-time use**: `consumeLoginSession` uses a SQL `UPDATE … WHERE status='confirmed'` with `info.changes === 0` check, so a stolen token cannot be replayed.
- **Short TTL**: 10 minutes, enforced at both `getLoginSession` and `confirmLoginSession`.
- **Confirm-before-sign**: the bot always shows a Yes/No prompt, so even if an attacker tricks a user into opening their link, nothing happens until the real user taps Yes inside their own Telegram session.
- **Server-only identity**: the Telegram chat id never leaves the server — the browser only sees an opaque `token`.
- **Rate-limited start**: `/api/auth/telegram/start` is IP-limited to 20/hour via `limitOrRespond` to prevent token-flooding.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| "Telegram sign-in is not configured" on POST /start | missing `TELEGRAM_BOT_TOKEN` or `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Set both env vars, restart. |
| Button mounts but scan opens wrong bot | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` disagrees with the token | They must belong to the same bot. |
| Bot never replies to `/start login_<token>` | Bot not running (check instrumentation logs) OR webhook mode with bad URL | See bot init logs; dev uses long polling. |
| User taps Yes but website stays "Waiting…" | Bot processed message but DB write silently failed | Check server logs for `[telegram]` errors; verify `telegram_login_sessions` row exists. |

## Account linking

Users who signed in via Telegram get a synthetic email (`tg-<id>@telegram.iranenovin.local`). They can't currently merge with an existing GitHub/Google account — the natural place to add this is an "add a login method" section on the profile page that links the Telegram chat id to the signed-in user's row.

Users who signed up *first* with email/GitHub/Google and *then* linked Telegram via the bot's `/link` flow keep their original identity. Both the login flow and the `/link` flow write to the same `users.telegram_chat_id` column, so there's no dual-row risk.
