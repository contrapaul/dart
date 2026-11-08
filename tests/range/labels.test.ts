import { describe, expect, it } from "vitest";
import { foamerLabel } from "../../src/range/labels";
import rigData from "../../data/foamer-rigs.json";

// PT-01 stage 2: the label above each Foamer shows its type and name from the
// data. Only the pure part is tested here (the module otherwise builds HTML
// and reads the camera, which the reviewer checks in the browser).

describe("PT-01 stage 2: the lineup label text", () => {
  it("every rig's name comes from data/foamer-rigs.json", () => {
    let named = 0;
    for (const r of rigData.rigs as { id: string; label: string }[]) {
      expect(foamerLabel(r.id)).toBe(r.label);
      if (r.label && r.label !== r.id) named++;
    }
    // F01 to F07 carry a name; F08 to F13 still hold their id as a
    // placeholder for Paul to write. The test would notice the field going
    // empty for all of them.
    expect(named).toBeGreaterThanOrEqual(7);
  });

  it("a type the data has no name for falls back to its id", () => {
    expect(foamerLabel("F99")).toBe("F99");
  });
});
