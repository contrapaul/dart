import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable, materialId } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Foamer } from "../../src/foamers/foamer";
import type { GameRig } from "../../src/foamers/foamer";
import { FoamerPart } from "../../src/foamers/foamer-part";
import { carveSphere } from "../../src/voxel/carve";
import rigData from "../../data/foamer-rigs.json";
import foamerData from "../../data/foamers.json";

const DT = 1 / 60;
const SPEC = foamerData.test;
const CORE = materialId("foam-core");
const RIG = (rigData.rigs as unknown as GameRig[]).find((r) => r.id === "F01")!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Let a pending remesh resolve, then step once more so the fresh colliders
 *  exist in the world. */
async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
}

/** Mesh every part once: only then does a dart find (and carve) that part. */
async function settleAll(r: { world: RAPIER.World }, f: Foamer) {
  for (const part of f.parts.values()) await settle(part.mesh, r.world);
}

/** World, floor, debris, darts (ignore collider 200 m away), impacts, the
 *  Foamer system and the shared target list. */
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
  r.world.step();
}

/** The part's box centre in world space, from its current pose. */
function centreOf(part: FoamerPart) {
  return part.voxelToWorld(new THREE.Vector3(
    part.spec.size[0] / 2, part.spec.size[1] / 2, part.spec.size[2] / 2));
}

/** Count of one material in a part's volume. */
function materialCount(part: FoamerPart, material: number) {
  let n = 0;
  const s = part.spec.size;
  for (const chunk of part.volume.chunks.values())
    for (let y = 0; y < s[1]; y++)
      for (let z = 0; z < s[2]; z++)
        for (let x = 0; x < s[0]; x++)
          if (chunk.get(x, y, z) === material) n++;
  return n;
}

/** Fire one standard dart head on at the part's box centre: from one metre
 *  along `dir` (unit, pointing toward the part), so the part's own face is
 *  the first thing the dart meets. */
function fireAt(r: ReturnType<typeof rig>, part: FoamerPart, dir: [number, number, number]) {
  const d = new THREE.Vector3(...dir).normalize();
  r.darts.fire(centreOf(part).addScaledVector(d, -1.0), d, "standard");
}

/** Step until this dart changed the part (hp, carve or wound core), or give
 *  up after `max` steps. */
async function connect(r: ReturnType<typeof rig>, player: THREE.Vector3, part: FoamerPart, max = 150) {
  const bHp = part.hp, bVox = part.voxelCount, bCore = materialCount(part, CORE);
  for (let i = 0; i < max; i++) {
    tick(r, player);
    if (part.hp !== bHp || part.voxelCount !== bVox || materialCount(part, CORE) !== bCore) return;
  }
  throw new Error(`${part.spec.id} was not hit in ${max} steps`);
}

/** World AABB of a part's box, from its current pose. */
const _abV = new THREE.Vector3();
function partBox(part: FoamerPart, min: THREE.Vector3, max: THREE.Vector3) {
  const [sx, sy, sz] = part.spec.size;
  const vs = part.volume.voxelSize;
  min.set(Infinity, Infinity, Infinity);
  max.set(-Infinity, -Infinity, -Infinity);
  for (let ix = 0; ix <= 1; ix++)
    for (let iy = 0; iy <= 1; iy++)
      for (let iz = 0; iz <= 1; iz++) {
        _abV.set(ix * sx * vs, iy * sy * vs, iz * sz * vs)
          .applyMatrix4(part.pose);
        min.min(_abV);
        max.max(_abV);
      }
}
/** Directions (nearly horizontal, world space) along which a dart can fly
 *  from far away to `part` without crossing any other part's box. */
function freeDirs(f: Foamer, part: FoamerPart): [number, number, number][] {
  const cands: [number, number, number][] = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [-1, 0, -1], [1, 0, -1]];
  const others = [...f.parts.values()].filter((p) => p !== part);
  const mins = new Map<FoamerPart, THREE.Vector3>();
  const maxs = new Map<FoamerPart, THREE.Vector3>();
  for (const p of others) {
    const mn = new THREE.Vector3(), mx = new THREE.Vector3();
    partBox(p, mn, mx);
    mins.set(p, mn);
    maxs.set(p, mx);
  }
  const out: [number, number, number][] = [];
  for (const c of cands) {
    const d = new THREE.Vector3(...c).normalize();
    let clear = true;
    for (let t = 0.02; t < 1.0 && clear; t += 0.05) {
      const v = centreOf(part).addScaledVector(d, -t * 0.9);
      for (const p of others) {
        const mn = mins.get(p)!, mx = maxs.get(p)!;
        if (v.x > mn.x + 0.01 && v.x < mx.x - 0.01 &&
            v.y > mn.y + 0.01 && v.y < mx.y - 0.01 &&
            v.z > mn.z + 0.01 && v.z < mx.z - 0.01) {
          clear = false;
          break;
        }
      }
    }
    if (clear) out.push(c);
  }
  return out.length ? out : [[0, 0, -1]];
}

/** Darts at a part until it breaks. Arms and legs take 1 hp per standard
 *  dart (minHp 2), so two clean hits. A carved face would hold only a dart
 *  that re-hits it, so each shot flies in from a different clear side. */
async function breakOff(r: ReturnType<typeof rig>, player: THREE.Vector3, f: Foamer, id: string) {
  for (let i = 0; i < 8 && f.parts.has(id); i++) {
    const dirs = freeDirs(f, f.parts.get(id)!);
    const dir = dirs[(i * 3) % dirs.length] ?? dirs[0]!;
    fireAt(r, f.parts.get(id)!, dir);
    for (let j = 0; j < 60 && f.parts.has(id); j++) tick(r, player);
    if (f.parts.has(id)) await settle(f.parts.get(id)!.mesh, r.world);
  }
  if (f.parts.has(id)) throw new Error(`${id} did not break`);
}

/** Step until the foamer is walking again: the stagger after a break is
 *  passed, so a distance measured from here is pure approach. */
async function untilApproach(r: ReturnType<typeof rig>, player: THREE.Vector3, f: Foamer, max = 240) {
  for (let i = 0; i < max && f.state !== "approach"; i++) tick(r, player);
  if (f.state !== "approach") throw new Error(`never walked again (${f.state})`);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Foamer parts (ENG-10, rig F01)", () => {
  it("1. spawn: the root plus one body per F01 part exist, every part is a target, and each part owns only its own colliders", async () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    // One body per part, plus the root, all alive in the world.
    expect(f.parts.size).toBe(RIG.parts.length);
    for (const p of RIG.parts) {
      const part = f.parts.get(p.id)!;
      expect(part, p.id).toBeDefined();
      expect(r.world.getRigidBody(part.body.handle), p.id).not.toBeNull();
      expect(r.targets, `targets contain ${p.id}`).toContain(part);
    }
    expect(r.world.getRigidBody(f.root.handle)).not.toBeNull();
    // Every collider on the parts' bodies belongs to that part, and each
    // part body has at least one collider after the body part has meshed.
    await settle(f.parts.get("body")!.mesh, r.world);
    const ids = new Set<number>();
    for (const p of f.parts.values()) ids.add(p.body.handle);
    let owned = 0;
    r.world.forEachCollider((c) => {
      const parent = c.parent();
      if (!parent || !ids.has(parent.handle)) return;
      const owner = [...f.parts.values()].find((p) => p.owns(c));
      expect(owner, "exactly one part owns the collider").toBeDefined();
      expect(owner!.body.handle).toBe(parent.handle);
      owned++;
    });
    expect(owned).toBeGreaterThan(0);
  });

  it("2. at rest, each part's pivot sits on its parent's joint within 1 mm, and the legs are near the floor", () => {
    const r = rig();
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step(); // apply the spawn-time in-place poses
    for (const p of RIG.parts) {
      if (p.parent === null) continue;
      const part = f.parts.get(p.id)!;
      const parent = f.parts.get(p.parent)!;
      const vp = new THREE.Vector3(
        ((p.pivot ?? [0, 1, 0])[0] + 1) / 2 * p.size[0],
        ((p.pivot ?? [0, 1, 0])[1] + 1) / 2 * p.size[1],
        ((p.pivot ?? [0, 1, 0])[2] + 1) / 2 * p.size[2],
      );
      const pAt = (p.at ?? [0, 0, 0]) as [number, number, number];
      const vj = new THREE.Vector3(
        (pAt[0] + 1) / 2 * (RIG.parts.find((q) => q.id === p.parent)!.size[0]),
        (pAt[1] + 1) / 2 * (RIG.parts.find((q) => q.id === p.parent)!.size[1]),
        (pAt[2] + 1) / 2 * (RIG.parts.find((q) => q.id === p.parent)!.size[2]),
      );
      const pivot = part.voxelToWorld(vp.clone());
      const joint = parent.voxelToWorld(vj.clone());
      expect(pivot.distanceTo(joint), `${p.id} pivot at joint`).toBeLessThan(0.001);
    }
    // The lowest *filled* voxel of the legs: on the floor (card test 2).
    let low = Infinity;
    for (const id of ["legL", "legR"]) {
      const leg = f.parts.get(id)!;
      const [sx, sy, sz] = leg.spec.size;
      const chunk = leg.volume.chunks.values().next().value!;
      for (let x = 0; x < sx; x++)
        for (let y = 0; y < sy; y++)
          for (let z = 0; z < sz; z++) {
            if (!chunk.get(x, y, z)) continue;
            low = Math.min(low, leg.voxelToWorld(new THREE.Vector3(x, y, z)).y);
          }
    }
    expect(Math.abs(low)).toBeLessThan(0.05);
  });

  it("3. walking for 2 s, no part rotates more than 0.35 rad in one step", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    const qd = new THREE.Quaternion();
    const maxDelta = { value: 0 };
    for (let i = 0; i < 120; i++) {
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
        maxDelta.value = Math.max(maxDelta.value, angle);
      });
    }
    expect(f.centre.z).toBeGreaterThan(1); // it keeps walking
    expect(maxDelta.value).toBeLessThan(0.35);
  });

  it("4. a dart at legL lowers its hp by 1 and the Foamer's health by 0.5; a dart at the head lowers its hp by 2 and the health by 2", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    // Standard dart at legL: kind leg. hp -= 1 * 1, health -= 1 * 1 * 0.5
    // (the leg's total share). One hit leaves the leg at 1 hp, no break.
    const leg = f.parts.get("legL")!;
    fireAt(r, leg, [1, 0, 0]);
    await connect(r, player, leg);
    await settle(leg.mesh, r.world);
    expect(leg.hp, "leg hp").toBeCloseTo(1);
    expect(f.health, "Foamer health")
      .toBeCloseTo(f.maxHealth - SPEC.partDamage.kinds.leg.hit * SPEC.partDamage.kinds.leg.total);
    // Standard dart at the head: kind head. hp -= 1 * 2 (it has exactly 2),
    // health -= 1 * 2 * 1. The head breaks on the spot: it leaves the
    // Foamer's parts and the shared target list.
    const h = SPEC.partDamage.kinds.head;
    const head = f.parts.get("head")!;
    fireAt(r, head, [0, 0, -1]);
    await connect(r, player, head);
    await settle(head.mesh, r.world);
    expect(head.hp, "head hp").toBeCloseTo(0);
    expect(f.parts.has("head"), "head broke").toBe(false);
    expect(r.targets, "head left targets").not.toContain(head);
    expect(r.foamers.broken.length, "one head piece").toBe(1);
    expect(f.health, "head dart drops health by 2")
      .toBeCloseTo(f.maxHealth - 1 * h.hit * h.total - 0.5);
  });


  it("5. a wound paints foam-core only in the hit part, and none in other parts", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    // One standard dart at legL: kind leg, 1 hp left, no break. No stump
    // is painted, so the only foam-core anywhere is the wound on the hit
    // part.
    const leg = f.parts.get("legL")!;
    fireAt(r, leg, [1, 0, 0]);
    await connect(r, player, leg);
    await settle(leg.mesh, r.world);
    expect(materialCount(leg, CORE), "wound core in the hit part").toBeGreaterThan(0);
    for (const p of f.parts.values())
      if (p !== leg) expect(materialCount(p, CORE), `no core in ${p.spec.id}`).toBe(0);
  });

  it("6. darts at legL break it: it leaves targets and parts, the body has a foam-core stump at the hip, and the piece is dynamic and falls", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    const leg = f.parts.get("legL")!;
    await breakOff(r, player, f, "legL");
    // The leg left the Foamer's parts and the shared target list.
    expect(f.parts.has("legL"), "left parts").toBe(false);
    expect(r.targets, "left targets").not.toContain(leg);
    // The parent (the body) carries a foam-core stump at the hip.
    expect(materialCount(f.parts.get("body")!, CORE), "core stump in the body").toBeGreaterThan(0);
    // One falling piece in the world. It is launched up and out from the
    // break, so over the next 0.5 s its corner rises well above the launch
    // height, and the part is on the way down when it lands.
    expect(r.foamers.broken.length, "one piece").toBe(1);
    const piece = r.foamers.broken[0]!;
    expect(piece.body.isDynamic(), "piece is dynamic").toBe(true);
    const y0 = piece.body.translation().y;
    let hi = y0;
    for (let i = 0; i < 30; i++) {
      tick(r, player);
      hi = Math.max(hi, piece.body.translation().y);
    }
    expect(hi, "it rose after the break").toBeGreaterThan(y0 + 0.02);
    expect(piece.body.translation().y, "and has fallen from that height").toBeLessThan(hi - 0.01);
  });

  it("7. one leg gone: 50% (within 15%) of intact distance over 60 steps; both gone: 25%, and its lowest part is within 0.1 m of the floor", async () => {
    const player = new THREE.Vector3(0, 1.6, 4);
    const run = async (breakParts: string[]) => {
      const r = rig();
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, -10))!;
      r.world.step();
      await settleAll(r, f);
      for (const id of breakParts) await breakOff(r, player, f, id);
      // Let the post-break stagger pass, then measure 60 approach steps.
      await untilApproach(r, player, f);
      const start = f.centre.clone();
      for (let i = 0; i < 60; i++) tick(r, player);
      return { f, d: f.centre.distanceTo(start) };
    };
    const intactD = (await run([])).d;
    expect(intactD, "the intact one walks").toBeGreaterThan(0.4);
    const one = (await run(["legL"])).d;
    expect(one / intactD, "one leg ~50%").toBeGreaterThanOrEqual(0.35);
    expect(one / intactD, "one leg ~50%").toBeLessThanOrEqual(0.65);
    const none = await run(["legL", "legR"]);
    expect(none.d / intactD, "both gone ~25%").toBeGreaterThanOrEqual(0.10);
    expect(none.d / intactD, "both gone ~25%").toBeLessThanOrEqual(0.40);
    // With no legs it skids on the floor: the lowest attached voxel lies
    // within 0.1 m of it.
    let low = Infinity;
    for (const part of none.f.parts.values()) {
      const [sx, sy, sz] = part.spec.size;
      for (const chunk of part.volume.chunks.values())
        for (let y = 0; y < sy; y++)
          for (let z = 0; z < sz; z++)
            for (let x = 0; x < sx; x++) {
              if (!chunk.get(x, y, z)) continue;
              low = Math.min(low, part.voxelToWorld(new THREE.Vector3(x, y, z)).y);
            }
    }
    expect(low, "lowest part within 0.1 m of the floor").toBeLessThan(0.1);
    expect(low, "not sunk into the floor").toBeGreaterThanOrEqual(-0.05);
  });

  it("8. both forearms gone: the next attack is the headbutt, a 0.9 s windup, not the 0.6 s bonk", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 10);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 4))!;
    r.world.step();
    await settleAll(r, f);
    // The bonk needs both forearms; take them off so only the headbutt,
    // whose needs are empty, remains.
    await breakOff(r, player, f, "foreArmL");
    await breakOff(r, player, f, "foreArmR");
    await untilApproach(r, player, f);
    // It walks in, stops at range and winds up.
    let a: ReturnType<Foamer["attack"]> = null;
    for (let i = 0; i < 600 && !a; i++) {
      tick(r, player);
      if (f.state === "windup") a = f.attack();
    }
    expect(a, "it started an attack").not.toBeNull();
    expect(a!.id, "headbutt, not bonk").toBe("headbutt");
    expect(a!.windup, "0.9 s windup, not 0.6").toBeCloseTo(0.9);
  });
  it("9. without a head, turning 180 degrees to face the player takes 1.7 to 2.3 times as long", async () => {
    // Both Foamers start backing onto a player 8 m behind them. From
    // yaw 0 the full turn carries it about pi radians either way; the
    // rate, not the way, is what the card measures.
    const faceTime = async (r: ReturnType<typeof rig>, f: Foamer, player: THREE.Vector3) => {
      let steps = 0;
      while (steps < 900) {
        if (Math.PI - Math.abs(f.yaw) < 0.15) break; // face-on, either wrap
        tick(r, player);
        steps++;
      }
      return steps * DT;
    };
    const r1 = rig();
    const behind = new THREE.Vector3(0, 1.6, -8);
    const f1 = r1.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r1.world.step();
    await settleAll(r1, f1);
    f1.yaw = 0; // a clean start away from the player
    const headed = await faceTime(r1, f1, behind);
    expect(headed, "need a turn to measure").toBeGreaterThan(0.2);
    const r2 = rig();
    const f2 = r2.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r2.world.step();
    await settleAll(r2, f2);
    // Off with the head: a dart at a part that has died once since is
    // carried by the wound that is left, so this takes two.
    await breakOff(r2, behind, f2, "head");
    await untilApproach(r2, behind, f2);
    f2.yaw = 0;
    const headless = await faceTime(r2, f2, behind);
    const ratio = headless / headed;
    // turnRate is 6 with a head and 3 without: about twice as long; the
    // card's pass band is 1.7 to 2.3.
    expect(ratio, "headless turn is 1.7 to 2.3 times slower").toBeGreaterThanOrEqual(1.7);
    expect(ratio, "headless turn is 1.7 to 2.3 times slower").toBeLessThanOrEqual(2.3);
  });

  it("10. break by wear: carve armL past wearBreak and it breaks after one update", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    const arm = f.parts.get("armL")!;
    // Carve with spheres until armL has lost wearBreak of the voxels it
    // started with. No dart is involved: the check happens once per step,
    // in update. ArmL is a 5x10x5 bar, so the spheres walk along its at
    // side (the forearms hinge below y 0, at the block's row 5).
    const limit = arm.startVoxels * (1 - SPEC.partDamage.wearBreak);
    let n = 0;
    while (arm.voxelCount > limit && n < 60) {
      carveSphere(arm.volume, 2.5, 2 + (n % 8) * 1.1, 2.5, 1.8);
      n++;
    }
    expect(arm.voxelCount, "past wearBreak").toBeLessThanOrEqual(limit);
    tick(r, player);
    expect(f.parts.has("armL"), "broken after one update").toBe(false);
    expect(r.targets, "left targets").not.toContain(arm);
  });

  it("11. stagger: right after a break the centre moves under 1 mm for the whole stagger, then it moves again", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await breakOff(r, player, f, "legL");
    expect(f.state, "staggered").toBe("stagger");
    // Still for the whole stagger: under 1 mm of centre move on every step
    // that is still staggering when it ends. The one step that ends the
    // stagger already walks: the wobble is over and the walk starts.
    const still = Math.round(SPEC.stagger.time / DT);
    let jolt = 0;
    for (let i = 0; i < still + 5; i++) {
      const last = f.centre.clone();
      tick(r, player);
      if (f.state === "stagger") jolt = Math.max(jolt, f.centre.distanceTo(last));
    }
    expect(jolt, "under 1 mm while staggering").toBeLessThan(0.001);
    // Then it moves again.
    const start = f.centre.clone();
    for (let i = 0; i < 60; i++) tick(r, player);
    expect(f.centre.distanceTo(start), "moves again").toBeGreaterThan(0.001);
  });
});
