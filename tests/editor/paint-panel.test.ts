import { describe, expect, it } from "vitest";
import { paintHint } from "../../src/editor/paint-tool";

describe("paintHint", () => {
  it("says what a click does in Bucket mode", () => {
    const hint = paintHint("bucket");
    expect(hint).toContain("Bucket:");
    expect(hint).toContain("every touching prim of the same look");
    expect(hint).toContain("terrain to fill it all");
    expect(hint).toContain("Alt+click picks up a look");
  });

  it("says what a drag does in Brush mode", () => {
    const hint = paintHint("brush");
    expect(hint).toContain("Paint:");
    expect(hint).toContain("drag on the terrain");
    expect(hint).toContain("Shift keeps the tool");
  });

  it("differs between modes", () => {
    expect(paintHint("bucket")).not.toBe(paintHint("brush"));
  });
});
