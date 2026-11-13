/** ED-03b: Foamers walk round hazards. A damaging hazard blocks its nav
 *  cells; a slow-only goo does not; a hidden hazard blocks nothing until it
 *  is shown, and setShown reports the rectangle the page rebakes. */
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { makeLevelAI } from "../../src/ai/level";
import { Hazards } from "../../src/level/hazards";
import type { Prim, PrimHazard } from "../../src/level/format";

const BOUNDS = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 };

function hazard(
  id: string,
  dps: number,
  opts: Partial<PrimHazard> = {},
  extra: Partial<Prim> = {},
): Prim {
  return {
    id,
    shape: "box",
    pos: [0, 0.5, 0],
    size: [2, 1, 2],
    colour: "#8cff3a",
    behaviour: "hazard",
    hazard: { dps, look: "toxic", ...opts },
    ...extra,
  };
}

function box(
  world: RAPIER.World,
  hx: number,
  hy: number,
  hz: number,
  x: number,
  y: number,
  z: number,
) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z), body);
}

function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  box(world, 6, 0.5, 6, 0, -0.5, 0);
  return world;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("ED-03b hazard blocking", () => {
  it("a lava box blocks its cells and leaves the cells round it walkable", () => {
    const world = makeWorld();
    const parent = new THREE.Group();
    const hazards = new Hazards([hazard("lava", 20)], parent);
    const ai = makeLevelAI(RAPIER, world, BOUNDS, "normal", undefined, undefined, hazards.blocksAt);

    expect(hazards.blocksAt(0, 0.5, 0)).toBe(true);
    expect(hazards.blocksAt(2.5, 0.5, 0)).toBe(false);
    expect(ai.grid.walkableAt(0, 0)).toBe(false);
    expect(ai.grid.walkableAt(2.5, 0)).toBe(true);
    expect(ai.grid.walkableAt(0, 2.5)).toBe(true);
  });

  it("a goo with dps 0 blocks nothing", () => {
    const world = makeWorld();
    const parent = new THREE.Group();
    const hazards = new Hazards([hazard("goo", 0)], parent);
    const ai = makeLevelAI(RAPIER, world, BOUNDS, "normal", undefined, undefined, hazards.blocksAt);

    expect(hazards.blocksAt(0, 0.5, 0)).toBe(false);
    expect(ai.grid.walkableAt(0, 0)).toBe(true);
  });

  it("a hidden hazard blocks nothing, then reports its rectangle when shown", () => {
    const world = makeWorld();
    const parent = new THREE.Group();
    const hazards = new Hazards([hazard("hidden", 20, {}, { hidden: true })], parent);
    const ai = makeLevelAI(RAPIER, world, BOUNDS, "normal", undefined, undefined, hazards.blocksAt);

    expect(ai.grid.walkableAt(0, 0)).toBe(true);

    let rect: { minX: number; minZ: number; maxX: number; maxZ: number } | null = null;
    hazards.onChanged = (minX, minZ, maxX, maxZ) => {
      rect = { minX, minZ, maxX, maxZ };
      ai.carveChanged(minX, minZ, maxX, maxZ);
    };
    hazards.setShown("hidden", true);

    expect(rect).toEqual({ minX: -1, minZ: -1, maxX: 1, maxZ: 1 });
    expect(hazards.blocksAt(0, 0.5, 0)).toBe(true);
    expect(ai.grid.walkableAt(0, 0)).toBe(false);
  });

  it("the reported rectangle follows the hazard's rotation", () => {
    const parent = new THREE.Group();
    const hazards = new Hazards(
      [hazard("rotated", 20, {}, { hidden: true, rot: [0, 45, 0] })],
      parent,
    );
    let rect: { minX: number; minZ: number; maxX: number; maxZ: number } | null = null;
    hazards.onChanged = (minX, minZ, maxX, maxZ) => {
      rect = { minX, minZ, maxX, maxZ };
    };
    hazards.setShown("rotated", true);

    const s = Math.sqrt(2);
    expect(rect!.minX).toBeCloseTo(-s, 6);
    expect(rect!.minZ).toBeCloseTo(-s, 6);
    expect(rect!.maxX).toBeCloseTo(s, 6);
    expect(rect!.maxZ).toBeCloseTo(s, 6);
  });

  it("with no extra test the bake is the same as before", () => {
    const world = makeWorld();
    const ai = makeLevelAI(RAPIER, world, BOUNDS, "normal");
    expect(ai.grid.walkableAt(0, 0)).toBe(true);
  });
});
