// @vitest-environment node
// Opens every kitchen view in headless Edge at 375 and 1280 px, light and dark, and fails when text overlaps
// other text, a badge, a button or a shelf line. Skipped when Edge is not installed (set EDGE_PATH to point at it).
import { describe, expect, it } from "vitest";
import { edgeAvailable, runLayoutCheck } from "../../scripts/kitchen-shots/layout-check";

describe.skipIf(!edgeAvailable())("kitchen layout check (headless browser)", () => {
  it("has no overlapping text, badges, buttons or shelf lines in any view", async () => {
    const results = await runLayoutCheck();
    expect(results.length).toBeGreaterThanOrEqual(36);
    expect(results.every((r) => r.boxes > 0)).toBe(true);
    const clashes = results.flatMap((r) => r.clashes.map((c) => `${r.size}px ${r.theme} ${r.view}: ${c}`));
    expect(clashes).toEqual([]);
  }, 240_000);
});
