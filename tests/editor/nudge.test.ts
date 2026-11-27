import { describe, expect, it } from "vitest";
import { nudgeOffset } from "../../src/editor/nudge";

// Arrow key nudges: relative to where the camera looks, on the grid axes.

describe("arrow key nudges", () => {
  it("looking down -z (the editor's default), Up moves away and Right moves +x", () => {
    expect(nudgeOffset("ArrowUp", 0, -1, 0.5)).toEqual([0, 0, -0.5]);
    expect(nudgeOffset("ArrowDown", 0, -1, 0.5)).toEqual([0, 0, 0.5]);
    expect(nudgeOffset("ArrowRight", 0, -1, 0.5)).toEqual([0.5, 0, 0]);
    expect(nudgeOffset("ArrowLeft", 0, -1, 0.5)).toEqual([-0.5, 0, 0]);
  });

  it("follows the nearest grid axis when the camera is turned", () => {
    // Facing mostly +x: Up is +x and Right is +z.
    expect(nudgeOffset("ArrowUp", 0.9, 0.3, 1)).toEqual([1, 0, 0]);
    expect(nudgeOffset("ArrowRight", 0.9, 0.3, 1)).toEqual([0, 0, 1]);
    // Facing +z: Right is -x.
    expect(nudgeOffset("ArrowRight", 0.1, 1, 1)).toEqual([-1, 0, 0]);
  });

  it("PageUp and PageDown move up and down", () => {
    expect(nudgeOffset("PageUp", 0, -1, 0.5)).toEqual([0, 0.5, 0]);
    expect(nudgeOffset("PageDown", 0, -1, 0.5)).toEqual([0, -0.5, 0]);
  });

  it("looking straight down still has an away", () => {
    expect(nudgeOffset("ArrowUp", 0, 0, 1)).toEqual([0, 0, -1]);
  });
});
