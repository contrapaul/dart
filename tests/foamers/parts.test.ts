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
async function settle(mesh: { update(): void; busy: boolean }, world: RAPIER.World) {
  while (true) {
    mesh.update();
    if (!mesh.busy) break;
    await new Promise((r) => setTimeout(r, 0));
  }
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

/** Count mesh nodes under a group (recursively); used to check that a
 *  broken piece keeps its drawn chunk meshes. */
function countMeshes(node: THREE.Object3D): number {
  let n = 0;
  for (const c of node.children) n += (c instanceof THREE.Mesh ? 1 : 0) + countMeshes(c);
  return n;
}

beforeAll(async () => {
  // The pop tests use standard darts; in the game no starter type pops
  // (catastrophic.popTypes is empty), so allow it for this file.
  (foamerData.test.catastrophic.popTypes as string[]).push("standard");
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

  it("6b. a broken piece keeps its mesh: the part group still has a mesh child after the mesher runs, and the part's kinematic body has no colliders", async () => {
    const r = rig();
    // Off the origin and turned toward a player to one side, so a wrong
    // transform order shows.
    const player = new THREE.Vector3(9, 1.6, 2);
    const f = r.foamers.spawn(new THREE.Vector3(5, 0, -6))!;
    r.world.step();
    await settleAll(r, f);
    const leg = f.parts.get("legL")!;
    await breakOff(r, player, f, "legL");
    // The broken part's mesh is refreshed in stepBroken; let it run.
    tick(r, player);
    await new Promise((res) => setTimeout(res, 0));
    // The stump paint and the part's voxels are still drawn: the group
    // (re-parented under the system) has at least one mesh child.
    const piece = r.foamers.broken[0]!;
    const partGroup = piece.groups.find((g) => g.part === leg)!;
    expect(partGroup).toBeDefined();
    expect(countMeshes(partGroup.part.group), "piece mesh remains").toBeGreaterThan(0);
    // And it is drawn where it broke off: the leg's centre is above the
    // floor and near the Foamer, and on its own collider.
    r.foamers.syncRender(1);
    const s = leg.spec.size, vs = f.rig.voxelSize;
    const drawn = new THREE.Vector3(s[0] / 2, s[1] / 2, s[2] / 2).multiplyScalar(vs).applyMatrix4(partGroup.part.group.matrix);
    expect(drawn.y, "drawn above the floor").toBeGreaterThan(-0.05);
    expect(drawn.distanceTo(f.centre), "drawn near the Foamer").toBeLessThan(2);
    let cuboid: THREE.Vector3 | null = null;
    r.world.forEachCollider((c) => {
      if (c.parent()?.handle === piece.body.handle) { const t = c.translation(); cuboid = new THREE.Vector3(t.x, t.y, t.z); }
    });
    expect(cuboid!.distanceTo(drawn), "collider on the drawn part").toBeLessThan(0.05);
    // The part's own kinematic body carries no colliders any more.
    let partColliders = 0;
    r.world.forEachCollider((c) => {
      if (c.parent()?.handle === leg.body.handle) partColliders++;
    });
    expect(partColliders, "part body has no colliders").toBe(0);
    // Falling pieces' colliders (the cuboids) still live on the piece body.
    let pieceColliders = 0;
    r.world.forEachCollider((c) => {
      if (c.parent()?.handle === piece.body.handle) pieceColliders++;
    });
    expect(pieceColliders, "piece body keeps its cuboids").toBeGreaterThan(0);
  });

  it("6c. a part whose child already broke off breaks cleanly (club, then the forearm holding it)", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await breakOff(r, player, f, "club");
    await untilApproach(r, player, f);
    await breakOff(r, player, f, "foreArmR");
    expect(f.has("foreArmR")).toBe(false);
    expect(r.foamers.broken.length).toBe(2);
    expect(r.foamers.broken[1]!.groups.map((g) => g.part.spec.id)).toEqual(["foreArmR"]);
  });

  it("7. a leg break falls instead of limping (GAME-11): it goes over and crawls, slower than it walked; the prone body stays on the floor", async () => {
    const player = new THREE.Vector3(0, 1.6, 4);
    const run = async (breakParts: string[]) => {
      const r = rig();
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, -10))!;
      r.world.step();
      await settleAll(r, f);
      for (const id of breakParts) await breakOff(r, player, f, id);
      // The fall, then the crawl, then measure 60 steps of it.
      for (let i = 0; i < 240 && f.state !== "crawl"; i++) tick(r, player);
      const start = f.centre.clone();
      for (let i = 0; i < 60; i++) tick(r, player);
      return { f, d: f.centre.distanceTo(start) };
    };
    const intact = await run([]);
    expect(intact.d, "the intact one walks").toBeGreaterThan(0.4);
    // GAME-11: fallBelowLegs 2, so a two-legged Foamer that loses one leg
    // falls, which replaces the old 50% limp. Prone, it crawls: slower than
    // it walked (crawlSpeed 0.3 of the rig's speed), but it closes on the
    // player. Stage 1 held it still; the card's crawl moves it.
    const one = await run(["legL"]);
    expect(one.f.state, "one leg gone: it fell").toBe("crawl");
    expect(one.f.parts.has("legL"), "the leg is off").toBe(false);
    expect(one.d, "it crawls").toBeGreaterThan(0.1);
    expect(one.d / intact.d, "slower than it walked").toBeLessThan(0.7);
    // Prone on the floor, not sunk into it (the old skid check, now on the
    // body that fell). The pose fits each part's box to the floor, so the
    // filled voxels of a part whose box corner is rounded sit slightly above
    // it; the arms swung forward hold the body a little way up too.
    let low = Infinity;
    for (const part of one.f.parts.values()) {
      const [sx, sy, sz] = part.spec.size;
      for (const chunk of part.volume.chunks.values())
        for (let y = 0; y < sy; y++)
          for (let z = 0; z < sz; z++)
            for (let x = 0; x < sx; x++) {
              if (!chunk.get(x, y, z)) continue;
              low = Math.min(low, part.voxelToWorld(new THREE.Vector3(x, y, z)).y);
            }
    }
    expect(low, "lowest part near the floor").toBeLessThan(0.2);
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
    // GAME-11: a leg break is a fall now, so the stagger is tested on an
    // arm instead (a stagger is still what a survivable break does).
    await breakOff(r, player, f, "armL");
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

  it("12. going down: single darts at the body every ~0.2 s down it; no voxel colliders left and no parts in targets; the ragdoll lies by 1 s; it is disposed within lie + sink + 4 s; a stuck suction dart is no longer stuck after that", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    // A suction dart rides it while it is still alive.
    r.darts.fire(new THREE.Vector3(0, 0.9, 10), new THREE.Vector3(0, 0, -1), "suction");
    for (let i = 0; i < 240 && r.darts.stats().stuck < 1 && f.state !== "down"; i++) tick(r, player);
    expect(r.darts.stats().stuck, "a suction dart is stuck").toBe(1);
    // Single standard darts at the body, spaced 0.2 s apart (well over the
    // 0.1 s catastrophic window, so every hit counts alone), until health
    // is 0 and it is down.
    const body = f.parts.get("body")!;
    // The state can change inside tick (type narrowing does not follow
    // method calls), so the check goes through a closure.
    const isDown = () => f.state === "down";
    let shots = 0;
    while (!isDown() && shots < 30) {
      fireAt(r, body, [0, 0, -1]);
      shots++;
      for (let i = 0; i < 12 && !isDown(); i++) tick(r, player);
    }
    expect(f.state, "it went down, not popped").toBe("down");
    expect(r.foamers.stats.popped).toBe(0);
    // No voxel trimesh colliders left on the root or any part body (the
    // ragdoll's new cuboids are the intended state), and no parts in the
    // shared target list (darts pass through it).
    await new Promise((res) => setTimeout(res, 0));
    const handles = [f.root.handle, ...[...f.parts.values()].map((p) => p.body.handle)];
    let remaining = 0;
    r.world.forEachCollider((c) => {
      const parent = c.parent();
      if (parent && handles.includes(parent.handle) &&
          c.shapeType() === RAPIER.ShapeType.TriMesh) remaining++;
    });
    expect(remaining, "no voxel colliders left").toBe(0);
    let inTargets = 0;
    for (const p of f.parts.values()) if (r.targets.includes(p)) inTargets++;
    expect(inTargets, "no parts in targets").toBe(0);
    // The ragdoll lies: the body part's centre is under 0.6 m by 1 s.
    for (let i = 0; i < 60; i++) tick(r, player);
    const bodyT = body.body.translation();
    expect(bodyT.y, "body part lying low").toBeLessThan(0.6);
    // Disposed within lie + sink + 4 s (F01 lies about 0.9 m high and
    // sinks at down.sinkSpeed until its top is under the floor): its
    // bodies leave.
    const budget = Math.ceil((SPEC.down.lie + 6) / DT);
    let gone = false;
    for (let i = 0; i < budget; i++) {
      if (r.world.getRigidBody(f.root.handle) === null) { gone = true; break; }
      tick(r, player);
    }
    expect(gone, "disposed within the budget").toBe(true);
    expect(r.world.getRigidBody(f.root.handle)).toBeNull();
    for (const p of f.parts.values()) expect(r.world.getRigidBody(p.body.handle)).toBeNull();
    // The stuck suction dart is no longer stuck after it is gone (discards
    // darts already at the moment it went down, and the stuck ride ends
    // either way when its bodies are disposed).
    for (let i = 0; i < 60; i++) tick(r, player);
    expect(r.darts.stats().stuck, "the suction dart fell").toBe(0);
  });

  it("13. head and an arm gone with health above zero: the Foamer goes down", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    // Two darts at armL take the arm (2 hp), two at the head (2 hp).
    await breakOff(r, player, f, "armL");
    expect(f.state, "armL alone does not down it").not.toBe("down");
    await breakOff(r, player, f, "head");
    expect(f.state, "head plus an arm downs it").toBe("down");
    expect(f.health, "still above zero").toBeGreaterThan(0);
    expect(r.foamers.stats.popped).toBe(0);
  });

  it("14. catastrophic: three standard darts on the body in the same step at low health pop it (all bodies gone, debris spawned); one dart killing it at 1 health downs it instead", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 1);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    // Health at 3 or less: three standard darts (3 >= 0.4 x 6) fly in
    // back to back and land in the same step: the whole blast counts in
    // the window, so it pops.
    f.health = 3;
    const rootHandle = f.root.handle;
    const partHandles = [...f.parts.values()].map((p) => p.body.handle);
    for (let i = 0; i < 3; i++) fireAt(r, f.parts.get("body")!, [0, 0, -1]);
    for (let i = 0; i < 240 && r.foamers.stats.popped < 1; i++) tick(r, player);
    expect(r.foamers.stats.popped, "it popped").toBe(1);
    expect(r.foamers.live).toBe(0);
    expect(r.world.getRigidBody(rootHandle)).toBeNull();
    for (const h of partHandles) expect(r.world.getRigidBody(h)).toBeNull();
    expect(r.debris.live, "debris spawned").toBeGreaterThan(0);

    // One dart killing it at 1 health: the single hit is under the
    // catastrophic share, so it goes down instead.
    const r2 = rig();
    const f2 = r2.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r2.world.step();
    await settleAll(r2, f2);
    f2.health = 1;
    fireAt(r2, f2.parts.get("body")!, [0, 0, -1]);
    for (let i = 0; i < 240 && f2.state !== "down"; i++) tick(r2, player);
    expect(f2.state, "one dart downs it").toBe("down");
    expect(r2.foamers.stats.popped).toBe(0);
  });

  it("14b. no starter dart pops: with the shipped popTypes, the same three-dart burst downs it (Paul, 2026-11-01)", async () => {
    const popTypes = foamerData.test.catastrophic.popTypes as string[];
    const allowed = popTypes.splice(0); // the shipped list, as the game has it
    try {
      const r = rig();
      const player = new THREE.Vector3(0, 1.6, 1);
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
      r.world.step();
      await settleAll(r, f);
      f.health = 3;
      for (let i = 0; i < 3; i++) fireAt(r, f.parts.get("body")!, [0, 0, -1]);
      for (let i = 0; i < 240 && f.state !== "down"; i++) tick(r, player);
      expect(f.state, "the burst downs it").toBe("down");
      expect(r.foamers.stats.popped).toBe(0);
    } finally {
      popTypes.push(...allowed);
    }
  });

  it("15. caps: broken pieces stay at or under brokenParts.max; with down.max + 2 Foamers downed, at least two are sinking early", async () => {
    // Pieces: the first break (a dart-torn legL) leaves one real piece,
    // then the list is seeded with 23 dummy pieces. The second break
    // (legR, by wear: the fallen legL piece blocks darts at it) evicts the
    // oldest dummy and would push the list to the cap, so it never grows
    // past brokenParts.max.
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await breakOff(r, player, f, "legL");
    let maxSeen = r.foamers.broken.length;
    for (let i = 0; i < SPEC.brokenParts.max - 1; i++) {
      const part = new FoamerPart(RAPIER, r.world, fakeMesher(), RIG.parts[1]!, RIG.voxelSize, RIG.material, 1);
      const body = r.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
      part.mesh.dispose();
      r.foamers.broken.push({
        body,
        groups: [{ part, local: new THREE.Matrix4() }],
        owner: f,
        prevT: new THREE.Vector3(),
        prevQ: new THREE.Quaternion(),
        bottomY: 0, topY: 1,
        age: 0, sinking: false, sinkSpeed: 0,
      });
    }
    maxSeen = Math.max(maxSeen, r.foamers.broken.length);
    // Break legR by wear: carve it past wearBreak, then the once-per-step
    // check in update breaks it (the fallen legL piece blocks darts at it).
    const legR = f.parts.get("legR")!;
    const limit = legR.startVoxels * (1 - SPEC.partDamage.wearBreak);
    for (let n = 0; legR.voxelCount > limit && n < 60; n++)
      carveSphere(legR.volume, 3, 2 + (n % 5) * 1.1, 3, 1.8);
    tick(r, player);
    expect(f.parts.has("legR"), "legR broke by wear").toBe(false);
    maxSeen = Math.max(maxSeen, r.foamers.broken.length);
    expect(maxSeen, "never past the cap").toBeLessThanOrEqual(SPEC.brokenParts.max);
    expect(r.foamers.broken.length, "at the cap, never over").toBe(SPEC.brokenParts.max);

    // Down cap: down Foamers until max + 2; at least two must be sinking
    // early (before their own topple + lie would have finished).
    const r2 = rig();
    const refs: Foamer[] = [];
    for (let i = 0; i < SPEC.down.max + 2; i++) {
      const g = r2.foamers.spawn(new THREE.Vector3(0, 0, -4 - i * 2.2))!;
      r2.world.step();
      const body = g.parts.get("body")!;
      await settle(body.mesh, r2.world);
      g.health = 1;
      fireAt(r2, body, [0, 0, 1]);
      for (let s = 0; s < 360 && g.state !== "down"; s++) tick(r2, player);
      expect(g.state, `foamer ${i + 1} went down`).toBe("down");
      refs.push(g);
    }
    const early = refs.filter((g) => g.sinkingNow || g.sinkDrop > 0).length;
    expect(early, "at least two are sinking early").toBeGreaterThanOrEqual(2);
  });
});
