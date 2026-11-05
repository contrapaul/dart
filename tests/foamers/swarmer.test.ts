import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import aiData from "../../data/ai.json";
import foamerData from "../../data/foamers.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { PACK } from "../../src/ai/f03-brain";

const DT = 1 / 60;
const HALF = 20;
const F03 = foamerData.types.F03;
const SWARM_CAP = aiData.difficulties.normal.swarm;

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
  const director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF });
  foamers.director = director;
  foamers.navGrid = grid;
  foamers.spawnState = "alert";
  world.step();
  grid.bake();
  const bonks: string[] = [];
  foamers.onBonk = (_f, id) => bonks.push(id);
  return { world, darts, foamers, director, grid, bonks };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
}

describe("the Swarmer in the Foamer system (GAME-10d stage 2)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. spawns on its own rig, health and spec, on the swarm pool", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, "F03")!;
    expect(f).not.toBeNull();
    expect(f.spec).toBe(specFor("F03"));
    expect(f.spec.rig).toBe("F03");
    expect(f.maxHealth).toBe(2);
    expect(f.maxHealth).toBeLessThan(r.foamers.spawn(new THREE.Vector3(4, 0, 0))!.maxHealth);
    expect(F03.attacks[0]!.damage).toBe(3);
    expect(f.agent, "it has a brain").not.toBeNull();
    expect(r.director.stats().swarm.cap).toBe(SWARM_CAP);
    expect(F03.pack).toBeGreaterThan(1);
  });

  it("2. spawnPack spawns a whole pack round a point, and stops at maxAlive", () => {
    const r = rig();
    const feet = new THREE.Vector3(0, 0, 0);
    const pack = r.foamers.spawnPack(feet);
    expect(pack.length).toBe(F03.pack);
    for (const f of pack) {
      expect(f.spec.rig).toBe("F03");
      expect(f.centre.distanceTo(feet), "round the point, not on it").toBeGreaterThan(0.3);
      expect(f.centre.distanceTo(feet)).toBeLessThanOrEqual(PACK.spreadMetres + 0.5);
    }
    // Past the cap the spawn is skipped, and nobody is removed to make room.
    const before = r.foamers.list.length;
    let live = before;
    while (live < PACK.maxAlive) {
      const more = r.foamers.spawnPack(feet);
      if (more.length === 0) break;
      live += more.length;
    }
    expect(live).toBe(PACK.maxAlive);
    const extra = r.foamers.spawnPack(feet, undefined, 4);
    expect(extra.length, "past the cap nothing spawns").toBe(0);
    expect(r.foamers.list.length, "nobody was removed").toBe(PACK.maxAlive);
    expect(r.foamers.list.every((f) => f.spec.rig === "F03")).toBe(true);
  });

  it("3. a pack does not eat the melee tokens an F01 needs", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    r.foamers.spawnPack(new THREE.Vector3(0, 0, -2.5), player);
    // A Slowmer beside the pack, in reach, wanting its own pool.
    const f01 = r.foamers.spawn(new THREE.Vector3(1.6, 0, -1.6), player)!;
    let sawF01Attack = false;
    let mostSwarm = 0;
    for (let i = 0; i < 60 * 10; i++) {
      tick(r, player);
      mostSwarm = Math.max(mostSwarm, r.director.stats().swarm.inUse);
      expect(r.director.stats().swarm.inUse, "swarm tokens").toBeLessThanOrEqual(SWARM_CAP);
      expect(r.director.stats().melee.inUse, "melee tokens").toBeLessThanOrEqual(
        aiData.difficulties.normal.melee,
      );
      if (f01.state === "windup" || f01.state === "strike") sawF01Attack = true;
    }
    expect(mostSwarm, "the pack nibbled together").toBeGreaterThan(0);
    expect(sawF01Attack, "the Slowmer still got a melee token").toBe(true);
  });

  it("4. it nibbles on the attack path, then backs out to its ring", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, -1.0), player, "F03")!;
    expect(f.sinceNibble).toBe(Infinity);
    let nibbled = false;
    for (let i = 0; i < 60 * 10 && !nibbled; i++) {
      tick(r, player);
      if (r.bonks.includes("nibble")) nibbled = true;
    }
    expect(nibbled, "it nibbled").toBe(true);
    expect(r.bonks.every((id) => id === "nibble" || id === "bite")).toBe(true);
    expect(f.sinceNibble).toBeLessThan(1);
    // It backs out from there: the ring is further than the attack range.
    const ring = f.centre.distanceTo(player);
    expect(F03.holdRangeMetres).toBeGreaterThan(F03.attackRange);
    let outAt = ring;
    for (let i = 0; i < 90; i++) {
      tick(r, player);
      outAt = Math.max(outAt, f.centre.distanceTo(player));
    }
    expect(outAt, "it darted back out").toBeGreaterThan(ring + 0.3);
  });

  it("5. the pack members wake together, not one at a time", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    // Idle, so nothing starts awake. The pack is beyond sight range (20 m)
    // and the scout is not, and sits inside the 8 m alert radius behind it.
    r.foamers.spawnState = "idle";
    const pack = r.foamers.spawnPack(new THREE.Vector3(0, 0, -24), player, 3);
    const scout = r.foamers.spawn(new THREE.Vector3(0, 0, -16.5), player, "F03")!;
    r.world.step();
    for (const f of [scout, ...pack]) expect(f.state).toBe("idle");
    let woke = 0;
    for (let i = 0; i < 30; i++) {
      tick(r, player);
      woke = pack.filter((f) => f.state !== "idle").length;
    }
    expect(woke, "every member of the pack heard the scout").toBe(pack.length);
  });
});
