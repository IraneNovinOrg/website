import { describe, it, expect } from "vitest";
import { STATUS_STYLES, STATUS_LABELS } from "@/components/projects/constants";

describe("projects/constants", () => {
  it("exports a style class for each known status label", () => {
    for (const key of Object.keys(STATUS_LABELS)) {
      expect(STATUS_STYLES[key]).toBeTypeOf("string");
      expect(STATUS_STYLES[key].length).toBeGreaterThan(0);
    }
  });

  it("defines labels for active, needs-contributors, and completed", () => {
    expect(STATUS_LABELS.active).toBeDefined();
    expect(STATUS_LABELS["needs-contributors"]).toBeDefined();
    expect(STATUS_LABELS.completed).toBeDefined();
  });
});
