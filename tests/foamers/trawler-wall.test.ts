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
import { ProjectileSystem, BALL_MATERIAL } from "../../src/foamers/projectiles";
import { Director } from "../../src/ai/director";
import { wallKind, wallSlots, type WallSpec } from "../../src/foamers/wall";
import { NavGrid } from "../../src/ai/nav-grid";
import type { Foamer } from "../../src/foamers/foamer";

// GAME-10h stage 2: the Trawler's wall of foam balls. One flat row across
// the aim line at the player's chest, launched at once, slow and flat so it
// can be read, with a seeded gap a player can step through. Each launcher
// owns its half and is a weak point; with both gone it cannot fire and
// stomps.

const DT = 1 / 60;
const PLAYER = new THREE.Vector3(0, 1.6, 0);
const WALL = (foamerData.types.F08 as unknown as { wall: WallSpec }).wall;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig(wall: boolean = false) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  if (wall) {
    // A voxel wall's worth of solid geometry between the two (what a ball's
    // raycast treats as the world), wide enough there is no way round.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(40, 1, 0.2).setTranslation(0, 1.2, 6),
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
  const grid = new NavGrid(RAPIER, world, { minX: -40, maxX: 40, minZ: -40, maxZ: 40 });
  foamers.navGrid = grid;
  world.step();
  grid.bake();
  return { world, playerBody, darts, foamers, projectiles, grid, t: 0 };
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

/** Move the player's capsule (the collider follows the kinematic body). */
function movePlayer(r: Rig, at: THREE.Vector3) {
  r.playerBody.setNextKinematicTranslation({ x: at.x, y: at.y, z: at.z });
  r.world.step();
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F08 wall (GAME-10h stage 2)", () => {
  it("5. a wall is 2 x ballsPerLauncher - gapBalls balls, in one step, in one row", () => {
    const r = rig();
    r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F08");
    let shot: { slots: number[]; from: THREE.Vector3; dx: number; dz: number } | null = null;
    const real = r.projectiles.launchWall.bind(r.projectiles);
    r.projectiles.launchWall = (f, from, dx, dz, slots, count, spacing, kind) => {
      expect(count, "the row's full width is both halves").toBe(WALL.ballsPerLauncher * 2);
      expect(spacing).toBe(WALL.spacingMetres);
      if (!shot) shot = { slots: [...slots], from: from.clone(), dx, dz };
      real(f, from, dx, dz, slots, count, spacing, kind);
    };
    // wallTurn counts when the attack is chosen (the windup); wallFired only
    // once the row has actually left the launchers, which is what this test reads.
    until(r, PLAYER, (f) => f.wallFired);
    expect(shot, "it fired a wall").not.toBeNull();
    expect(shot!.slots.length).toBe(WALL.ballsPerLauncher * 2 - WALL.gapBalls);
    const balls = r.projectiles.list.filter((b) => b.attack === "wall");
    expect(balls.length, "every ball of the wall is live after the one step").toBe(shot!.slots.length);
    // One row: the same height, no vertical motion.
    for (const b of balls) {
      expect(b.pos.y, "flat, at the player's chest").toBeCloseTo(PLAYER.y - WALL.chestBelowEyeMetres, 5);
      expect(b.vel.y).toBe(0);
    }
    // Each ball sits on its own slot of the row: across the aim line, spaced
    // by spacingMetres, except across the gap, which leaves room for the gap
    // (the ball beside it is gone).
    const count = WALL.ballsPerLauncher * 2;
    const d = Math.hypot(shot!.dx, shot!.dz);
    const off = (i: number) => (i - (count - 1) / 2) * WALL.spacingMetres;
    const slotX = (i: number) => shot!.from.x + (shot!.dz / d) * off(i);
    const expected = shot!.slots.map(slotX).sort((a, b) => a - b);
    const xs = balls.map((b) => b.pos.x).sort((a, b) => a - b);
    // The row has been flying for a few steps when it is read, so the balls
    // are ballSpeed/60 m past their slots: allow a millimetre for float and
    // the sub-step.
    for (let i = 0; i < xs.length; i++) expect(Math.abs(xs[i]! - expected[i]!), `ball ${i} sits on its slot`).toBeLessThan(5e-3);
  }, 20000);

  it("6. the gap is never at an end, and the same seed gives the same gap", () => {
    const rows: number[][] = [];
    for (const _ of [0, 1]) {
      const r = rig();
      r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F08");
      const real = r.projectiles.launchWall.bind(r.projectiles);
      r.projectiles.launchWall = (f, from, dx, dz, slots, count, spacing, kind) => {
        if (f.wallTurn === 1) rows.push([...slots]);
        real(f, from, dx, dz, slots, count, spacing, kind);
      };
      until(r, PLAYER, (f) => f.wallFired);
    }
    const full = Array.from({ length: WALL.ballsPerLauncher * 2 }, (_, i) => i);
    for (const row of rows) {
      const missing = full.filter((i) => !row.includes(i));
      expect(missing.length, "gapBalls balls are left out").toBe(WALL.gapBalls);
      expect(missing, "the gap is one run of side-by-side balls")
        .toEqual(Array.from({ length: WALL.gapBalls }, (_, i) => missing[0]! + i));
      expect(missing[0]!, "never at the row's ends").toBeGreaterThan(0);
      expect(missing.at(-1)!, "never at the row's ends").toBeLessThan(full.length - 1);
    }
    expect(rows[1], "the same seed and wall number give the same gap").toEqual(rows[0]);
    // And the rule holds for every seed the data could carry.
    for (let seed = 0; seed < 40; seed++) {
      const row = wallSlots(WALL, WALL.launchers, () => ((seed * 2654435761) % 997) / 997);
      const miss = full.filter((i) => !row.includes(i));
      expect(miss.length).toBe(WALL.gapBalls);
      expect(miss[0]! > 0 && miss.at(-1)! < full.length - 1, `seed ${seed}`).toBe(true);
    }
  }, 20000);

  it("7. a player standing in the gap is not hit; one beside it is", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F08")!;
    let from: THREE.Vector3 | null = null;
    let slots: number[] | null = null;
    let aimX = 0, aimZ = 0;
    const real = r.projectiles.launchWall.bind(r.projectiles);
    r.projectiles.launchWall = (fo, fr, dx, dz, sl, count, spacing, kind) => {
      if (!slots) { from = fr.clone(); slots = [...sl]; aimX = dx; aimZ = dz; }
      real(fo, fr, dx, dz, sl, count, spacing, kind);
    };
    // The player stays on the aim line while the first wall leaves, so that
    // row flies straight at the origin; only then does the player move.
    until(r, PLAYER, () => slots !== null);
    const missing = Array.from({ length: WALL.ballsPerLauncher * 2 }, (_, i) => i)
      .filter((i) => !slots!.includes(i));
    expect(missing.length, "the first wall left gapBalls balls out").toBe(WALL.gapBalls);
    // Where each ball crosses the player's stand (z = 0): the row flies
    // parallel to the aim, so a gap in the row is the same gap where the
    // balls cross.
    const count = WALL.ballsPerLauncher * 2;
    const d = Math.hypot(aimX, aimZ);
    const ux = aimX / d, uz = aimZ / d;
    const rx = uz, rz = -ux;
    const cross = (i: number) => {
      const off = (i - (count - 1) / 2) * WALL.spacingMetres;
      const zi = from!.z + rz * off;
      return from!.x + rx * off + (ux * zi) / uz;
    };
    // The gap's live neighbours (it is never at an end, so both exist).
    const xGap = (cross(missing[0]! - 1) + cross(missing.at(-1)! + 1)) / 2;
    const xSide = cross(missing[0]! - 1);
    r.projectiles.clear();
    // Run the balls without the brain, so only the row on offer touches the
    // player and no later wall re-aims at wherever the player moved.
    const proj = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / DT); i++) { r.projectiles.update(DT); r.world.step(); r.t += DT; }
    };
    // In the gap: stand halway between the gap's two live neighbours, and
    // launch exactly that row again at the player.
    movePlayer(r, new THREE.Vector3(xGap, 1, 0));
    const before = r.projectiles.stats.hitPlayer;
    r.projectiles.launchWall(f, from!, aimX, aimZ, slots!, count, WALL.spacingMetres, wallKind(WALL));
    proj(2.5);
    expect(r.projectiles.stats.hitPlayer - before, "nothing touched the player in the gap").toBe(0);
    r.projectiles.clear();
    // Beside it: on the line of the live slot next to the gap, and the row
    // again.
    movePlayer(r, new THREE.Vector3(xSide, 1, 0));
    const before2 = r.projectiles.stats.hitPlayer;
    r.projectiles.launchWall(f, from!, aimX, aimZ, slots!, count, WALL.spacingMetres, wallKind(WALL));
    proj(2.5);
    expect(r.projectiles.stats.hitPlayer - before2, "a ball met the player beside the gap")
      .toBeGreaterThan(0);
  }, 20000);

  it("8. a wall between it and the player stops every ball", () => {
    const r = rig(true);
    r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F08");
    const hits: number[] = [];
    const real = r.projectiles.launchWall.bind(r.projectiles);
    r.projectiles.launchWall = (f, from, dx, dz, slots, count, spacing, kind) => {
      hits.push(slots.length);
      real(f, from, dx, dz, slots, count, spacing, kind);
    };
    until(r, PLAYER, (f) => f.wallFired);
    expect(hits.length, "it fired").toBeGreaterThan(0);
    for (let i = 0; i < Math.round(1 / DT); i++) tick(r, PLAYER);
    expect(r.projectiles.list.filter((b) => b.attack === "wall").length,
      "the wall's geometry burst them all").toBe(0);
    expect(r.projectiles.stats.hitPlayer, "none reached the player behind it").toBe(0);
  }, 20000);

  it("9. a launcher is a weak point: darts on it take the multiplier", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F08")!;
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
      part.hp = part.maxHp; // PT-07: a weapon part never takes health off the Foamer
      f.state = "approach";
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
      // PT-07: a weapon part's damage comes off its own hp, not the
      // Trawler's health, so the part's hp is the measure for both.
      return part.maxHp - part.hp;
    };
    // leg and launcher are kinds with the same hit share (partDamage in the
    // base spec), so the only difference is the weak point.
    const leg = hit("legL");
    const launcher = hit("launcherR");
    expect(leg, "a dart on a leg hurts").toBeGreaterThan(0);
    expect(launcher, "the launcher takes the multiplier")
      .toBeCloseTo(leg * WALL.weakpointMultiplier, 5);
  });

  it("10. one launcher gone halves the row; both gone means no balls and a stomp", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F08")!;
    f.parts.delete("launcherL");
    const sizes: number[] = [];
    const real = r.projectiles.launchWall.bind(r.projectiles);
    r.projectiles.launchWall = (fo, from, dx, dz, slots, count, spacing, kind) => {
      sizes.push(slots.length);
      real(fo, from, dx, dz, slots, count, spacing, kind);
    };
    until(r, PLAYER, () => sizes.length > 0);
    expect(sizes[0], "half the row, less the gap of what is left")
      .toBe(WALL.ballsPerLauncher - WALL.gapBalls);

    const r2 = rig();
    const g = r2.foamers.spawn(new THREE.Vector3(0, 0, 3), PLAYER, "F08")!;
    g.parts.delete("launcherL");
    g.parts.delete("launcherR");
    let launched = 0;
    const bonks: string[] = [];
    const real2 = r2.projectiles.launchWall.bind(r2.projectiles);
    r2.projectiles.launchWall = (fo, from, dx, dz, slots, count, spacing, kind) => {
      launched++;
      real2(fo, from, dx, dz, slots, count, spacing, kind);
    };
    r2.foamers.onBonk = (fo, attack) => { bonks.push(attack); void fo; };
    until(r2, PLAYER, () => bonks.length > 0, 40);
    expect(launched, "with both launchers gone it cannot fire").toBe(0);
    expect(r2.projectiles.list.filter((b) => b.attack === "wall").length).toBe(0);
    expect(bonks[0], `it walks in and stomps (${bonks})`).toBe("stomp");
    const stomp = foamerData.types.F08.attacks.find((a) => a.id === "stomp")!;
    expect(stomp.damage).toBe(12);
  }, 30000);

  it("11. the wall's ball is a BallKind from the data: slow, flat, orange, not parryable", () => {
    const kind = wallKind(WALL);
    expect(kind.attack).toBe("wall");
    expect(kind.speed, "slow enough to read").toBeLessThan(12);
    expect(kind.gravity, "flat").toBe(0);
    expect(kind.radius).toBe(0.15);
    expect(kind.bounces, "no bounce: it bursts on any geometry").toBe(0);
    expect(kind.maxLive).toBe(40);
    expect(kind.mesh, "not the parry material").not.toBe(BALL_MATERIAL);
    expect((kind.mesh as THREE.MeshStandardMaterial).color.getHex())
      .not.toBe((BALL_MATERIAL as THREE.MeshStandardMaterial).color.getHex());
  });

  it("12. the live cap holds", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 14), PLAYER, "F08")!;
    const kind = wallKind(WALL);
    for (let i = 0; i < 30; i++)
      r.projectiles.launchWall(f, new THREE.Vector3(0, 1.2, 10), 0, -1,
        [0, 1, 2, 3, 4], 10, WALL.spacingMetres, kind);
    expect(r.projectiles.list.length, `at most maxLive (${WALL.maxLive}) balls live`)
      .toBeLessThanOrEqual(WALL.maxLive);
    expect(r.projectiles.list.every((b) => b.attack === "wall")).toBe(true);
  });

  it("13. every other type is untouched: no balls of the wall kind", () => {
    const r = rig();
    r.foamers.spawn(new THREE.Vector3(0, 0, 12), PLAYER, "F02");
    r.foamers.spawn(new THREE.Vector3(3, 0, 14), PLAYER, "F09");
    for (let i = 0; i < Math.round(10 / DT); i++) tick(r, PLAYER);
    expect(r.projectiles.list.some((b) => b.attack === "wall"),
      "no other type fires a wall").toBe(false);
  }, 20000);
});
