import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import envJson from "../../data/levels/env-05.json";
import { buildLevel } from "../../src/level/build";
import { buildAmbushes } from "../../src/level/ambush";
import { validateLevel } from "../../src/level/validate";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import type { VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import type { Level } from "../../src/level/format";

// GAME-10m stage 3: the ambush from a growth. The tests walk env-05's
// room: hidden means inert (nothing in the FoamerSystem's lists at all),
// the player coming within wakeMetres wakes it, and a growth losing a
// voxel wakes it from anywhere. Waking must start the pounce at once.

const level = envJson as unknown as Level;
const DT = 1 / 60;
const WAKE = 6; // data/foamers.json types.F12.ambush.wakeMetres

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

/** env-05 built, with its ambush system and a player whose feet the test
 *  moves. The player stands in for the page's controller: the eye is the
 *  feet plus a metre, as the arena page's feetPos/eye pair read. */
async function setup() {
  const { rapier, world } = await createPhysics();
  const built = buildLevel(level, rapier, world, FAKE);
  built.voxelMesh.update();
  const debris = new DebrisSystem(rapier, world);
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, world.createCollider(
    RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(0, -100, 0),
  ));
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(rapier, world, FAKE, debris, darts, targets);
  foamers.director = new Director("normal");
  foamers.spawnCount = 0; // the spawner is off: the level's waves own the count
  const feet = new THREE.Vector3(0, 0, 6); // the file's playerStart
  const player = {
    eye(alpha: number, out: THREE.Vector3) {
      return out.set(feet.x, feet.y + alpha, feet.z);
    },
  };
  const ambushes = buildAmbushes(level, foamers, built.voxels, built.voxelMesh, player);
  ambushes.countVoxels();
  return { world, built, foamers, ambushes, feet };
}

/** The growth's solid voxel count now (a hole in it shows here). */
function growthVoxels(built: ReturnType<typeof buildLevel>): number {
  const lo = built.voxelMesh.worldToVoxel(new THREE.Vector3(-2.8, 0, -3.8));
  const hi = built.voxelMesh.worldToVoxel(new THREE.Vector3(-1.2, 1.6, -2.2));
  let n = 0;
  for (let x = Math.floor(lo.x); x < Math.ceil(hi.x); x++)
    for (let y = Math.floor(lo.y); y < Math.ceil(hi.y); y++)
      for (let z = Math.floor(lo.z); z < Math.ceil(hi.z); z++)
        if (built.voxels.get(x, y, z) !== 0) n++;
  return n;
}

describe("GAME-10m stage 3: the ambush in env-05", () => {
  it("the file validates, registers and lists one ambush in a growth", () => {
    expect(validateLevel(level).errors).toEqual([]);
    expect(level.ambushes!.length).toBe(1);
    const growth = level.pieces!.find((p) => p.id === level.ambushes![0]!.growth)!;
    expect(growth.kind).toBe("growth");
  });

  it("a hidden ambusher is inert: nothing in the system's lists", async () => {
    const r = await setup();
    expect(r.ambushes.ids).toEqual(["amb-1"]);
    expect(r.ambushes.isHidden("amb-1")).toBe(true);
    expect(r.foamers.list.length).toBe(0);
    expect(r.foamers.live).toBe(0);
    expect(r.foamers.downed.length).toBe(0);
    // Step a while far away: still nothing, so no wave or level counter
    // can see it, and nothing is drawn or has a collider.
    for (let i = 0; i < 60; i++) expect(r.ambushes.step(DT, r.feet).length).toBe(0);
    expect(r.foamers.list.length).toBe(0);
  });

  it("the player coming within wakeMetres wakes it, and it pounces at once", async () => {
    const r = await setup();
    // Just outside: 6 m from the growth's box (its near side is z = -2.2).
    r.feet.set(-2, 0, -2.2 + WAKE + 0.2);
    expect(r.ambushes.step(DT, r.feet).length).toBe(0);
    // Just inside.
    r.feet.set(-2, 0, -2.2 + WAKE - 0.2);
    const woke = r.ambushes.step(DT, r.feet);
    expect(woke.map((w) => w.id)).toEqual(["amb-1"]);
    expect(r.ambushes.isHidden("amb-1")).toBe(false);
    expect(r.foamers.list.length).toBe(1);
    const f = r.foamers.list[0]!;
    expect(f.spec.rig).toBe("F12");
    // The pounce has started: folded in the crouch, aimed at the player,
    // off cooldown, and it has not hit yet.
    expect(f.state).toBe("crouch");
    expect(f.pounceX).toBeCloseTo(r.feet.x, 5);
    expect(f.pounceZ).toBeCloseTo(r.feet.z, 5);
    expect(f.leapCooldown).toBe(0);
    expect(f.pounced).toBe(false);
    // It bursts out of its own growth: the hole is carved.
    expect(growthVoxels(r.built)).toBeLessThan(16 * 16 * 16);
    // The crouch runs out and it flies (the stage 2 path takes over).
    for (let i = 0; i < 40; i++) r.foamers.update(DT, new THREE.Vector3(r.feet.x, 1.6, r.feet.z));
    expect(["leaping", "recover", "approach"]).toContain(f.state);
  });

  it("carving its growth wakes it from the far side of the room", async () => {
    const r = await setup();
    // Far away: the distance test cannot be what wakes it.
    r.feet.set(7, 0, 7);
    expect(r.ambushes.step(DT, r.feet).length).toBe(0);
    const before = growthVoxels(r.built);
    expect(before).toBeGreaterThan(0);
    // One voxel of the growth goes (what a dart carve does to it). The
    // loss test runs at the type's recheckSeconds cadence (0.25 s from
    // data/foamers.json), so step until it lands.
    const v = r.built.voxelMesh.worldToVoxel(new THREE.Vector3(-2, 1.2, -3));
    r.built.voxels.set(Math.round(v.x), Math.round(v.y), Math.round(v.z), 0);
    let woke: { id: string }[] = [];
    for (let i = 0; i < 30 && woke.length === 0; i++) woke = r.ambushes.step(DT, r.feet);
    expect(woke.map((w) => w.id)).toEqual(["amb-1"]);
    expect(r.foamers.list.length).toBe(1);
    expect(r.foamers.list[0]!.state).toBe("crouch");
  });

  it("the burst's carve is reported to the page's island and grid path", async () => {
    const r = await setup();
    const reported: number[] = [];
    r.ambushes.onCarveReport = (removed) => reported.push(removed.length);
    r.feet.set(-2, 0, -3); // inside the growth's box
    expect(r.ambushes.step(DT, r.feet).length).toBe(1);
    expect(reported.length).toBe(1);
    expect(reported[0]).toBeGreaterThan(0);
  });

  it("a restart hides it again and takes the woken one out", async () => {
    const r = await setup();
    r.feet.set(-2, 0, -3);
    expect(r.ambushes.step(DT, r.feet).length).toBe(1);
    expect(r.foamers.list.length).toBe(1);
    r.ambushes.reset();
    expect(r.foamers.list.length).toBe(0);
    expect(r.ambushes.isHidden("amb-1")).toBe(true);
  });
});

describe("GAME-10m stage 3: the validator on ambushes", () => {
  function broken(edit: (l: Level) => void): Level {
    const l = structuredClone(level);
    edit(l);
    return l;
  }
  const errorsOf = (l: Level) => validateLevel(l).errors;

  it("rejects an ambush whose growth does not exist", () => {
    expect(errorsOf(broken((l) => { l.ambushes![0]!.growth = "nope"; })))
      .toContain("ambush amb-1: growth nope is not a growth piece (no such piece)");
  });

  it("rejects an ambush whose piece is not a growth", () => {
    const l = broken((l) => { l.pieces![0]!.kind = "cover"; });
    expect(errorsOf(l)).toContain("ambush amb-1: growth growth-a is not a growth piece (it is a cover)");
  });

  it("rejects an unknown foamer", () => {
    expect(errorsOf(broken((l) => { l.ambushes![0]!.foamer = "F99"; })))
      .toContain("ambush amb-1: unknown foamer F99");
  });

  it("rejects a type that does not ambush (the F01 has no ambush block)", () => {
    expect(errorsOf(broken((l) => { l.ambushes![0]!.foamer = "F01"; }))
      .join(" ")).toMatch(/ambush amb-1: foamer F01 has no ambush block/);
  });

  it("rejects an ambush id used twice", () => {
    const l = broken((l) => { l.ambushes!.push({ id: "amb-1", foamer: "F12", growth: "growth-b" }); });
    expect(errorsOf(l)).toContain("ambush amb-1: id used twice");
  });
});
