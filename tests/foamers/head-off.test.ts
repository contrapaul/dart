import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { carveSphere } from "../../src/voxel/carve";
import type { Foamer } from "../../src/foamers/foamer";
import type { GameRig } from "../../src/foamers/foamer";
import rigData from "../../data/foamer-rigs.json";
import foamerData from "../../data/foamers.json";

// PT-02 (Paul, 2026-11-08): a Foamer that loses its head goes down, whatever
// its health. Replaces D12's head-and-an-arm rule. The rule lives in
// breakPart, so it fires for every cause that takes the part off.

const DT = 1 / 60;
const RIGS = rigData.rigs as unknown as GameRig[];

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
  world.step();
  return { world, darts, debris, targets, foamers };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, player);
  r.debris.update(dt);
  r.world.step();
}

async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  for (;;) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((res) => setTimeout(res, 0));
  }
  world.step();
}

async function settleAll(r: ReturnType<typeof rig>, f: Foamer) {
  for (const part of f.parts.values()) await settle(part.mesh, r.world);
}

/** Spawn one type and mesh it. */
async function make(r: ReturnType<typeof rig>, type: string) {
  const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), undefined, type)!;
  r.world.step();
  await settleAll(r, f);
  return f;
}

/** The types whose rig has a head part that can come off: kind "head" and
 *  not the root (the F05's face is on its body, which never breaks off). */
const HEADED = RIGS.filter((rg) =>
  rg.parts.some((p) => p.kind === "head" && p.parent !== null)).map((rg) => rg.id);
/** The types with no head part to lose at all. */
const HEADLESS = RIGS.filter((rg) =>
  !rg.parts.some((p) => p.kind === "head")).map((rg) => rg.id);

const PLAYER = new THREE.Vector3(0, 1.6, 8);

beforeAll(async () => { await RAPIER.init(); });

describe("PT-02: the head off means down", () => {
  it("1. every type with a head part goes down when it comes off, with health left", async () => {
    expect(HEADED.length, "the rigs with a breakable head").toBe(10);
    for (const type of HEADED) {
      const r = rig();
      const f = await make(r, type);
      const health = f.health;
      expect(health, `${type} starts with health`).toBeGreaterThan(0);
      expect(f.state, `${type} starts alive`).not.toBe("down");
      f.parts.get("head")!.hp = 0;
      tick(r, PLAYER); // the once-per-step break check takes the part
      expect(f.state, `${type} is down`).toBe("down");
      expect(f.health, `${type} still had health`).toBe(health);
      expect(r.foamers.downed.length, `${type} counted once as downed`).toBe(1);
      expect(r.foamers.stats.popped, `${type} did not pop`).toBe(0);
      expect(f.parts.has("head"), `${type} lost the part`).toBe(false);
      expect(r.foamers.broken.length, `${type} shed the head as a piece`).toBe(1);
    }
  });

  it("2. a type with no head part is unaffected: it keeps walking", async () => {
    expect(HEADLESS.sort(), "the rigs with no head").toEqual(["F06", "F09"]);
    for (const type of HEADLESS) {
      const r = rig();
      const f = await make(r, type);
      for (let i = 0; i < 60; i++) tick(r, PLAYER);
      expect(f.state, `${type} is not down`).not.toBe("down");
      expect(f.health, `${type} is whole`).toBe(f.maxHealth);
    }
  });

  it("3. an arm alone does not down it; it staggers as any other break does", async () => {
    const r = rig();
    const f = await make(r, "F01");
    const arm = f.parts.get("foreArmL")!;
    arm.hp = 0;
    tick(r, PLAYER);
    expect(f.parts.has("foreArmL"), "the arm came off").toBe(false);
    expect(f.state, "an arm alone leaves it standing").not.toBe("down");
    expect(r.foamers.downed.length, "nothing downed").toBe(0);
  });

  it("4. a hit that takes the head and the last health at once downs it once", async () => {
    const r = rig();
    const f = await make(r, "F01");
    // A standard dart on the head is 2 damage (hit 2, total 1): enough to
    // spend the last of its health and break the head in the same step.
    f.health = 1.5;
    const head = f.parts.get("head")!;
    const c = head.voxelToWorld(new THREE.Vector3(
      head.spec.size[0] / 2, head.spec.size[1] / 2, head.spec.size[2] / 2));
    r.darts.fire(new THREE.Vector3(c.x, c.y, c.z + 1), new THREE.Vector3(0, 0, -1), "standard");
    for (let i = 0; i < 240 && f.state !== "down"; i++) tick(r, PLAYER);
    expect(f.state, "down").toBe("down");
    expect(r.foamers.downed.length, "one down, not two").toBe(1);
    expect(r.foamers.stats.popped, "the dart is not a popping type").toBe(0);
    for (let i = 0; i < 30; i++) tick(r, PLAYER);
    expect(r.foamers.downed.length, "still one").toBe(1);
  });

  it("5. the head carved away (an explosion or a chunk) downs it on the wear check", async () => {
    const r = rig();
    const f = await make(r, "F01");
    const head = f.parts.get("head")!;
    const [sx, sy, sz] = head.spec.size;
    carveSphere(head.volume, sx / 2, sy / 2, sz / 2, Math.max(sx, sy, sz));
    expect(head.voxelCount, "most of its foam is gone").toBeLessThan(
      head.startVoxels * (1 - foamerData.test.partDamage.wearBreak));
    tick(r, PLAYER); // one update: the wear check breaks the part
    expect(f.state, "down").toBe("down");
    expect(f.health, "with health left").toBeGreaterThan(0);
  });

  it("6. headOffDowns false opts out (a boss later), and the flag is in the base data", () => {
    expect(foamerData.test.headOffDowns, "default true in the shared base").toBe(true);
    expect(specFor("F01").headOffDowns, "every type inherits it").toBe(true);
  });

  it("7. with the flag off, a lost head does not down it", async () => {
    const r = rig();
    const f = await make(r, "F01");
    const spec = f.spec;
    const saved = spec.headOffDowns;
    spec.headOffDowns = false;
    try {
      f.parts.get("head")!.hp = 0;
      tick(r, PLAYER);
      expect(f.parts.has("head"), "the head came off").toBe(false);
      expect(f.state, "the old no-head handicap is gone, but it is not down").not.toBe("down");
      expect(f.turnRate(), "and it turns at its full rate").toBe(spec.turnRate);
    } finally {
      spec.headOffDowns = saved;
    }
  });

  it("8. the F05: its face is the root part, whose kind is head, so its loss downs it too", async () => {
    // The Darter's rig carries the face on its root part (id "body", kind
    // "head", no parent), and a root part can break off like any other:
    // before PT-02 that left it alive and partless. Now losing it is the
    // head coming off, so it goes down.
    const r = rig();
    const f = await make(r, "F05");
    const root = f.parts.get("body")!;
    expect(root.spec.kind, "kind head, it carries the face").toBe("head");
    expect(root.spec.parent, "and it is the root").toBeNull();
    root.hp = 0;
    tick(r, PLAYER);
    expect(f.state, "down").toBe("down");
    expect(r.foamers.downed.length, "counted once").toBe(1);
  });
});
