import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, type FoamerSoundKind } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import type { FoamerPart } from "../../src/foamers/foamer-part";
import foamerData from "../../data/foamers.json";

// GAME-11: the fall. A Foamer left with fewer legs than fallBelowLegs tips
// over as an inverted pendulum about the foot it still stands on, bounces
// once at prone, settles, then crawls.

const DT = 1 / 60;
const SPEC = foamerData.test;
const FALL = SPEC.handicaps.fall;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
}

async function settleAll(r: { world: RAPIER.World }, f: Foamer) {
  for (const part of f.parts.values()) await settle(part.mesh, r.world);
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
  const sounds: { kind: FoamerSoundKind; point: THREE.Vector3 }[] = [];
  foamers.onSound = (kind, _f, point) => sounds.push({ kind, point: point.clone() });
  world.step();
  return { world, darts, debris, targets, foamers, sounds };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, player);
  r.world.step();
}

function centreOf(part: FoamerPart) {
  return part.voxelToWorld(new THREE.Vector3(
    part.spec.size[0] / 2, part.spec.size[1] / 2, part.spec.size[2] / 2));
}

/** Break a part outright through the system's own hook (the range button's
 *  path), so the test does not depend on dart flight. legL or legR. */
function breakLeg(f: Foamer, id: "legL" | "legR") {
  const part = f.parts.get(id)!;
  part.hp = 0;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("GAME-11 the fall", () => {
  it("1. breaking a leg sets fall, and within 2 s it is crawling", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    expect(f.state, "walking first").toBe("approach");
    breakLeg(f, "legL");
    tick(r, player);
    expect(f.state, "it fell").toBe("fall");
    let n = 1;
    for (; n <= 120 && f.state === "fall"; n++) tick(r, player);
    expect(f.state, "crawling").toBe("crawl");
    expect(n * DT, "within 2 s").toBeLessThanOrEqual(2);
  });

  it("2. the pendulum: it speeds up as it tips, lands at proneTilt, bounces back less than bounce * proneTilt, and settles at proneTilt", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    breakLeg(f, "legL");
    // Record the tilt every step of the fall, and the angle it covers in
    // each half of the time to the first landing.
    const tilts: number[] = [];
    let landedAt = -1;
    const landedTilt = FALL.proneTilt;
    let maxTilt = -Infinity;
    let afterBounceMin = Infinity;
    for (let i = 0; i < 240; i++) {
      tick(r, player);
      if (f.state !== "fall") break;
      tilts.push(f.fallTilt());
      maxTilt = Math.max(maxTilt, f.fallTilt());
      if (landedAt < 0 && f.fallBounced) landedAt = tilts.length - 1;
      if (landedAt >= 0 && f.fallBounced) afterBounceMin = Math.min(afterBounceMin, f.fallTilt());
    }
    expect(landedAt, "it landed").toBeGreaterThan(4);
    expect(f.state, "it settled").toBe("crawl");
    // The landing is at proneTilt, and proneTilt is the most it tipped.
    expect(tilts[landedAt]!, "landed at proneTilt").toBeCloseTo(landedTilt, 5);
    expect(maxTilt, "never past proneTilt").toBeLessThanOrEqual(landedTilt + 1e-6);
    // Growing speed: the second half of the run to the landing covers more
    // angle than the first, in the same number of steps.
    const half = Math.floor(landedAt / 2);
    const firstHalf = tilts[half]! - tilts[0]!;
    const secondHalf = tilts[landedAt]! - tilts[half]!;
    expect(secondHalf, "it speeds up as it goes over").toBeGreaterThan(firstHalf * 1.5);
    // The bounce: back by less than bounce * proneTilt, once.
    const back = landedTilt - afterBounceMin;
    expect(back, "it bounced").toBeGreaterThan(0.02);
    expect(back, "less than bounce * proneTilt").toBeLessThan(FALL.bounce * FALL.proneTilt);
    // And the crawl holds the prone tilt.
    expect(f.fallTilt(), "prone in the crawl").toBeCloseTo(FALL.proneTilt, 5);
  });

  it("3. a left leg lost rolls it left, a right leg right", async () => {
    const tilt = async (leg: "legL" | "legR") => {
      const r = rig();
      const player = new THREE.Vector3(0, 1.6, 8);
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
      r.world.step();
      await settleAll(r, f);
      breakLeg(f, leg);
      for (let i = 0; i < 120; i++) {
        tick(r, player);
        if (f.state !== "fall") break;
      }
      expect(f.state, `${leg}: it settled`).toBe("crawl");
      return { roll: f.motion.roll, pitch: f.motion.pitch };
    };
    const left = await tilt("legL");
    const right = await tilt("legR");
    // Forward pitch either way, and rolls toward the leg it lost (the sign
    // the old 0.15 rad per missing leg used: left is negative roll).
    expect(left.pitch, "forward").toBeGreaterThan(0.5);
    expect(right.pitch, "forward").toBeGreaterThan(0.5);
    expect(left.roll, "left leg lost, rolls left").toBeLessThan(-0.1);
    expect(right.roll, "right leg lost, rolls right").toBeGreaterThan(0.1);
    expect(left.roll, "mirrored").toBeCloseTo(-right.roll, 5);
  });

  it("5. no joint jumps entering fall or crawl: no part turns more than 0.35 rad in a step", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    const qd = new THREE.Quaternion();
    let worst = 0;
    const step = () => {
      const before = new Map<string, THREE.Quaternion>();
      for (const part of f.parts.values()) {
        const rot = part.body.rotation();
        before.set(part.spec.id, new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w));
      }
      tick(r, player);
      f.parts.forEach((part, id) => {
        const rot = part.body.rotation();
        qd.set(rot.x, rot.y, rot.z, rot.w);
        const angle = 2 * Math.acos(Math.min(1, Math.abs(qd.dot(before.get(id)!))));
        worst = Math.max(worst, angle);
      });
    };
    // Approach, then the break, the whole fall, and into the crawl.
    for (let i = 0; i < 20; i++) step();
    breakLeg(f, "legL");
    let sawFall = false, sawCrawl = false;
    for (let i = 0; i < 240; i++) {
      step();
      if (f.state === "fall") sawFall = true;
      if (f.state === "crawl") sawCrawl = true;
    }
    expect(sawFall, "it fell").toBe(true);
    expect(sawCrawl, "it crawled").toBe(true);
    expect(worst, "no joint jumps").toBeLessThan(0.35);
  });

  it("8. darts still hit a falling Foamer: it stays a target through the fall and the crawl", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    breakLeg(f, "legL");
    tick(r, player);
    expect(f.state, "mid-fall").toBe("fall");
    // Mid-fall: every part it still has is still a target.
    for (const id of ["body", "head", "armL", "armR", "legR"]) {
      expect(r.targets, `${id} is a target mid-fall`).toContain(f.parts.get(id)!);
    }
    // A dart meets a part it has mid-fall.
    const body = f.parts.get("body")!;
    const before = body.hp + body.voxelCount;
    r.darts.fire(centreOf(body).add(new THREE.Vector3(0, 0, -1)), new THREE.Vector3(0, 0, 1), "standard");
    let changed = false;
    for (let i = 0; i < 120 && !changed; i++) {
      tick(r, player);
      changed = body.hp + body.voxelCount !== before;
    }
    expect(changed, "a dart hit it while it fell").toBe(true);
    // And through the crawl it is still hit.
    for (let i = 0; i < 240 && f.state !== "crawl"; i++) tick(r, player);
    expect(f.state, "crawling").toBe("crawl");
    expect(r.targets, "still a target in the crawl").toContain(f.parts.get("body")!);
  });

  it("9. the fall sound: onSound gets fall once per fall, at the body", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    breakLeg(f, "legL");
    for (let i = 0; i < 240 && f.state !== "crawl"; i++) tick(r, player);
    const falls = r.sounds.filter((s) => s.kind === "fall");
    expect(falls.length, "one fall line").toBe(1);
    // At the body, not at a part.
    expect(falls[0]!.point.distanceTo(f.centre)).toBeLessThan(0.2);
  });

  it("10. goDown still works from a fall and from the crawl: darts kill it and it ragdolls in place", async () => {
    for (const mode of ["fall", "crawl"] as const) {
      const r = rig();
      const player = new THREE.Vector3(0, 1.6, 8);
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
      r.world.step();
      await settleAll(r, f);
      breakLeg(f, "legL");
      for (let i = 0; i < 240; i++) {
        tick(r, player);
        if (f.state === mode) break;
      }
      expect(f.state, mode).toBe(mode);
      // Darts at the body, one every ~0.2 s, until the health is gone.
      const isDown = () => f.state === "down";
      let shots = 0;
      while (!isDown() && shots < 40) {
        const body = f.parts.get("body")!;
        r.darts.fire(centreOf(body).add(new THREE.Vector3(0, 0, -1)),
          new THREE.Vector3(0, 0, 1), "standard");
        shots++;
        for (let i = 0; i < 12 && !isDown(); i++) tick(r, player);
      }
      expect(f.state, `${mode}: down`).toBe("down");
      expect(f.ragdoll.length, `${mode}: the ragdoll is built`).toBeGreaterThan(0);
      // And it stays down (the crawl does not resume).
      for (let i = 0; i < 60; i++) tick(r, player);
      expect(f.state, `${mode}: stays down`).toBe("down");
    }
  });
});
