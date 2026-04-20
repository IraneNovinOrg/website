import { describe, it, expect } from "vitest";
import { extractMentionsFromTipTapJSON } from "@/lib/workspace/mentions";

describe("extractMentionsFromTipTapJSON", () => {
  it("pulls id + label out of two mention nodes in a nested document", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hey " },
            {
              type: "mention",
              attrs: { id: "user-1", label: "Alice" },
            },
            { type: "text", text: " and " },
            {
              type: "mention",
              attrs: { id: "user-2", label: "Bob" },
            },
            { type: "text", text: " please review this." },
          ],
        },
      ],
    };

    const out = extractMentionsFromTipTapJSON(doc);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ userId: "user-1", label: "Alice" });
    expect(out[1]).toEqual({ userId: "user-2", label: "Bob" });
  });

  it("deduplicates repeat mentions of the same user", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "user-1", label: "Alice" } },
            { type: "text", text: " and also " },
            { type: "mention", attrs: { id: "user-1", label: "Alice" } },
          ],
        },
      ],
    };
    expect(extractMentionsFromTipTapJSON(doc)).toEqual([
      { userId: "user-1", label: "Alice" },
    ]);
  });

  it("returns an empty array for null / non-object input", () => {
    expect(extractMentionsFromTipTapJSON(null)).toEqual([]);
    expect(extractMentionsFromTipTapJSON(undefined)).toEqual([]);
    expect(extractMentionsFromTipTapJSON("not a doc")).toEqual([]);
    expect(extractMentionsFromTipTapJSON(42)).toEqual([]);
  });

  it("silently ignores mention nodes with missing attrs.id", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "mention", attrs: { label: "Alice" } },
        { type: "mention", attrs: {} },
        { type: "mention" },
      ],
    };
    expect(extractMentionsFromTipTapJSON(doc)).toEqual([]);
  });
});
