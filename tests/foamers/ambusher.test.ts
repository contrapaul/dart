import { describe, expect, it } from "vitest";
import { specFor } from "../../src/foamers/foamers";
import { buildPartVolume, rigHeight } from "../../src/foamers/rig";
import type { GameRig } from "../../src/foamers/foamer";
import { materialId } from "../../src/voxel/materials";
import { VoxelVolume } from "../../src/voxel/chunk";
import rigData from "../../data/foamer-rigs.json";
import playerData from "../../data/player.json";

// GAME-10m stage 1: the Ambusher's look and type. The look is Paul's F12
// row (CONTENT-PLAN 3): a lean biped a little taller than the player, deep
// purple body, a row of small orange spines down the back, a narrow head
// with lime eyes. Stage 1 stops at the look and the type: the pounce comes
// in stage 2. The PNGs in design/foamers/ were not checked by eye (no
// browser here): the numbers below are how the build's was checked.

const RIG = (rigData.rigs as unknown as GameRig[]).find((r) => r.id === "F12");
const SPEC = specFor("F12");
const part = (id: string) => RIG!.parts.find((p) => p.id === id);

describe("GAME-10m stage 1: the F12 type", () => {
  it("reads its own spec: rig F12, health 25, speed 3, no weak point", () => {
    expect(RIG).not.toBeUndefined();
    expect(SPEC.rig).toBe("F12");
    expect(RIG!.health).toBe(25);
    expect(RIG!.speed).toBe(3);
    expect((SPEC as { weakpoint?: unknown }).weakpoint).toBeUndefined();
    // It claws with the composite claws: the two forearms live on.
    for (const id of ["foreArmL", "foreArmR"]) expect(RIG!.parts.some((p) => p.id === id)).toBe(true);
  });
});

describe("GAME-10m stage 1: the F12 look", () => {
  it("is a little taller than the player, on both feet", () => {
    const h = rigHeight(RIG!);
    expect(h).toBeGreaterThan((playerData as { height: number }).height);
    expect(h).toBeLessThan((playerData as { height: number }).height * 1.3);
    // Both feet are flatBottom ellipses and they sit on the floor.
    for (const id of ["footL", "footR"]) {
      expect(part(id)!.flatBottom).toBe(true);
      expect(part(id)!.parent).toBe(id === "footL" ? "shinL" : "shinR");
    }
  });

  it("wears the deep purple body and the palette's lime on the head", () => {
    expect(RIG!.material).toBe("foam-purple-deep");
    expect(part("visor")?.material).toBe("foam-lime");
  });

  it("has a row of small orange spines down the back, kept small", () => {
    const spines = ["spine1", "spine2", "spine3"].map((id) => part(id)!);
    for (const s of spines) {
      expect(s.material).toBe("foam-orange");
      expect(s.parent).toBe("body");
      // Small: no more than 6 voxels tall, 4 wide (0.3 m / 0.2 m).
      expect(s.size[1]).toBeLessThanOrEqual(6);
      expect(s.size[0]).toBeLessThanOrEqual(4);
      // Down the back: the joint sits on the upper back (-z) of the body.
      expect(s.at![1]).toBeGreaterThanOrEqual(-0.6);
      expect(s.at![1]).toBeLessThanOrEqual(0.4);
      expect(s.at![2]).toBeLessThan(-0.5);
      // Leans back a little out of the body, not forward into it.
      expect(s.rest![0]).toBeLessThan(0);
      expect(s.rest![0]).toBeGreaterThan(-1.6);
    }
    // A row: three of them.
    expect(RIG!.parts.filter((p) => p.id.startsWith("spine")).length).toBe(3);
  });

  it("faces forward with the painted eyes, one on each side of the middle", () => {
    const head = part("head")!;
    expect(head.eyes).toBe("angry");
    const vol = new VoxelVolume(RIG!.voxelSize);
    buildPartVolume(vol, head, RIG!.material);
    const white = materialId("foam-white");
    let count = 0, minX = 99, maxX = -99;
    for (let y = 0; y < head.size[1]; y++) for (let x = 0; x < head.size[0]; x++) for (let z = 0; z < head.size[2]; z++) {
      if (vol.get(x, y, z) !== white) continue;
      count += 1;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    }
    expect(count).toBeGreaterThan(0);
    expect(minX).toBeLessThan((head.size[0] - 1) / 2);
    expect(maxX).toBeGreaterThan((head.size[0] - 1) / 2);
  });
});
