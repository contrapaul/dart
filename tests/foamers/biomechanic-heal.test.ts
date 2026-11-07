import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { linearColorTable } from "../../src/voxel/materials";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { healOf, canHeal, healRange, healthShare } from "../../src/foamers/heal";

// GAME-10l stage 2: the healing stream. The Biomechanic picks the most hurt
// ally in range and in sight, turns to it and pours health into it, one ally
// at a time and never above its maximum. With the antenna gone the range
// halves; with the tank gone there is no healing and it closes in to bonk.

const DT = 1 / 60;
const HALF = 20;
const PLAYER = new THREE.Vector3(0, 0, 20);

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    body,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  foamers.director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.navGrid = grid;
  foamers.spawnState = "alert";
  // Each test owns its population: no spawner adding Foamers behind it.
  foamers.spawnCount = 0;
  world.step();
  grid.bake();
  return { world, darts, foamers, grid };
}

function tick(r: ReturnType<typeof rig>, player = PLAYER) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
}

function run(r: ReturnType<typeof rig>, seconds: number, player = PLAYER) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(r, player);
}

/** A hurt Foamer at a spot (type F06, 35 health: room to be healed), with
 *  its health set explicitly. */
function ally(r: ReturnType<typeof rig>, x: number, z: number, health = 14, type = "F06") {
  const f = r.foamers.spawn(new THREE.Vector3(x, 0, z), undefined, type)!;
  f.health = health;
  return f;
}

describe("the Biomechanic's healing stream (GAME-10l stage 2)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("6. the heal numbers come from the type, and the chain has its own cap", () => {
    const heal = healOf(specFor("F13"))!;
    expect(heal.rangeMetres).toBe(7);
    expect(heal.perSecond).toBe(5);
    expect(heal.pickSeconds).toBe(0.5);
    expect(heal.blobCap).toBe(12);
    // No other type heals.
    expect(healOf(specFor("F01"))).toBeNull();
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const a = ally(r, 2, 4);
    expect(f.healStream, "the Biomechanic has a chain").not.toBeNull();
    expect(f.healStream!.group.children.length).toBe(heal.blobCap);
    expect(a.healStream, "an ally has none").toBeNull();
  });

  it("7. heals the most hurt ally, by health share, not the healthiest", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    // The F06 has 35 health, so 5 is 14% of it; the F13 has 25, so 20 is
    // 80%. The F06 is the more hurt of the two, though the F13 has more
    // health missing.
    const a = ally(r, -2, 3, 5);
    const b = ally(r, 2, 3, 20, "F13");
    const before = { a: a.health, b: b.health };
    run(r, 1);
    expect(a.health, "the most hurt ally is mended").toBeGreaterThan(before.a + 3);
    expect(b.health, "the other one is not").toBeCloseTo(before.b, 5);
    expect(f.healTarget).toBe(a);
    // It turns to the ally it mends (its front is +z, so atan2(dx, dz)).
    const want = Math.atan2(a.centre.x - f.centre.x, a.centre.z - f.centre.z);
    expect(Math.abs(f.yaw - want)).toBeLessThan(0.2);
  });

  it("8. picks nobody who is full, and its health never passes its maximum", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const full = ally(r, -2, 3, 35);
    run(r, 0.6);
    expect(f.healTarget, "a full ally is no target").toBeNull();
    expect(full.health).toBe(35);

    full.health = 30;
    run(r, 0.6);
    expect(f.healTarget).toBe(full);
    run(r, 3);
    expect(full.health, "it stops at its maximum").toBe(full.maxHealth);
    expect(full.health).toBe(35);
    // With it full the stream lets go.
    run(r, 0.6);
    expect(f.healTarget).toBeNull();
  });

  it("9. one ally at a time", () => {
    const r = rig();
    r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const a = ally(r, -2, 3, 14);
    const b = ally(r, 2, 3, 14);
    expect(healthShare(a)).toBeCloseTo(healthShare(b), 5);
    run(r, 2);
    const mended = [a, b].filter((o) => o.health > 14.01);
    expect(mended.length, "exactly one ally gains health").toBe(1);
    // The other one was not touched at all.
    const other = mended[0] === a ? b : a;
    expect(other.health).toBe(14);
  });

  it("10. out of range and out of sight are no targets", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const near = ally(r, -1.5, 3, 20);
    const far = ally(r, 9, 4, 5); // 9 m away, past the 7 m range, and hurt
    run(r, 0.6);
    expect(f.healTarget).toBe(near);
    expect(far.health).toBe(5);

    // A solid block between them, and the nearer one is not in sight now.
    const body = r.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    r.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.5, 1.5, 0.2).setTranslation(-0.6, 1, 3.5),
      body,
    );
    r.world.step();
    run(r, 0.6);
    expect(f.healTarget, "the hidden ally is dropped").toBeNull();
  });

  it("11. antenna gone halves the heal range", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    expect(healRange(f.spec, f)).toBe(7);
    f.parts.delete("antenna");
    expect(healRange(f.spec, f)).toBe(3.5);
    expect(canHeal(f.spec, f), "the tank is what heals").toBe(true);

    const kid = ally(r, 5, 4, 20); // 5 m: in range with the antenna, out without
    run(r, 0.6);
    expect(f.healTarget, "out of the halved range").toBeNull();
    expect(kid.health).toBe(20);
    // A spot inside the halved range still works.
    kid.centre.set(2.5, 0, 4);
    run(r, 0.6);
    expect(f.healTarget).toBe(kid);
    expect(kid.health).toBeGreaterThan(20);
  });

  it("12. tank gone ends the healing and it closes in to bonk", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const a = ally(r, -2, 3, 20);
    run(r, 0.6);
    expect(f.healTarget).toBe(a);
    expect(f.healStream!.group.visible, "the chain is drawn").toBe(true);

    f.parts.delete("tank");
    expect(canHeal(f.spec, f)).toBe(false);
    a.health = 20;
    run(r, 0.6);
    expect(f.healTarget, "no tank, no healing").toBeNull();
    expect(f.healStream!.group.visible, "and no chain").toBe(false);
    expect(a.health).toBe(20);
    // The keep-distance ring closes to the bonk's reach, not the heal's.
    expect(f.agentInput!.preferredDistance).toBe(f.spec.attackRange);
  });

  it("13. the blob cap holds however far the ally stands", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4), undefined, "F13")!;
    const cap = healOf(f.spec)!.blobCap;
    const a = ally(r, 0, 10.5, 20); // 6.5 m out, near the far edge
    run(r, 1);
    expect(f.healTarget).toBe(a);
    const shown = f.healStream!.group.children.filter((c) => c.visible);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length, "never more than the cap").toBeLessThanOrEqual(cap);
    expect(f.healStream!.group.children.length).toBe(cap);
  });

  it("14. it walks its ring toward a hurt ally, never inside its kept distance", () => {
    const r = rig();
    // The player 12 m off (the grid's edge is at 20), the Biomechanic on its
    // 10 m ring, and a hurt ally 9 m to one side: out of the 7 m range.
    const player = new THREE.Vector3(0, 0, 12);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 2), undefined, "F13")!;
    const a = ally(r, 9, 2, 5);
    const allyDist = () => Math.hypot(a.centre.x - f.centre.x, a.centre.z - f.centre.z);
    const playerDist = () => Math.hypot(f.centre.x - player.x, f.centre.z - player.z);
    const start = allyDist();
    expect(start, "the ally starts out of range").toBeGreaterThan(7);
    let closest = Infinity;
    for (let i = 0; i < 20 * 60; i++) {
      tick(r, player);
      closest = Math.min(closest, playerDist());
    }
    expect(a.health, "it got near enough to mend the ally").toBeGreaterThan(5);
    expect(f.healTarget ?? a, "the mended ally is the hurt one").toBe(a);
    // Round the ring, not through it: the player is never crowded.
    expect(closest).toBeGreaterThan(f.spec.preferredDistanceMetres - 1);
  });
});
