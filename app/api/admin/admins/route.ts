/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, listAdmins, addAdmin, removeAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/db/index";
import { logInfo, logError } from "@/lib/logger";

/**
 * Admin management endpoint.
 *
 *   GET    /api/admin/admins           → { admins: string[] }
 *   POST   /api/admin/admins  { email } → { admins }  (adds)
 *   DELETE /api/admin/admins  { email } → { admins }  (removes)
 *
 * All routes admin-gated. Delete refuses to remove the last admin or the
 * caller's own email (prevents lockout). Source of truth is
 * `_config/ai.json` via `lib/admin.ts`.
 */

// Simple but effective — matches "a@b.c" shape. We deliberately don't do
// elaborate RFC-5322 validation; downstream `addAdmin()` also checks.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { ok: false as const, res: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.res;

  try {
    return NextResponse.json({ admins: listAdmins() });
  } catch (e) {
    logError(`List admins failed: ${(e as Error).message}`, "admin-admins");
    return NextResponse.json({ error: "Failed to list admins" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.res;
  const { session } = gate;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalize(body?.email);
  if (!email) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const added = addAdmin(email);
    if (!added) {
      return NextResponse.json({ error: "Already an admin", admins: listAdmins() }, { status: 409 });
    }

    logActivity({
      eventType: "admin_added",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email || "admin",
      details: JSON.stringify({ email }),
    });
    logInfo(`Admin added: ${email} (by ${session.user.email})`, "admin-admins");

    return NextResponse.json({ admins: listAdmins() });
  } catch (e) {
    logError(`Add admin failed: ${(e as Error).message}`, "admin-admins");
    return NextResponse.json(
      { error: (e as Error).message || "Failed to add admin" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireAdminSession();
  if (!gate.ok) return gate.res;
  const { session } = gate;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalize(body?.email);
  if (!email) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const callerEmail = (session.user.email || "").trim().toLowerCase();
  if (email === callerEmail) {
    return NextResponse.json(
      { error: "You cannot remove your own admin access" },
      { status: 400 }
    );
  }

  const current = listAdmins();
  if (current.length <= 1) {
    return NextResponse.json({ error: "Cannot remove last admin" }, { status: 400 });
  }
  if (!current.includes(email)) {
    return NextResponse.json({ error: "Not an admin", admins: current }, { status: 404 });
  }

  try {
    const removed = removeAdmin(email);
    if (!removed) {
      return NextResponse.json({ error: "Not an admin", admins: listAdmins() }, { status: 404 });
    }

    logActivity({
      eventType: "admin_removed",
      actorId: (session.user as any).id,
      actorName: session.user.name || session.user.email || "admin",
      details: JSON.stringify({ email }),
    });
    logInfo(`Admin removed: ${email} (by ${session.user.email})`, "admin-admins");

    return NextResponse.json({ admins: listAdmins() });
  } catch (e) {
    logError(`Remove admin failed: ${(e as Error).message}`, "admin-admins");
    return NextResponse.json(
      { error: (e as Error).message || "Failed to remove admin" },
      { status: 500 }
    );
  }
}
