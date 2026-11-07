import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { ProjectileSystem, BALL_MATERIAL } from "../../src/foamers/projectiles";
import { homingOf, homingShotKind } from "../../src/foamers/homing";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";

// GAME-10j stage 2: the Turbo's homing shot. One slow, light, pink
// parryable ball from the blaster tip that steers to the player for its
// seconds at its turn rate, then flies straight; the parry kills the
// steer on the player; the launcher gone means no shots; the live cap
// holds. Tuning is the F10's `homing` block in data/foamers.json.

const DT = 1 / 60;
const HALF = 20;
const H = homingOf(specFor("F10"))!;
const DEG = Math.PI / 180;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig(playerAt: THREE.Vector3) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(playerAt.x, playerAt.y, playerAt.z),
  );
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0),
    playerBody,
  );
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 400),
    playerBody,
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  const director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.director = director;
  foamers.navGrid = grid;
  world.step();
  grid.bake();
  return { world, darts, debris, foamers, projectiles, grid, playerBody, playerAt: playerAt.clone() };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.projectiles.update(DT);
  r.world.step();
}

/** The ball's heading in the floor plane, radians (NaN when it is still). */
function heading(b: { vel: THREE.Vector3 }): number {
  const h = Math.hypot(b.vel.x, b.vel.z);
  return h < 1e-3 ? NaN : Math.atan2(b.vel.z, b.vel.x);
}

/** How far `b` sits from pointing straight at `at` in the floor plane. */
function aimError(b: { pos: THREE.Vector3; vel: THREE.Vector3 }, at: THREE.Vector3): number {
  const want = Math.atan2(at.z - b.pos.z, at.x - b.pos.x);
  let d = heading(b) - want;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

describe("the Turbo's homing shot (GAME-10j stage 2)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. the type reads its own shot's numbers; the kind is the shared pink", () => {
    expect(H).toMatchObject({
      speed: 7, gravity: 1, radius: 0.1, lifetime: 6, chunks: 3,
      maxLive: 6, seconds: 2.5, turnDegPerSecond: 90,
    });
    const kind = homingShotKind(H);
    expect(kind.attack).toBe("homingShot");
    expect(kind.speed).toBeLessThan(foamerData.test.ball.speed); // slower than a thrown ball
    expect(kind.gravity).toBeLessThan(foamerData.test.ball.gravity); // little gravity
    expect(kind.mesh, "pink and parryable: the shared material").toBe(BALL_MATERIAL);
    expect(kind.homing).toEqual({ seconds: 2.5, turnDegPerSecond: 90 });
    expect(kind.maxLive).toBe(6);
    expect(specFor("F10").attacks[0]).toMatchObject({ id: "homingShot", damage: 10, token: "ranged" });
  });

  it("2. it leaves the blaster tip, not a ball hand", () => {
    const r = rig(new THREE.Vector3(0, 3, 6));
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), r.playerAt, "F10")!;
    const at = r.projectiles.handAt(f, new THREE.Vector3());
    const tip = f.parts.get("blaster")!.body.translation();
    expect(at.distanceTo(tip), "handAt is the blaster's part centre")
      .toBeLessThan(0.02);
    // F02 proves the old path still works for a rig with a `ball` part.
    const roamer = r.foamers.spawn(new THREE.Vector3(3, 3, 0), r.playerAt, "F02")!;
    const hand = r.projectiles.handAt(roamer, new THREE.Vector3());
    const heart = roamer.parts.get("ball")!.body.translation();
    expect(hand.distanceTo(heart)).toBeLessThan(0.02);
  });

  it("3. a real attack airs one homing ball of the kind, from the tip", () => {
    const r = rig(new THREE.Vector3(0, 3, 6));
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), r.playerAt, "F10")!;
    const fired: Array<{ kind: unknown; at: THREE.Vector3 }> = [];
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    const scratch = new THREE.Vector3();
    r.projectiles.launch = (fl, eye, spread, kind) => {
      fired.push({ kind, at: r.projectiles.handAt(fl, scratch).clone() });
      realLaunch(fl, eye, spread, kind);
    };
    for (let i = 0; i < 60 * 8 && r.projectiles.list.length === 0; i++) tick(r, r.playerAt);
    expect(fired.length, "exactly one ball per shot").toBeGreaterThan(0);
    for (const shot of fired) {
      const kind = shot.kind as { attack: string; speed: number } | undefined;
      expect(kind?.attack).toBe("homingShot");
      expect(kind?.speed).toBe(H.speed);
    }
    const b = r.projectiles.list[0]!;
    expect(b.attack).toBe("homingShot");
    expect(b.mesh.material).toBe(BALL_MATERIAL);
    expect(b.homingLeft).toBeGreaterThan(0);
    expect(b.homingLeft).toBeLessThanOrEqual(H.seconds);
    expect(f.parts.has("blaster"), "it still carries the launcher on that shot").toBe(true);
  });

  it("3b. it fires from its hover height at a player on the floor", () => {
    // Review: the release asked for less than 2 m of height between the
    // Foamer and the player, so a Turbo at its 4 m hover never fired in
    // play (test 3 put the player 3 m up). A ranged shot has no such limit.
    const r = rig(new THREE.Vector3(0, 0.9, 10));
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), r.playerAt, "F10")!;
    for (let i = 0; i < 60 * 8 && r.projectiles.list.length === 0; i++) tick(r, r.playerAt);
    expect(f.centre.y - r.playerAt.y, "it is well above the player").toBeGreaterThan(2);
    expect(r.projectiles.list.length, "a homing ball is in the air").toBeGreaterThan(0);
  });

  it("4. it turns to a player who has moved aside, then flies straight", () => {
    // Review: the player stands 40 m off and the ball leaves 9 m up, so it
    // is still in the air when its steer seconds run out (at 8 m and 3 m up
    // it could hit the player or the floor first and be gone).
    const r = rig(new THREE.Vector3(0, 1, 40));
    const f = r.foamers.spawn(new THREE.Vector3(0, 9, 0), new THREE.Vector3(0, 1, 40), "F10")!;
    // Aim it at +x: the player (at +z) is a quarter-turn to its left.
    r.projectiles.launch(f, new THREE.Vector3(4, 9, 0), 0, homingShotKind(H));
    const b = r.projectiles.list[0]!;
    for (let i = 0; i < 30; i++) r.projectiles.update(DT);
    expect(aimError(b, r.playerAt), "it has turned toward the player, some way around")
      .toBeGreaterThan(10 * DEG);
    // It turns on to aim at them: while the time runs, the heading moves.
    const turnSeen = (n: number): number => {
      let m = 0;
      let prev = heading(b);
      for (let i = 0; i < n; i++) {
        r.projectiles.update(DT);
        const h = heading(b);
        if (!Number.isNaN(prev) && !Number.isNaN(h)) {
          let d = h - prev;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          m = Math.max(m, Math.abs(d));
        }
        prev = h;
      }
      return m;
    };
    expect(turnSeen(40), "still turning while the seconds run").toBeGreaterThan(0);
    for (let i = 0; i < 600 && b.homingLeft > 0; i++) r.projectiles.update(DT);
    expect(b.homingLeft, "the steer has run out").toBe(0);
    for (let i = 0; i < 5; i++) r.projectiles.update(DT);
    expect(r.projectiles.list.includes(b), "the ball is still flying").toBe(true);
    // After the seconds: no turning at any tick, whatever the position is.
    expect(turnSeen(30), "after the seconds it flies straight")
      .toBeLessThanOrEqual(1e-5);
  });

  it("5. the turn per step never exceeds the turn rate", () => {
    const r = rig(new THREE.Vector3(0, 1, 8));
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 1, 8), "F10")!;
    r.projectiles.launch(f, new THREE.Vector3(4, 3, 0), 0, homingShotKind(H));
    const b = r.projectiles.list[0]!;
    const maxTurn = (H.turnDegPerSecond * Math.PI) / 180 * DT;
    let prev = heading(b);
    let turned = 0;
    for (let i = 0; i < Math.ceil((H.seconds + 1) / DT); i++) {
      r.projectiles.update(DT);
      if (!r.projectiles.list.includes(b)) break;
      const h = heading(b);
      if (!Number.isNaN(prev) && !Number.isNaN(h)) {
        let d = h - prev;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (i > 0) turned = Math.max(turned, Math.abs(d)); // open step: the launch aim
        expect(Math.abs(d), `step ${i}`).toBeLessThanOrEqual(maxTurn + 1e-4);
      }
      prev = h;
    }
    expect(turned, "it did steer, so the bound was load-bearing").toBeGreaterThan(0);
  });

  it("6. a parried shot does not home on the player anymore", () => {
    const r = rig(new THREE.Vector3(0, 1, 8));
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 1, 8), "F10")!;
    // Aimed straight at the player; it flies, then the shield meets it
    // about 3 m out.
    r.projectiles.launch(f, r.playerAt.clone(), 0, homingShotKind(H));
    const b = r.projectiles.list[0]!;
    expect(b.homingLeft).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) r.projectiles.update(DT);
    r.projectiles.bounce(b);
    expect(b.bounced).toBe(true);
    expect(b.homingLeft, "the parry takes over: no homing left").toBe(0);
    r.world.step();
    // A few steps of the parry's own steer (it is too far from its
    // thrower to reach it in three ticks).
    for (let i = 0; i < 3; i++) r.projectiles.update(DT);
    // The steer now flies back to the thrower (it is at z 0, the player at z 8).
    expect(b.vel.z, "it steers back to the thrower, not at the player").toBeLessThan(-0.5);
  });

  it("7. the launcher gone means no shots: the bonk, not the blaster", () => {
    const r = rig(new THREE.Vector3(0, 3, 6));
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), r.playerAt, "F10")!;
    f.parts.delete("blaster");
    const fired: unknown[] = [];
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    r.projectiles.launch = (fl, eye, spread, kind) => {
      fired.push(kind);
      realLaunch(fl, eye, spread, kind);
    };
    let sawWindup = false;
    for (let i = 0; i < 60 * 10; i++) {
      tick(r, r.playerAt);
      if (f.state === "windup" || f.state === "strike") sawWindup = true;
      if (sawWindup && i > 60 * 3) break;
    }
    expect(sawWindup, "it still attacks (the bonk)").toBe(true);
    expect(fired, "no ball left the blaster: it is gone").toEqual([]);
  });

  it("8. the live cap holds: the data's maxLive, oldest first", () => {
    const r = rig(new THREE.Vector3(0, 3, 8));
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), r.playerAt, "F10")!;
    for (let i = 0; i < 9; i++)
      r.projectiles.launch(f, r.playerAt.clone(), 0, homingShotKind(H));
    expect(r.projectiles.list.length, "never more than the data's cap").toBe(H.maxLive);
    expect(r.projectiles.list.every((b) => b.attack === "homingShot")).toBe(true);
  });
});
