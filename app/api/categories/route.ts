/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";

export async function GET() {
  const db = getDb();

  // Get categories from both sources
  const ghCats = db.prepare(
    "SELECT id, name, emoji FROM github_categories ORDER BY name"
  ).all() as any[];

  const ideaCats = db.prepare(`
    SELECT category as name, category_emoji as emoji, COUNT(*) as count
    FROM ideas WHERE category IS NOT NULL AND category != ''
    GROUP BY LOWER(category) ORDER BY count DESC
  `).all() as any[];

  const emojiMap: Record<string, string> = {
    ":hash:": "#️⃣", ":bulb:": "💡", ":speech_balloon:": "💬",
    ":mega:": "📢", ":pray:": "🙏", ":raised_hands:": "🙌", ":ballot_box:": "🗳️",
  };

  // Deduplicate by lowercase name — prefer GitHub categories (they have proper IDs)
  const seen = new Set<string>();
  const deduped: { id: string; name: string; emoji: string }[] = [];

  for (const c of ghCats) {
    const key = (c.name || "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ id: c.id || c.name, name: c.name, emoji: emojiMap[c.emoji] || c.emoji || "#️⃣" });
  }

  // Add any idea categories not already covered
  for (const c of ideaCats) {
    const key = (c.name || "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ id: c.name, name: c.name, emoji: emojiMap[c.emoji] || c.emoji || "#️⃣" });
  }

  // Sort alphabetically
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { categories: deduped },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate" } }
  );
}
