/**
 * Public: returns the currently-active banner announcement, or 204 if none.
 * Client caches briefly; banner is dismissable per-user via localStorage.
 */

import { NextResponse } from "next/server";
import { getActiveAnnouncement } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export async function GET() {
  const announcement = getActiveAnnouncement();
  return NextResponse.json(
    { announcement },
    {
      headers: {
        // Shared CDN cache for 30s + SWR: the banner is safe to cache across
        // users since dismissal state lives on the client.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    }
  );
}
