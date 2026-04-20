"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { SWRConfig } from "swr";
import { Toaster } from "sonner";

const swrFetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);
  return r.json();
};

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  // Server-rendered session passed down from the locale layout. When set,
  // `useSession()` returns `{ data: session, status: "authenticated" }` on
  // the very first client render — no flash of signed-out state when a
  // user reopens a tab while their JWT cookie is still valid.
  session?: Session | null;
}) {
  return (
    // refetchInterval=0 disables the default 4-min session re-poll, and
    // refetchOnWindowFocus=false stops `/api/auth/session` from re-firing
    // every time the user Alt-Tabs. useSession() still updates optimistically
    // via signIn/signOut; explicit reloads use `router.refresh()`.
    <SessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <SWRConfig
        value={{
          fetcher: swrFetcher,
          // 10s global dedupe: multiple components hitting the same endpoint
          // (e.g. Navbar + page) share one in-flight request instead of
          // firing duplicate GETs.
          dedupingInterval: 10_000,
          // Don't refetch on every tab focus — user-initiated actions
          // (clicking the bell, switching tabs) call mutate() explicitly.
          revalidateOnFocus: false,
          // Keep refetching on reconnect (cheap, and correct behavior after
          // a laptop wakes from sleep).
          revalidateOnReconnect: true,
          // Disabled by default; individual hooks opt in via refreshInterval.
          refreshInterval: 0,
          errorRetryCount: 2,
        }}
      >
        {children}
        <Toaster richColors position="top-center" />
      </SWRConfig>
    </SessionProvider>
  );
}
