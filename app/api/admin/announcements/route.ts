/**
 * Admin: site-wide announcements.
 *   GET    → history (latest 50).
 *   POST   → create + optional fanout. Body:
 *            { title, body, linkUrl?, linkLabel?, severity?, endsAt?, fanoutAll? }
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  createAnnouncement,
  fanoutAnnouncement,
  listAnnouncements,
  type AnnouncementSeverity,
} from "@/lib/announcements";

const SEVERITIES = new Set(["info", "success", "warning"]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return NextResponse.json({ announcements: listAnnouncements(50) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    linkUrl?: string;
    linkLabel?: string;
    severity?: string;
    endsAt?: string;
    fanoutAll?: boolean;
  };

  const title = (body.title || "").trim();
  const text = (body.body || "").trim();
  if (!title || !text) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }
  if (title.length > 140) {
    return NextResponse.json({ error: "title too long (max 140)" }, { status: 400 });
  }
  if (text.length > 600) {
    return NextResponse.json({ error: "body too long (max 600)" }, { status: 400 });
  }

  const severity: AnnouncementSeverity = SEVERITIES.has(body.severity || "")
    ? (body.severity as AnnouncementSeverity)
    : "info";

  const announcement = createAnnouncement({
    title,
    body: text,
    linkUrl: body.linkUrl ? body.linkUrl.trim() : null,
    linkLabel: body.linkLabel ? body.linkLabel.trim() : null,
    severity,
    endsAt: body.endsAt || null,
    createdBy: session.user.email,
    fanoutAll: !!body.fanoutAll,
  });

  // Kick off fanout in the background so the admin's POST returns fast
  // even if the user base is large.
  fanoutAnnouncement(announcement, { fanoutAll: !!body.fanoutAll }).catch(
    (e) => console.error("[announcements] fanout failed:", e)
  );

  return NextResponse.json({ announcement });
}
