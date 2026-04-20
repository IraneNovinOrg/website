import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

/**
 * Returns the current user's capabilities. Used by the UI to gate admin/lead
 * controls without exposing the admin list to the client.
 *
 * Optional `?ideaId=...` adds `isLead` and `canManage` for a specific project.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const email = session.user.email || null;
  const ideaId = request.nextUrl.searchParams.get("ideaId");

  let profileCompleted = false;
  let profileCompleteness = 0;
  let isLead = false;
  try {
    const { getDb } = await import("@/lib/db/index");
    const db = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = session.user.id
      ? db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id)
      : email
        ? db.prepare("SELECT * FROM users WHERE email = ?").get(email)
        : null;
    profileCompleted = !!row?.profile_completed;

    // Heuristic completeness score — each signal counts ~14-17%
    if (row) {
      const parseArr = (v: unknown): unknown[] => {
        if (Array.isArray(v)) return v;
        if (typeof v === "string" && v) { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
        return [];
      };
      const signals = [
        !!row.name && String(row.name).length > 1,
        !!row.avatar_url,
        !!row.bio && String(row.bio).length > 10,
        parseArr(row.skills).length > 0,
        !!row.location,
        parseArr(row.languages).length > 0,
        parseArr(row.categories).length > 0,
      ];
      const filled = signals.filter(Boolean).length;
      profileCompleteness = Math.round((filled / signals.length) * 100);
    }

    if (ideaId) {
      const { isProjectLead } = await import("@/lib/permissions/project");
      isLead = isProjectLead(session, ideaId);
    }
  } catch {
    /* ignore */
  }

  const admin = isAdmin(email);

  return NextResponse.json(
    {
      authenticated: true,
      email,
      name: session.user.name || null,
      image: session.user.image || null,
      isAdmin: admin,
      isLead,
      canManage: admin || isLead,
      profileCompleted,
      profileCompleteness,
      // Show the reminder bubble only when profile is < 40% complete
      needsProfileAttention: !profileCompleted && profileCompleteness < 40,
    },
    {
      // Per-user response — allow the browser to cache for 30s, and allow
      // stale-while-revalidate so the bubble never blocks navigation.
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    }
  );
}
