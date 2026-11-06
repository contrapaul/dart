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
import type { FoamerPart } from "../../src/foamers/foamer-part";
import type { PlayerController } from "../../src/player/controller";
import { PlayerHealth } from "../../src/player/health";
import { PickupSystem } from "../../src/pickups/pickups";
import { Finisher } from "../../src/game/finisher";
import foamerData from "../../data/foamers.json";
import pickupData from "../../data/pickups.json";

const DT = 1 / 60;
const SPEC = foamerData.test;
const FIN = SPEC.finisher;
const HP = pickupData.health;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Let a part's mesh settle so its trimesh collider exists (the darts can
 *  only carve what has a collider). Wait until the remesh work is done,
 *  not on one macrotask: a slow event loop can take several. */
async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  world.step();
}

/** World, floor, darts, the Foamer system, the pickup system and the
 *  finisher. The player stands still at ten out; the finisher only reads
 *  and writes its yaw and pitch. */
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
  const pickups = new PickupSystem(RAPIER, world, scene, new PlayerHealth());
  const finisher = new Finisher(foamers, pickups);
  const player = { yaw: 0, pitch: 0 } as unknown as PlayerController;
  world.step();
  return { world, darts, targets, foamers, pickups, finisher, player };
}

/** The player's eye and feet for the step. */
const eye = new THREE.Vector3(10, 1.6, 10);
const feet = new THREE.Vector3(10, 0, 10);

/** One game step in the game's GAME-07 order: darts, the finisher (it
 *  holds the player) or the Foamers, the pickups after the world. */
function tick(r: ReturnType<typeof rig>, dt = DT) {
  r.darts.update(dt);
  if (r.finisher.active) r.finisher.update(dt, r.player);
  else r.foamers.update(dt, eye);
  r.world.step();
  r.pickups.update(dt, feet);
}

/** One dart at the body's front, the way foamers.test.ts kills with a
 *  burst. */
function bodyShot(r: ReturnType<typeof rig>, f: Foamer) {
  const body = f.parts.get("body")!;
  const c = body.voxelToWorld(new THREE.Vector3(
    body.spec.size[0] / 2, body.spec.size[1] / 2, body.spec.size[2] / 2));
  r.darts.fire(new THREE.Vector3(c.x, c.y + 0.2, c.z + 1), new THREE.Vector3(0, 0, -1), "standard");
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("GAME-07: the weakened stagger and the finisher", () => {
  it("1. the crossing hit staggers long, once, beyond the short stagger", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    // A shot that stops above the share does not weaken it.
    await settle(f.parts.get("body")!.mesh, r.world);
    f.health = FIN.weakenShare * f.maxHealth + 20;
    bodyShot(r, f);
    for (let i = 0; i < 30; i++) tick(r);
    expect(f.finishWeakened).toBe(false);
    // The crossing hit: the long, finishable stagger. The health sits in
    // the band + 1 dart's damage, so the crossing is decided by the dart
    // alone: its bounce off the fresh wound can re-hit or not, and neither
    // reading changes the outcome. Band + 2 would wait on that bounce
    // (BUG-09: it can land on nothing, the wound's remesh is a promise).
    f.health = FIN.weakenShare * f.maxHealth + 0.5;
    bodyShot(r, f);
    for (let i = 0; i < 120 && !f.finishWeakened; i++) tick(r);
    expect(f.finishWeakened).toBe(true);
    expect(f.stateTime).toBeLessThan(0.1);
    // It outlasts the short stagger a lot, so the finisher has time.
    for (let i = 0; i < Math.ceil((SPEC.stagger.time * 2) / DT); i++) tick(r);
    expect(f.state).toBe("stagger");
    // And the band is one-way, the card's once: the flag does not reset,
    // and a wound while finishable does not restart the stagger (the
    // stateTime keeps running).
    const t0 = f.stateTime;
    for (let i = 0; i < 10; i++) tick(r);
    expect(f.stateTime).toBeCloseTo(t0 + 10 * DT, 5);
  });

  it("2. a part break keeps its short stagger, even when finishable", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    f.finishWeakened = true;
    // Break an arm: breaking a leg tips F01 into a fall (fallBelowLegs is
    // 2, it has 2), and fall is not what this test is about. The break's
    // own stagger is the short one, whatever the flag says.
    (r.foamers as unknown as { breakPart(f: Foamer, part: FoamerPart): void })
      .breakPart(f, f.parts.get("armL")!);
    expect(f.state).toBe("stagger");
    expect(f.staggerLong).toBe(false);
    for (let i = 0; i < Math.ceil((SPEC.stagger.time + 0.1) / DT); i++) tick(r);
    expect(f.state).not.toBe("stagger");
  });

  it("3. the reach and the cone gate the attempt", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 12))!;
    await settle(f.parts.get("body")!.mesh, r.world);
    // A stagger is frozen enough for a geometry test: it turns and
    // points, but does not walk.
    f.state = "stagger";
    const out = new THREE.Vector3();
    const fwd = new THREE.Vector3(0, 0, -1);
    // Eye right at the chest's height, two out, on the view (the view
    // looks toward -z, so the eye is past the Foamer on +z).
    const eyeOn = new THREE.Vector3(f.centre.x, f.centre.y + f.height * 0.6, 14);
    expect(r.finisher.attempt(f, eyeOn, fwd, out)).toBe(true);
    // Same line, four out: past the reach.
    const eyeFar = new THREE.Vector3(f.centre.x, f.centre.y + f.height * 0.6, 16);
    expect(r.finisher.attempt(f, eyeFar, fwd, out)).toBe(false);
    // Two out but the view points sideways: off the cone.
    expect(r.finisher.attempt(f, eyeOn, new THREE.Vector3(1, 0, 0), out)).toBe(false);
    // has() is the same gate over every living one, and a one that is not
    // staggering does not offer itself.
    expect(r.finisher.has(eyeOn, fwd)).toBe(true);
    f.state = "approach";
    expect(r.finisher.has(eyeOn, fwd)).toBe(false);
  });

  it("4. the finisher holds the view, pops on schedule, and sprays health", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 12))!;
    await settle(f.parts.get("body")!.mesh, r.world);
    f.state = "stagger";
    const eye0 = new THREE.Vector3(f.centre.x, f.centre.y + f.height * 0.6, 14);
    expect(r.finisher.attempt(f, eye0, new THREE.Vector3(0, 0, -1), new THREE.Vector3())).toBe(true);
    r.player.yaw = 0.6; // the view starts off target
    r.finisher.start(f, r.player, eye0);
    expect(r.finisher.active).toBe(true);
    expect(f.state).toBe("finish");
    // Step the game's way until the pop; the view must have landed on the
    // Foamer by the end.
    let steps = 0;
    let done: unknown = null;
    while (r.finisher.active && steps++ < 300) {
      done = r.finisher.update(DT, r.player);
      r.foamers.update(DT, eye0);
      r.world.step();
    }
    expect(done).toBe(f);
    expect(steps).toBeGreaterThanOrEqual(Math.ceil(FIN.total / DT) - 1);
    expect(steps).toBeLessThanOrEqual(Math.ceil(FIN.total / DT) + 1);
    const wantYaw = Math.atan2(-(f.centre.x - eye0.x), -(f.centre.z - eye0.z));
    expect(r.player.yaw).toBeCloseTo(wantYaw, 5);
    // The pop: out of the list (the handle may be reused by the spray's
    // own bodies, so the list and the stats are the real check), and the
    // spray is down at its feet.
    expect(r.foamers.stats.popped).toBe(1);
    expect(r.foamers.list).not.toContain(f);
    expect(r.pickups.count("health")).toBe(HP.count);
    // The blobs settle where the floor is, within a second.
    for (let i = 0; i < 60; i++) tick(r);
    expect(r.pickups.count("health")).toBe(HP.count);
    for (const it of r.pickups.list) {
      const t = it.body.translation();
      expect(t.y).toBeGreaterThan(-0.5);
      expect(t.y).toBeLessThan(1);
    }
  });
  it("5. a target popped by something else mid-finisher is not popped again", async () => {
    // Found in review: the blaster could still fire during a finisher, and
    // a burst that popped the target left the finisher popping a Foamer
    // whose bodies were already gone.
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 12))!;
    await settle(f.parts.get("body")!.mesh, r.world);
    f.state = "stagger";
    const eye0 = new THREE.Vector3(f.centre.x, f.centre.y + f.height * 0.6, 14);
    r.finisher.start(f, r.player, eye0);
    r.finisher.update(DT, r.player);
    r.foamers.pop(f);
    let steps = 0;
    expect(() => {
      while (r.finisher.active && steps++ < 300) {
        r.finisher.update(DT, r.player);
        r.foamers.update(DT, eye0);
        r.world.step();
      }
    }).not.toThrow();
    expect(r.finisher.active).toBe(false);
    expect(r.foamers.stats.popped).toBe(1);
    expect(r.pickups.count("health")).toBe(0);
  });
  it("6. up close, looking at the head counts and looking well aside does not", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 12))!;
    const eye0 = new THREE.Vector3(0, 1.6, 13.5);
    const head = new THREE.Vector3(0, f.centre.y + f.height * 0.95, 12).sub(eye0).normalize();
    expect(r.finisher.attempt(f, eye0, head, new THREE.Vector3())).toBe(true);
    const aside = head.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    expect(r.finisher.attempt(f, eye0, aside, new THREE.Vector3())).toBe(false);
  });
});
