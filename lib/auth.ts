import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { GITHUB_ORG, GITHUB_BOT_TOKEN } from "./constants";
import { verifyUser, upsertOAuthUser } from "./db";
import { consumeLoginSession } from "./telegram/login-session";
import { upsertTelegramUser } from "./db/index";
import {
  REMEMBER_COOKIE,
  REMEMBER_TTL_LONG_SEC,
  REMEMBER_TTL_SHORT_SEC,
} from "./auth/remember";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubLogin?: string | null;
      accessToken?: string | null;
      isOrgMember?: boolean;
      provider?: string;
    };
  }
}

// In-memory cache: email -> users.id. A JWT lives for the session duration
// so this map trades stale reads (rare: only matters if the user's DB id
// changes, which never happens) for skipping a SQLite round-trip on every
// session poll.
const emailToDbId = new Map<string, string>();

const providers: Provider[] = [];

// Email/password login
providers.push(
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await verifyUser(
        credentials.email as string,
        credentials.password as string
      );
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar_url,
      };
    },
  })
);

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    })
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

// Telegram deep-link sign-in. Browser calls this once the user has tapped
// "Yes" in the bot — by then the matching row in `telegram_login_sessions`
// is in status="confirmed" with the Telegram profile attached. We atomically
// consume the token (single-use) and upsert the users row keyed by the
// Telegram chat id.
if (process.env.TELEGRAM_BOT_TOKEN) {
  providers.push(
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        token: { label: "token", type: "text" },
      },
      async authorize(credentials) {
        const token = (credentials?.token as string) || "";
        if (!token) return null;

        const session = consumeLoginSession(token);
        if (!session || !session.tgChatId) return null;

        const user = upsertTelegramUser({
          telegramId: session.tgChatId,
          firstName: session.tgFirstName,
          lastName: session.tgLastName,
          username: session.tgUsername,
          photoUrl: session.tgPhotoUrl,
        });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar_url,
        };
      },
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: {
    strategy: "jwt",
    // Cookie ceiling — 30 days. The JWT's `exp` claim (set in the callback
    // below) is what actually invalidates a short-session user early.
    maxAge: REMEMBER_TTL_LONG_SEC,
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // First sign-in: stash the remember-me preference from the cookie the
      // client set just before calling signIn(). If the cookie is missing,
      // default to `true` — users on their own device are the majority case.
      if (account) {
        try {
          const { cookies } = await import("next/headers");
          // cookies() is synchronous in a NextAuth callback (request context).
          const remember = cookies().get(REMEMBER_COOKIE)?.value !== "0";
          token.rememberMe = remember;
        } catch {
          // `cookies()` can throw outside a request scope — fall back to long.
          token.rememberMe = true;
        }
        // Reset issued-at so `exp` below reflects this sign-in.
        token.iat = Math.floor(Date.now() / 1000);
      }

      // Keep `exp` in sync with the current remember flag on every token
      // read. Without this, NextAuth's rolling refresh would extend the
      // session past the user's choice. Backward-compat: pre-existing
      // tokens without `rememberMe` default to long.
      const rememberMe = token.rememberMe !== false;
      const ttl = rememberMe ? REMEMBER_TTL_LONG_SEC : REMEMBER_TTL_SHORT_SEC;
      const iat =
        typeof token.iat === "number"
          ? (token.iat as number)
          : Math.floor(Date.now() / 1000);
      token.iat = iat;
      token.exp = iat + ttl;

      // Provider-specific fields, applied once at sign-in time.
      if (account) {
        if (account.provider === "github") {
          token.accessToken = account.access_token;
          token.githubLogin =
            (profile as { login?: string })?.login || null;
          token.provider = "github";

          // Sync to DB
          if (user?.email) {
            const dbUser = await upsertOAuthUser({
              email: user.email,
              name: user.name,
              avatar_url: user.image,
              github_login: token.githubLogin as string,
              provider: "github",
            });
            if (dbUser) token.dbId = dbUser.id;
          }

          // Add to GitHub org
          if (token.githubLogin && GITHUB_BOT_TOKEN) {
            try {
              await fetch(
                `https://api.github.com/orgs/${GITHUB_ORG}/memberships/${token.githubLogin}`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
                    Accept: "application/vnd.github.v3+json",
                  },
                  body: JSON.stringify({ role: "member" }),
                }
              );
            } catch (e) {
              console.error("Failed to add user to org:", e);
            }
          }
        } else if (account.provider === "google") {
          token.githubLogin = null;
          token.provider = "google";

          if (user?.email) {
            const dbUser = await upsertOAuthUser({
              email: user.email,
              name: user.name,
              avatar_url: user.image,
              provider: "google",
            });
            if (dbUser) token.dbId = dbUser.id;
          }
        } else if (account.provider === "telegram") {
          token.provider = "telegram";
          token.dbId = user?.id;
        } else if (account.provider === "credentials") {
          token.provider = "email";
          token.dbId = user?.id;
        }
      }

      // Fallback: if dbId wasn't set by any provider, look up by email — but
      // cache the lookup in-memory so subsequent /api/auth/session calls on
      // the same JWT don't re-hit SQLite on every poll.
      if (!token.dbId && token.email) {
        const cached = emailToDbId.get(token.email as string);
        if (cached) {
          token.dbId = cached;
        } else {
          try {
            const { getDb } = await import("./db/index");
            const db = getDb();
            const fallbackUser = db
              .prepare("SELECT id FROM users WHERE email = ?")
              .get(token.email as string) as { id: string } | undefined;
            if (fallbackUser) {
              token.dbId = fallbackUser.id;
              emailToDbId.set(token.email as string, fallbackUser.id);
            }
          } catch { /* ok — db may not be ready */ }
        }
      }

      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).id = (token.dbId as string) || undefined;
      session.user.githubLogin = (token.githubLogin as string) || null;
      session.user.accessToken = (token.accessToken as string) || null;
      session.user.isOrgMember = !!token.githubLogin;
      session.user.provider = (token.provider as string) || undefined;
      return session;
    },
  },
  trustHost: true,
  // Debug logging adds meaningful per-request overhead (it stringifies and
  // prints the full JWT on every session call). Opt-in via NEXTAUTH_DEBUG=1.
  debug: process.env.NEXTAUTH_DEBUG === "1",
});
