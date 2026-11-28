import { describe, expect, it } from "vitest";
import { pictureDue, PICTURE_EVERY } from "../../src/editor/store";
describe("picture due", () => {
  it("is due when never taken", () => {
    expect(pictureDue(null, 1000)).toBe(true);
  });
  it("is not due within the window", () => {
    expect(pictureDue(10_000, 10_000 + PICTURE_EVERY - 1)).toBe(false);
  });
  it("is due once the window passes", () => {
    expect(pictureDue(10_000, 10_000 + PICTURE_EVERY)).toBe(true);
  });
});
