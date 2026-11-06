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
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { blobOf, smallBlobKind, bigBlobKind } from "../../src/foamers/blob";

// GAME-10c stage 2: the Floater's blobs. A spit fires the small fan that
// bounces off geometry and bursts on its last touch; every fourth attack
// is the one big pink parryable blob; the live cap holds; and the open
// mouth is the only weak point.

const DT = 1 / 60;
const HALF = 20;
const BLOB = blobOf(specFor("F06"))!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig(withWall = true) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  if (withWall) {
    // A wall 4 m in +x: a blob fired sideways bounces off it.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 3, 8).setTranslation(4, 3, 0),
      body,
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
    body,
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
  return { world, darts, debris, foamers, projectiles, grid };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.projectiles.update(DT);
  r.world.step();
}

const PLAYER = new THREE.Vector3(0, 3, 6); // at its own height, 6 m away: a clear arc down to the eye

describe("the Floater's blobs (GAME-10c stage 2)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. a spit fires the small fan of blobs, not balls", () => {
    const r = rig();
    r.foamers.spawn(new THREE.Vector3(0, 3, 0), PLAYER.clone(), "F06")!;
    const kinds: unknown[] = [];
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    r.projectiles.launch = (fl, eye, spread, kind) => {
      kinds.push(kind);
      realLaunch(fl, eye, spread, kind);
    };
    for (let i = 0; i < 60 * 4 && r.projectiles.list.length === 0; i++) tick(r, PLAYER);
    expect(r.projectiles.list.length, "blobs in the air").toBe(BLOB.count);
    expect(kinds.every((k) => k && (k as { attack: string }).attack === "spit")).toBe(true);
    for (const b of r.projectiles.list) {
      expect(b.mesh.material, "small blobs are not the parry material")
        .not.toBe(BALL_MATERIAL);
      expect(b.bounceLeft, "each small blob carries its bounces").toBe(BLOB.bounces);
    }
  });

  it("2. a small blob bounces off a wall and bursts on its last touch", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), PLAYER.clone(), "F06")!;
    const kind = smallBlobKind(BLOB);
    // Fire one straight at the wall: it must bounce twice then burst.
    r.projectiles.launch(f, new THREE.Vector3(3.4, 3, 0), 0, kind);
    const bounces: number[] = [];
    r.projectiles.onSound = (snd, at) => {
      if (snd === "blobBounce") bounces.push(at.x);
    };
    for (let i = 0; i < 60 * 8 && r.projectiles.list.length; i++) {
      r.projectiles.update(DT);
      r.world.step();
    }
    expect(bounces.length, `bounced twice (heard ${bounces.length})`).toBe(BLOB.bounces);
    expect(bounces[0]!, "the first bounce was at the wall").toBeGreaterThan(3);
    expect(r.projectiles.stats.burst, "it burst at the end").toBe(1);
  });

  // Review fix: the blob was left with its centre on the surface it hit, so
  // the next frame's ray started inside it (a zero normal) and spent the
  // second bounce at once: in play it burst on the floor with no bounce.
  it("2b. a small blob off the floor rises again before its next bounce", () => {
    const r = rig(false);
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), PLAYER.clone(), "F06")!;
    r.projectiles.launch(f, new THREE.Vector3(0, 0, 5), 0, smallBlobKind(BLOB));
    const ticks: number[] = [];
    let i = 0;
    r.projectiles.onSound = (snd) => { if (snd === "blobBounce") ticks.push(i); };
    let peakAfter = -Infinity;
    for (; i < 60 * 8 && r.projectiles.list.length; i++) {
      r.projectiles.update(DT);
      r.world.step();
      const b = r.projectiles.list[0];
      if (b && ticks.length === 1) peakAfter = Math.max(peakAfter, b.pos.y);
    }
    expect(ticks.length).toBe(BLOB.bounces);
    expect(ticks[1]! - ticks[0]!, "frames between the two bounces").toBeGreaterThan(6);
    expect(peakAfter, "it rose off the floor after the first bounce").toBeGreaterThan(0.2);
  });

  it("3. every fourth attack is the one big pink parryable blob", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), PLAYER.clone(), "F06")!;
    const seen: { attack: string; turn: number }[] = [];
    const realLaunch = r.projectiles.launch.bind(r.projectiles);
    r.projectiles.launch = (fl, eye, spread, kind) => {
      seen.push({ attack: kind?.attack ?? "throw", turn: f.blobTurn });
      realLaunch(fl, eye, spread, kind);
    };
    // Let it fight until it has fired four attacks.
    for (let i = 0; i < 60 * 90 && f.blobTurn < 4; i++) tick(r, PLAYER);
    expect(f.blobTurn, "four attacks fired").toBeGreaterThanOrEqual(4);
    // The counter turns at the release, before the launches: attacks 1-3
    // are small fans (turn 1, 2, 3), the fourth is the big blob (turn 4).
    const first = seen.filter((s) => s.turn === 1);
    const fourth = seen.filter((s) => s.turn === 4);
    expect(first.length, "the first attack fired the fan").toBe(BLOB.count);
    expect(first.every((s) => s.attack === "spit")).toBe(true);
    expect(fourth, `the fourth attack was one big blob (${JSON.stringify(seen)})`)
      .toEqual([{ attack: "bigBlob", turn: 4 }]);
    const big = r.projectiles.list.find((b) => b.attack === "bigBlob");
    expect(big, "the big blob is live").toBeDefined();
    expect(big!.mesh.material, "the big blob is the parry material").toBe(BALL_MATERIAL);
    expect(big!.bounceLeft, "the big blob does not bounce").toBe(0);
    expect(big!.mesh.scale.x, "bigger than a small blob").toBeGreaterThan(BLOB.radius);
    expect(big!.vel.length(), "slower than a small blob").toBeLessThan(BLOB.speed);
  });

  it("4. the live cap holds under a storm of spits", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 3, 0), PLAYER.clone(), "F06")!;
    const kind = smallBlobKind(BLOB);
    for (let i = 0; i < 20; i++) r.projectiles.launch(f, PLAYER, 0, kind);
    expect(r.projectiles.list.length, "no more than the data cap").toBeLessThanOrEqual(
      BLOB.maxLive,
    );
  });

  it("5. the mouth takes the weak-point damage only while the jaw is open", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F06")!;
    const mouth = (specFor("F06") as unknown as { mouth: { part: string; damage: number } }).mouth;
    expect(mouth.part).toBe("jaw");
    for (const part of f.parts.values()) {
      part.mesh.update();
      await new Promise((res) => setTimeout(res, 0));
      r.world.step();
    }
    const jaw = f.parts.get("jaw")!;
    for (let i = 0; i < 60; i++) tick(r, PLAYER);
    // One deterministic dart hit, not a fired dart: a fired one ricochets
    // and the count of hits it makes varies with the blended pose. A
    // collider on the jaw's own body is what the systems read as that part
    // (foamer-part.ts owns()).
    const probe = r.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.35, 0.1, 0.35),
      jaw.body,
    );
    const hitJaw = (open: boolean) => {
      f.health = f.maxHealth;
      f.state = open ? "windup" : "approach"; // open: mid-spit, the jaw is down
      r.darts.onHit({
        point: jaw.voxelToWorld(new THREE.Vector3(10, 2, 4)),
        normal: new THREE.Vector3(-1, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        speed: 25, // well over the damage speed
        type: "standard",
        collider: probe,
        material: null,
        shot: null,
      });
      return f.maxHealth - f.health;
    };
    const shut = hitJaw(false);
    const open = hitJaw(true);
    expect(shut, "a dart on the shut jaw still hurts").toBeGreaterThan(0);
    expect(open, "the open mouth takes the multiplier").toBeCloseTo(shut * mouth.damage, 5);
  });

  it("6. blob numbers and kinds come from the data, and no other type spits", () => {
    expect(BLOB.count).toBe(3);
    expect(BLOB.bounces).toBe(2);
    expect(BLOB.everyFourth).toBe(4);
    expect(BLOB.maxLive).toBe(12);
    expect(BLOB.big.radius).toBeGreaterThan(BLOB.radius);
    expect(BLOB.big.speed).toBeLessThan(BLOB.speed);
    expect(blobOf(specFor("F02")), "the Roamer still throws balls").toBeNull();
    expect(blobOf(specFor("F04")), "the Blocker still volleys balls").toBeNull();
    const small = smallBlobKind(BLOB);
    expect(small.attack).toBe("spit");
    expect(small.bounces).toBe(BLOB.bounces);
    const big = bigBlobKind(BLOB);
    expect(big.attack).toBe("bigBlob");
    expect(big.mesh).toBe(BALL_MATERIAL);
    expect(foamerData.types.F06).toBeTruthy();
  });
});
