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
import { FoamerSystem } from "../../src/foamers/foamers";
import { ProjectileSystem, BALL_MATERIAL, type BallKind } from "../../src/foamers/projectiles";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { pelletKind, pelletOf, weakpointOf, type PelletSpec } from "../../src/foamers/pellet";
import type { Foamer } from "../../src/foamers/foamer";

// GAME-10g stage 2: the Crawler's pellet stream. A burst of pellets.count
// pellets one every intervalSeconds, aimed at the eye with a seeded spread,
// bursting on any geometry, so a wall between it and the player stops the
// stream. The gun is the weak point; with the gun or both barrels gone it
// cannot fire and stomps instead.

const DT = 1 / 60;
const PLAYER = new THREE.Vector3(0, 1.6, 0);
const PELLETS = (foamerData.types.F09 as unknown as { pellets: PelletSpec }).pellets;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig(wall: boolean = false) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  if (wall) {
    // A voxel wall's worth of solid geometry between the two, wide enough
    // that there is no way round it (a plain static collider: what a
    // ball's raycast treats as the world).
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 3, 0.2).setTranslation(0, 2, 8),
      world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
    );
  }
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 200),
  );
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0),
    playerBody,
  );
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 400),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
  foamers.projectiles = projectiles;
  foamers.director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
  foamers.navGrid = grid;
  world.step();
  grid.bake();
  return { world, darts, foamers, projectiles, grid, t: 0 };
}

type Rig = ReturnType<typeof rig>;

function tick(r: Rig, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.projectiles.update(DT);
  r.world.step();
  r.t += DT;
}

/** Let it fight until the predicate holds (or time runs out). */
function until(r: Rig, player: THREE.Vector3, done: (f: Foamer) => boolean, seconds = 60) {
  const f = r.foamers.list[0]!;
  for (let i = 0; i < Math.round(seconds / DT) && !done(f); i++) tick(r, player);
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F09 pellet stream (GAME-10g stage 2)", () => {
  it("5. a burst fires exactly pellets.count pellets, one per interval", () => {
    const r = rig();
    r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F09");
    const fired: { n: number; t: number; attack: string }[] = [];
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    let burst = 0;
    r.projectiles.launch = (f, eye, spread, kind) => {
      if (f.pelletTurn !== burst) { burst = f.pelletTurn; fired.length = 0; }
      fired.push({ n: f.pelletFired, t: r.t, attack: kind?.attack ?? "?" });
      realLaunch(f, eye, spread, kind);
    };
    until(r, PLAYER, (f) => f.pelletTurn >= 1 && f.pelletFired >= PELLETS.count);
    expect(fired.length, `the burst is pellets.count long (${JSON.stringify(fired)})`)
      .toBe(PELLETS.count);
    expect(fired.every((p) => p.attack === "stream")).toBe(true);
    for (let i = 1; i < fired.length; i++) {
      expect(Math.abs(fired[i]!.t - fired[i - 1]!.t - PELLETS.intervalSeconds),
        `pellet ${i} followed after intervalSeconds`)
        .toBeLessThanOrEqual(DT + 1e-9);
    }
  }, 20000);

  it("6. a pellet is a BallKind from the data: fast, flat, small, lime, not parryable", () => {
    const kind = pelletKind(PELLETS);
    expect(kind.attack).toBe("stream");
    expect(kind.speed).toBe(22);
    expect(kind.gravity).toBe(1);
    expect(kind.radius).toBe(0.05);
    expect(kind.bounces, "no bounce: it bursts on any geometry").toBe(0);
    expect(kind.maxLive).toBe(24);
    expect(kind.mesh, "not the parry material").not.toBe(BALL_MATERIAL);
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F09")!;
    r.projectiles.launch(f, PLAYER, 0, kind);
    const ball = r.projectiles.list.find((b) => b.attack === "stream")!;
    expect(ball.mesh.material).toBe(kind.mesh);
    expect(ball.mesh.scale.x).toBe(PELLETS.radius);
  });

  it("7. the spread is the same for the same seed, and never Math.random", () => {
    const runs: number[][] = [];
    for (const _ of [0, 1]) {
      const r = rig();
      r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F09");
      const spreads: number[] = [];
      const realLaunch = r.projectiles.launch.bind(r.projectiles);
      r.projectiles.launch = (f, eye, spread, kind) => {
        if (kind?.attack === "stream" && f.pelletFired <= PELLETS.count) spreads.push(spread ?? 0);
        realLaunch(f, eye, spread ?? 0, kind);
      };
      until(r, PLAYER, (f) => f.pelletTurn >= 1 && f.pelletFired >= PELLETS.count);
      runs.push(spreads.slice(0, PELLETS.count));
    }
    expect(runs[0].length).toBe(PELLETS.count);
    expect(runs[1], "the same seed spreads the same").toEqual(runs[0]);
    expect(runs[0].every((s) => Math.abs(s) <= PELLETS.spreadDeg + 1e-9)).toBe(true);
    expect(new Set(runs[0]).size, "the pellets are not all aimed the same way")
      .toBeGreaterThan(1);
  }, 20000);

  it("8. a wall between it and the player stops every pellet", () => {
    const r = rig(true);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F09")!;
    // Fire a full burst straight at the player through the wall by hand
    // (the brain would not start the throw at all; see test 9).
    const kind = pelletKind(PELLETS);
    for (let i = 0; i < PELLETS.count; i++) r.projectiles.launch(f, PLAYER, 0, kind);
    expect(r.projectiles.list.length).toBe(PELLETS.count);
    for (let i = 0; i < 300; i++) tick(r, PLAYER);
    expect(r.projectiles.stats.hitPlayer, "no pellet reached the player").toBe(0);
    expect(r.projectiles.list.length, "every pellet burst on the wall").toBe(0);
  });

  it("9. the brain will not open the stream into the wall", () => {
    const r = rig(true);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F09")!;
    let pellets = 0;
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    r.projectiles.launch = (a, b, c, d) => { if (d?.attack === "stream") pellets++; realLaunch(a, b, c, d); };
    for (let i = 0; i < 60 * 20; i++) tick(r, PLAYER);
    expect(pellets, "no flight, no stream").toBe(0);
    expect(f.state, "it is still fighting, not throwing itself away").not.toBe("down");
  }, 20000);

  it("10. the gun takes the weak-point multiplier; a body part does not", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F09")!;
    const wp = weakpointOf(f.spec)!;
    expect(wp.parts).toEqual(["gun"]);
    expect(wp.damage).toBe(2);
    for (const part of f.parts.values()) {
      part.mesh.update();
      await new Promise((res) => setTimeout(res, 0));
      r.world.step();
    }
    const hit = (id: string) => {
      const part = f.parts.get(id)!;
      const probe = r.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
        part.body,
      );
      f.health = f.maxHealth;
      f.state = "approach"; // the gun is a weak point open or shut
      r.darts.onHit({
        point: part.voxelToWorld(new THREE.Vector3(10, 10, 10)),
        normal: new THREE.Vector3(-1, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        speed: 25,
        type: "standard",
        collider: probe,
        material: null,
        shot: null,
      });
      return f.maxHealth - f.health;
    };
    const leg = hit("legFL");
    const gun = hit("gun");
    expect(leg, "a dart on a leg hurts").toBeGreaterThan(0);
    // leg and gun are kinds with the same hit and total shares (partDamage
    // in the base spec), so the only difference between the two is the
    // weak point's multiplier.
    expect(gun, "the gun takes the multiplier").toBeCloseTo(leg * wp.damage, 5);
  });

  it("11. gun gone: no pellets, and a stomp in reach", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 3), PLAYER, "F09")!;
    f.parts.delete("gun");
    let pellets = 0;
    const bonks: string[] = [];
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    r.projectiles.launch = (a, b, c, d) => { if (d?.attack === "stream") pellets++; realLaunch(a, b, c, d); };
    r.foamers.onBonk = (_foamer, attack) => { bonks.push(attack); };
    until(r, PLAYER, () => bonks.length > 0, 30);
    expect(pellets, "no gun, no stream").toBe(0);
    expect(bonks[0], `it stomps (${bonks})`).toBe("stomp");
    // The same for both barrels gone: it cannot fire, and fights with the
    // stomp (chooseAttack skips the stream: canStream in pellet.ts).
    const r2 = rig();
    const g = r2.foamers.spawn(new THREE.Vector3(0, 0, 3), PLAYER, "F09")!;
    g.parts.delete("barrelL");
    g.parts.delete("barrelR");
    let gpellets = 0;
    const gBonks: string[] = [];
    r2.projectiles.launch = (a, b, c, d) => { if (d?.attack === "stream") gpellets++; realLaunch(a, b, c, d); };
    r2.foamers.onBonk = (_foamer, attack) => { gBonks.push(attack); };
    for (let i = 0; i < 60 * 30 && gBonks.length === 0; i++) tick(r2, PLAYER);
    expect(gpellets, "no barrels, no stream").toBe(0);
    expect(gBonks[0], `it stomps (${gBonks})`).toBe("stomp");
  }, 20000);

  it("12. the live cap holds under a storm of pellets", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F09")!;
    const kind: BallKind = pelletKind(PELLETS);
    for (let i = 0; i < 40; i++) r.projectiles.launch(f, PLAYER, 0, kind);
    expect(r.projectiles.list.length, "no more than the data cap")
      .toBeLessThanOrEqual(PELLETS.maxLive);
  });

  it("13. no other type streams pellets", () => {
    const types = foamerData.types as unknown as Record<string, object>;
    for (const id of ["F01", "F02", "F04", "F05", "F06", "F07"]) {
      expect(pelletOf(types[id] as never), `${id} does not stream`).toBeNull();
    }
    expect(pelletOf(foamerData.types.F09 as never), "the Crawler streams").not.toBeNull();
  });
});
