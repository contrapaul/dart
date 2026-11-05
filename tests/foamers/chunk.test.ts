import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import {
  judgeChunk, shotSummary, addShotDamage, chunkRadius, type ShotDamage,
} from "../../src/foamers/chunk";
import { resolveSpec } from "../../src/weapons/blaster";
import foamerData from "../../data/foamers.json";
import destruction from "../../data/destruction.json";

// GAME-09b: the chunk finish. A close shot from a blaster or mod with a
// chunk block blows a hole through a Heavy, Elite or already weakened
// Foamer and it goes down with the hole in it, instead of a plain go down.
// The numbers are data (data/blasters.json, data/foamers.json); these
// tests only check that the rule reads them.

const DT = 1 / 60;
const BASE = foamerData.test;
const CHUNK = BASE.catastrophic.chunk;
const B03 = resolveSpec("B03").chunk!;
const SLUG = resolveSpec("B01", ["slug"]).chunk!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
}

/** World, floor, darts and the Foamer system, as finisher.test.ts builds
 *  them. No pickups or finisher: this card only reads the hit path. */
function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const scene = new THREE.Scene();
  const darts = new DartSystem(scene, world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  world.step();
  return { world, darts, debris, foamers, targets };
}

const eye = new THREE.Vector3(0, 1.6, 30);

function tick(r: ReturnType<typeof rig>, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, eye);
  r.world.step();
}

/** Spawn a Foamer and let every part build its collider, so a dart can
 *  carve it (a part with no collider is not hit at all). */
async function spawn(r: ReturnType<typeof rig>, type = "F01", at = new THREE.Vector3(0, 0, 0)) {
  const f = r.foamers.spawn(at, eye, type)!;
  for (const part of f.parts.values()) await settle(part.mesh, r.world);
  return f;
}

/** Fire one shot's worth of darts at the body's front from `from` metres out
 *  (the muzzle, in the test, is the firing point). `count` darts all carry
 *  the same shot id, the way blaster.ts tags one trigger pull. */
function shot(
  r: ReturnType<typeof rig>,
  f: Foamer,
  from: number,
  chunk: import("../../src/weapons/darts").ShotChunk | null = B03,
  count = 8,
  type: "standard" | "slug" = "standard",
) {
  const body = f.parts.get("body")!;
  const c = body.voxelToWorld(new THREE.Vector3(
    body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] / 2));
  const muzzle = new THREE.Vector3(c.x, c.y, c.z + from);
  const tag = { id: 900, muzzle, chunk };
  for (let i = 0; i < count; i++) {
    r.darts.fire(muzzle, new THREE.Vector3(0, 0, -1), type, tag);
  }
  return { muzzle, tag };
}

function stepUntilSettled(r: ReturnType<typeof rig>, f: Foamer, max = 240) {
  for (let i = 0; i < max && f.state !== "down"; i++) tick(r);
  for (let i = 0; i < 6; i++) tick(r);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("GAME-09b: the rule, as data", () => {
  it("1. the data has the blocks the card asks for", () => {
    expect(B03.rangeMetres).toBe(5);
    expect(SLUG.rangeMetres).toBe(8);
    expect(CHUNK.minShare).toBe(0.25);
    expect(CHUNK.tiers).toContain("Heavy");
    expect(CHUNK.tiers).toContain("Elite");
    expect(CHUNK.tiers).not.toContain("Fodder");
    expect(CHUNK.debrisMax).toBeLessThanOrEqual(destruction.debris.max);
    // The plain B01 cannot chunk; its slug mod can.
    expect(resolveSpec("B01").chunk).toBeNull();
    expect(resolveSpec("B04").chunk).toBeNull();
  });

  it("2. judgeChunk: tier or finishable, share, range", () => {
    const m = new THREE.Vector3(0, 0, 0);
    const muzzle = new THREE.Vector3(0, 0, 4);
    const at = (o: Partial<Parameters<typeof judgeChunk>[0] & object> = {}) =>
      judgeChunk({ ...CHUNK, ...o }, B03, muzzle, "Heavy", false, 30, 8, m);
    expect(at()).toBe(true); // a Heavy, a quarter of its health, 4 m out
    expect(at({ tiers: ["Elite"] })).toBe(false); // a Fodder tier, not weakened
    expect(judgeChunk(CHUNK, B03, muzzle, "Fodder", true, 30, 8, m)).toBe(true);
    expect(at({ minShare: 0.5 })).toBe(false); // 8 is under half of 30
    // Past the blaster's range: the muzzle is measured, not the player.
    expect(judgeChunk(CHUNK, B03, new THREE.Vector3(0, 0, 6), "Heavy", false, 30, 8, m))
      .toBe(false);
    // No chunk block: never.
    expect(judgeChunk(CHUNK, null, muzzle, "Heavy", true, 30, 30, m)).toBe(false);
  });

  it("3. shotSummary adds only that shot's darts inside the window", () => {
    const d: ShotDamage[] = [];
    addShotDamage(d, 1, 10, 2, new THREE.Vector3(0, 0, 0), true);
    addShotDamage(d, 1, 10, 3, new THREE.Vector3(2, 0, 0), false);
    addShotDamage(d, 2, 10, 100, new THREE.Vector3(0, 9, 0), false); // another shot
    addShotDamage(d, 1, 5, 100, new THREE.Vector3(0, 9, 0), false); // outside the window
    const sum = shotSummary(d, 1, 10.05, 0.1)!;
    expect(sum.total).toBe(5);
    expect(sum.mean.x).toBeCloseTo(1, 6);
    expect(sum.mean.y).toBeCloseTo(0, 6);
    expect(shotSummary(d, 3, 10.05, 0.1)).toBeNull();
  });

  it("4. chunkRadius takes the larger of the base and the blaster", () => {
    expect(chunkRadius(CHUNK, B03)).toBe(B03.carveRadius);
    expect(chunkRadius({ ...CHUNK, carveRadius: 0.5 }, B03)).toBe(0.5);
  });
});

describe("GAME-09b: the chunk finish", () => {
  it("5. a close B03 shot that kills an F05 blows a hole and goes down", async () => {
    const r = rig();
    const f = await spawn(r, "F05");
    // Heavily weakened but not finishable (0.3 of 30 is 9): the tier alone
    // must carry this, and one shot must be the killer.
    f.health = 10;
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    shot(r, f, 3);
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    expect(f.rig.tier).toBe("Heavy");
    expect(r.foamers.stats.chunks).toBe(1);
    // The hole: the body lost voxels where the shot hit.
    expect(body.voxelCount).toBeLessThan(before);
    // A chunk is never a pop.
    expect(r.foamers.stats.popped).toBe(0);
    expect(r.foamers.downed).toContain(f);
  });

  it("6. the same shot from beyond rangeMetres is a plain go down", async () => {
    const r = rig();
    const f = await spawn(r, "F05");
    f.health = 10;
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    shot(r, f, 8); // B03 reaches 5 m
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    expect(r.foamers.stats.chunks).toBe(0);
    // No chunk carve: only the darts' own small carves touched it, if any.
    const lost = before - body.voxelCount;
    expect(lost).toBeLessThan(before * 0.6);
  });

  it("7. a B03 kill on a full health F01 is a go down; on a weakened one a chunk", async () => {
    const r = rig();
    const f = await spawn(r, "F01");
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    shot(r, f, 3);
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    // Fodder, full health: no chunk finish, only the darts' own carves.
    expect(r.foamers.stats.chunks).toBe(0);
    expect(before - body.voxelCount).toBeLessThan(before * 0.6);
    expect(r.foamers.stats.popped).toBe(0);

    const r2 = rig();
    const g = await spawn(r2, "F01");
    g.finishWeakened = true;
    g.health = 3;
    const gb = g.parts.get("body")!;
    const gBefore = gb.voxelCount;
    shot(r2, g, 3);
    stepUntilSettled(r2, g);
    expect(g.state).toBe("down");
    expect(gb.voxelCount).toBeLessThan(gBefore);
    expect(r2.foamers.stats.chunks).toBe(1);
  });

  it("8. the slug mod qualifies, the plain B01 does not", async () => {
    const r = rig();
    const f = await spawn(r, "F01");
    f.finishWeakened = true;
    f.health = 4;
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    // The plain B01's slug-sized hit with no chunk block: its own damage,
    // no hole.
    shot(r, f, 3, null, 1, "slug");
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    expect(r.foamers.stats.chunks).toBe(0);
    expect(before - body.voxelCount).toBeLessThan(before * 0.6);

    const r2 = rig();
    const g = await spawn(r2, "F01");
    g.finishWeakened = true;
    g.health = 6; // a slug's 6 damage is a quarter of nothing; the tier path is the flag
    const gb = g.parts.get("body")!;
    const gBefore = gb.voxelCount;
    shot(r2, g, 3, SLUG, 1, "slug");
    stepUntilSettled(r2, g);
    expect(g.state).toBe("down");
    expect(gb.voxelCount).toBeLessThan(gBefore);
    expect(r2.foamers.stats.chunks).toBe(1);
  });

  it("9. the carve takes voxels around the mean hit point, inside the debris cap", async () => {
    const r = rig();
    const f = await spawn(r, "F05");
    f.health = 10;
    const body = f.parts.get("body")!;
    // The darts' mean point is the body's front face at its centre height.
    shot(r, f, 3);
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    expect(r.foamers.stats.chunks).toBe(1);
    // The darts came from +z, so the body's front face is its largest z. A
    // voxel a few deep behind the face, where the darts hit, is empty now;
    // one at the back bottom corner is still there (the hole is a sphere,
    // not the whole part).
    const mid = body.spec.size.map((n) => Math.floor(n / 2));
    expect(body.volume.get(mid[0], mid[1], body.spec.size[2] - 3)).toBe(0);
    // The back of the body is well over 0.35 m from the front face and stays.
    expect(body.volume.get(mid[0], mid[1], 3)).not.toBe(0);
    // Debris never goes past the engine's own cap, whatever the data says.
    expect(r.debris.live).toBeLessThanOrEqual(destruction.debris.max);
  });
  it("10. a dart keeps its own shot: the next pull does not rewrite it in flight (review)", () => {
    const r = rig();
    const hits: number[] = [];
    r.darts.onDartHit = (h) => { if (h.shot) hits.push(h.shot.id); };
    const tag = { id: 7, muzzle: new THREE.Vector3(0, 1, 0), chunk: B03 };
    r.darts.fire(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), "standard", tag);
    // The blaster reuses one object: the next trigger pull rewrites it.
    tag.id = 8;
    tag.muzzle.set(50, 50, 50);
    for (let i = 0; i < 60 && hits.length === 0; i++) { r.darts.update(DT); r.world.step(); }
    expect(hits).toEqual([7]);
  });
});
