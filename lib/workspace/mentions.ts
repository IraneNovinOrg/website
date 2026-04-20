/**
 * Workspace V2 — Phase 4: Mention scanner.
 *
 * Given a TipTap JSON document, walk the node tree and extract every
 * `{ type: "mention", attrs: { id, label } }` node. The returned list is
 * deduplicated by user id.
 *
 * `syncMentions` is the glue between the extraction result and persistence:
 * it compares the extracted mentions to the existing rows in the `mentions`
 * table for the source, removes rows that no longer appear in the document,
 * inserts new ones, and creates a notification for each newly-mentioned user
 * (never re-notifying on duplicate saves). Self-mentions are skipped.
 */
import { getDb } from "@/lib/db";
import {
  listForSource,
  createMention,
  deleteMention,
} from "@/lib/db/mentions";
import { createNotification } from "@/lib/db/notifications";

export interface ExtractedMention {
  userId: string;
  label: string;
}

/**
 * Recursively walk a TipTap JSON document collecting every mention node.
 * Invalid / unexpected shapes are silently ignored so a single malformed
 * payload never crashes the save path.
 */
export function extractMentionsFromTipTapJSON(doc: unknown): ExtractedMention[] {
  const seen = new Set<string>();
  const out: ExtractedMention[] = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: unknown;
      attrs?: unknown;
      content?: unknown;
      marks?: unknown;
    };

    if (n.type === "mention" && n.attrs && typeof n.attrs === "object") {
      const attrs = n.attrs as { id?: unknown; label?: unknown };
      const id = typeof attrs.id === "string" ? attrs.id : null;
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push({
          userId: id,
          label:
            typeof attrs.label === "string" && attrs.label.length > 0
              ? attrs.label
              : id,
        });
      }
    }

    if (Array.isArray(n.content)) {
      for (const child of n.content) visit(child);
    }
    if (Array.isArray(n.marks)) {
      for (const mark of n.marks) visit(mark);
    }
  };

  try {
    if (Array.isArray(doc)) {
      for (const item of doc) visit(item);
    } else {
      visit(doc);
    }
  } catch {
    return [];
  }

  return out;
}

/**
 * Best-effort snippet extractor used when building notification bodies.
 * Walks the first ~200 text characters out of a TipTap JSON document.
 */
function extractTextSnippet(doc: unknown, max = 200): string {
  const parts: string[] = [];
  let remaining = max;

  const visit = (node: unknown): void => {
    if (remaining <= 0 || !node || typeof node !== "object") return;
    const n = node as {
      type?: unknown;
      text?: unknown;
      content?: unknown;
    };
    if (n.type === "text" && typeof n.text === "string") {
      const piece = n.text.slice(0, remaining);
      parts.push(piece);
      remaining -= piece.length;
      return;
    }
    if (Array.isArray(n.content)) {
      for (const c of n.content) {
        if (remaining <= 0) break;
        visit(c);
      }
    }
  };

  try {
    visit(doc);
  } catch {
    return "";
  }

  const txt = parts.join(" ").replace(/\s+/g, " ").trim();
  return txt.length > max ? txt.slice(0, max - 1) + "…" : txt;
}

/**
 * Reconcile the mention rows for a given source against the current document
 * contents. Any mention that disappeared from the doc is deleted; any new
 * mention is inserted and generates a notification for the mentioned user.
 *
 * Runs inside a single transaction so a partial failure rolls back cleanly.
 */
export async function syncMentions(
  sourceType: string,
  sourceId: string,
  authorId: string,
  contentJson: unknown,
  options: { url?: string; snippet?: string } = {}
): Promise<{ created: number }> {
  const extracted = extractMentionsFromTipTapJSON(contentJson);

  // Filter out self-mentions: the author is not notified of themselves.
  const filtered = extracted.filter((m) => m.userId !== authorId);

  const existing = listForSource(sourceType, sourceId);
  const existingIds = new Set(existing.map((m) => m.mentionedUserId));
  const newIds = new Set(filtered.map((m) => m.userId));

  const toInsert = filtered.filter((m) => !existingIds.has(m.userId));
  const toDelete = existing.filter((m) => !newIds.has(m.mentionedUserId));

  const snippet =
    options.snippet && options.snippet.length > 0
      ? options.snippet
      : extractTextSnippet(contentJson);
  const url = options.url ?? null;

  const db = getDb();

  let created = 0;
  const tx = db.transaction(() => {
    for (const m of toDelete) {
      deleteMention(m.id);
    }
    for (const m of toInsert) {
      createMention({
        sourceType,
        sourceId,
        mentionedUserId: m.userId,
        authorId,
      });
      createNotification({
        userId: m.userId,
        type: "mention",
        sourceType,
        sourceId,
        title: "You were mentioned",
        body: snippet || null,
        url,
      });
      created += 1;
    }
  });

  tx();
  return { created };
}
