import { describe, expect, it } from "vitest";
import { buildPalette, material, materialId } from "../../src/voxel/materials";

describe("material palette", () => {
  it("loads data/materials.json", () => {
    const foam = material(materialId("foam-orange"))!;
    expect(foam.color).toBe(0xff7a1a);
    expect(foam.indestructible).toBe(false);
    expect(material(materialId("bedrock"))!.indestructible).toBe(true);
    expect(material(0)).toBeUndefined();
  });

  it("rejects bad ids and duplicates", () => {
    const m = (id: number, name: string) => ({ id, name, color: "#ffffff", hardness: 1 });
    expect(() => buildPalette([m(0, "a")])).toThrow(/1 to 255/);
    expect(() => buildPalette([m(256, "a")])).toThrow(/1 to 255/);
    expect(() => buildPalette([m(1, "a"), m(1, "b")])).toThrow(/already used/);
    expect(() => buildPalette([m(1, "a"), m(2, "a")])).toThrow(/used twice/);
  });

  it("throws on an unknown name", () => {
    expect(() => materialId("cheese")).toThrow(/unknown/);
  });
});
