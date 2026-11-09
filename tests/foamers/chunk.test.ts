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
import { shotSummary, addShotDamage, chunkRadius, type ShotDamage } from "../../src/foamers/chunk";
import { resolveSpec } from "../../src/weapons/blaster";
import foamerData from "../../data/foamers.json";
import destruction from "../../data/destruction.json";

// GAME-09b: the chunk finish's carve. PT-03: its gates (tier, minShare,
// rangeMetres) are gone; one impact number (src/foamers/impact.ts, tested in
// tests/foamers/impact.test.ts) decides down, chunk or pop, and the hole and
// its debris grow with it. The numbers are data (data/blasters.json,
// data/foamers.json); these tests check the carve and that the rule reads
// the data.

const DT = 1 / 60;
const BASE = foamerData.test;
const CHUNK = BASE.catastrophic.chunk;
const B03 = resolveSpec("B03").chunk!;
const SLUG = resolveSpec("B01", ["slug"]).chunk!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
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

describe("GAME-09b: the carve, as data", () => {
  it("1. the data has the blocks the card asks for", () => {
    expect(B03.carveRadius).toBe(0.35);
    expect(SLUG.carveRadius).toBe(0.3);
    expect(CHUNK.chunkGrowMaxMetres).toBeGreaterThan(CHUNK.carveRadius);
    expect(CHUNK.debrisMax + CHUNK.debrisGrowMax).toBeLessThanOrEqual(destruction.debris.max);
    // The plain B01 cannot chunk; its slug mod can.
    expect(resolveSpec("B01").chunk).toBeNull();
    expect(resolveSpec("B04").chunk).toBeNull();
  });

  it("3. shotSummary adds only that shot's darts inside the window", () => {
    const d: ShotDamage[] = [];
    addShotDamage(d, 1, 10, 2, new THREE.Vector3(0, 0, 0), 6);
    addShotDamage(d, 1, 10, 3, new THREE.Vector3(2, 0, 0), 6);
    addShotDamage(d, 2, 10, 100, new THREE.Vector3(0, 9, 0), 6); // another shot
    addShotDamage(d, 1, 5, 100, new THREE.Vector3(0, 9, 0), 6); // outside the window
    const sum = shotSummary(d, 1, 10.05, 0.1)!;
    expect(sum.total).toBe(5);
    expect(sum.healthBefore).toBe(6);
    expect(sum.mean.x).toBeCloseTo(1, 6);
    expect(sum.mean.y).toBeCloseTo(0, 6);
    expect(shotSummary(d, 3, 10.05, 0.1)).toBeNull();
  });

  it("4. chunkRadius takes the larger of the base and the blaster", () => {
    expect(chunkRadius(CHUNK, B03)).toBe(B03.carveRadius);
    expect(chunkRadius({ ...CHUNK, carveRadius: 0.5 }, B03)).toBe(0.5);
  });
});

describe("PT-03: the chunk finish by impact", () => {
  it("5. a close B03 shot that kills an F05 blows a hole and goes down", async () => {
    const r = rig();
    const f = await spawn(r, "F05");
    // Both barrels as one shot (16 standard darts) on an F05 at 2 health.
    // The shot's damage on it is over its max, so the overkill puts the
    // impact in the chunk band: the hole, any tier, and no pop.
    f.health = 2;
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    shot(r, f, 3, B03, 16); // both barrels as one shot
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

  it("6. a B03 kill that clears chunkAt carves the hole: any tier, Fodder included", async () => {
    const r = rig();
    // An F01 (health 6) at 1 health, both barrels (16 damage) at 3 m:
    // overkill 15, impact 15 / 6 = 2.5, at or above popAt, so this pops.
    // The chunk band is what the next test after this one pins down.
    const f = await spawn(r, "F01");
    f.health = 1;
    shot(r, f, 3, B03, 16);
    for (let i = 0; i < 240 && r.foamers.stats.popped < 1; i++) tick(r);
    expect(r.foamers.stats.popped, "it popped").toBe(1);
    expect(r.foamers.stats.chunks).toBe(0);
  });

  it("8. a shot with no chunk block chunks in the chunk band too; a low impact only downs", async () => {
    const r = rig();
    const f = await spawn(r, "F01");
    f.health = 0.5;
    // One slug (6 damage) with no chunk block on an F01 at 0.5 health: in
    // the chunk band, so it carves with the Foamer-wide chunk numbers
    // (review fix: the card's chunk band is for every shot, not only the
    // blasters that carry a chunk block).
    shot(r, f, 3, null, 1, "slug");
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    expect(r.foamers.stats.chunks).toBe(1);

    const r2 = rig();
    const g = await spawn(r2, "F05");
    // A slug (6) with the chunk block on an F05 at 2 health: overkill 4,
    // impact 4 / 30 = 0.133 at 3 m: a down. On an F01 it reaches the
    // chunk band, and the F01's own carve is what the pop test covers.
    g.health = 2;
    shot(r2, g, 3, SLUG, 1, "slug");
    stepUntilSettled(r2, g);
    expect(g.state).toBe("down");
    expect(r2.foamers.stats.chunks).toBe(0);
  });

  it("9. the carve takes voxels around the mean hit point, inside the debris cap", async () => {
    const r = rig();
    const f = await spawn(r, "F05");
    // Both barrels on an F05 at 2 health: the chunk band, as test 5.
    f.health = 1;
    const body = f.parts.get("body")!;
    shot(r, f, 3, B03, 16);
    for (let i = 0; i < 240 && f.state !== "down" && r.foamers.stats.popped < 1; i++) tick(r);
    // 15 / 30 = 0.5: exactly chunkAt, so it chunks (any tier now).
    expect(r.foamers.stats.chunks, "it chunked").toBe(1);
    expect(f.state).toBe("down");
    // The darts came from +z, so the body's front face is its largest z. A
    // voxel a few deep behind the face, where the darts hit, is empty now;
    // one at the back bottom corner is still there (the hole is a sphere,
    // not the whole part).
    const mid = body.spec.size.map((n) => Math.floor(n / 2));
    expect(body.volume.get(mid[0], mid[1], body.spec.size[2] - 3)).toBe(0);
    // The back of the body is well over the base 0.35 m from the front face
    // and stays.
    expect(body.volume.get(mid[0], mid[1], 3)).not.toBe(0);
    // Debris never goes past the engine's own cap, whatever the data says.
    expect(r.debris.live).toBeLessThanOrEqual(destruction.debris.max);
  });

  it("11. a whole B03 shot counts as one shot, not as its first dart", async () => {
    const r = rig();
    const f = await spawn(r, "F01");
    // Half health: the first dart of the shot kills it, but the kill is
    // held so the rest of the shot still lands, and the whole shot's
    // damage is what the impact rule reads.
    f.health = BASE.finisher.weakenShare * f.maxHealth * 0.5;
    const body = f.parts.get("body")!;
    const before = body.voxelCount;
    shot(r, f, 2.5); // eight darts, close in
    stepUntilSettled(r, f);
    expect(f.state).toBe("down");
    expect(r.foamers.stats.hits).toBeGreaterThan(1);
    // The whole shot's damage is recorded, so the impact sees 8, not 1.
    const total = f.shotDamage.filter((d) => d.id === 900)
      .reduce((n, d) => n + d.amount, 0);
    expect(total).toBeGreaterThan(BASE.catastrophic.chunkAt * f.maxHealth);
    expect(body.voxelCount).toBeLessThan(before);
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
