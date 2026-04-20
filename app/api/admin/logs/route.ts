/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db/index";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const level = searchParams.get("level") || null;
  const limit = parseInt(searchParams.get("limit") || "50");

  const db = getDb();
  let query = "SELECT * FROM logs";
  const params: any[] = [];

  if (level) {
    query += " WHERE level = ?";
    params.push(level);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  try {
    const logs = db.prepare(query).all(...params);
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}
