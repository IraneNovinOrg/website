import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { loadTemplate, saveTemplate } from "@/lib/github-invite";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return NextResponse.json(loadTemplate());
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    body?: string;
  };
  const saved = saveTemplate({
    enabled: body.enabled !== false,
    body: body.body ?? "",
  });
  return NextResponse.json(saved);
}
