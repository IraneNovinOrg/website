import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = db.prepare("SELECT stage, COUNT(*) as count FROM ideas GROUP BY stage").all() as any[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.stage] = r.count;
  return NextResponse.json(counts, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
  });
}
