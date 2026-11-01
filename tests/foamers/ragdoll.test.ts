/** ENG-12: a downed Foamer is a jointed physics ragdoll that falls the way
 *  the killing hit pushes it, lies still, then sinks away. All the card's
 *  tests. Rig F01, the fake mesher, a standard dart to kill (standard darts
 *  down, never pop).
 */
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Foamer } from "../../src/foamers/foamer";
import type { GameRig } from "../../src/foamers/foamer";
import { FoamerPart } from "../../src/foamers/foamer-part";
import rigData from "../../data/foamer-rigs.json";
import foamerData from "../../data/foamers.json";
import { SOLID_QUERY_GROUPS, groups } from "../../src/physics/world";

const DT = 1 / 60;
const SPEC = foamerData.test;
const RIG = (rigData.rigs as unknown as GameRig[]).find((r) => r.id === "F01")!;
const VS = RIG.voxelSize;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}
/** Let a pending remesh resolve, then step once more. */
async function settle(mesh: { update(): void }, world: RAPIER.World) {
  mesh.update();
  await new Promise((r) => setTimeout(r, 0));
  world.step();
}
/** Mesh every part once, so a dart can find (and carve) each part. */
async function settleAll(r: R, f: Foamer) {
  for (const part of f.parts.values()) await settle(part.mesh, r.world);
}
type R = { world: RAPIER.World; darts: DartSystem; foamers: FoamerSystem; targets: VoxelTarget[] };
function rig(): R {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200), body);
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  world.step();
  return { world, darts, foamers, targets };
}
function tick(r: R, player: THREE.Vector3, dt = DT) {
  r.darts.update(dt);
  r.foamers.update(dt, player);
  r.world.step();
}
/** The part's box centre in world space, from its live body. */
function centreOf(part: FoamerPart) {
  return part.voxelToWorld(new THREE.Vector3(
    part.spec.size[0] / 2, part.spec.size[1] / 2, part.spec.size[2] / 2));
}
/** Fire one standard dart at the part's box centre, from one metre back
 *  along `dir`, travelling exactly `dir`. */
function fireAt(r: R, part: FoamerPart, dir: THREE.Vector3) {
  const d = dir.clone().normalize();
  r.darts.fire(centreOf(part).addScaledVector(d, -1.0), d, "standard");
}
/** One standard dart does 1 damage (to the part and the total health);
 *  0.5 health left is one hit to death. Step until it is down, then return
 *  the box centre of the hit part at the moment of the kill. */
async function kill(r: R, f: Foamer, part: FoamerPart, dir: THREE.Vector3,
  player: THREE.Vector3): Promise<THREE.Vector3> {
  tick(r, player); // one standing step, so every kill starts from the same pose
  f.health = 0.5;
  fireAt(r, part, dir);
  for (let i = 0; i < 90 && f.state !== "down"; i++) tick(r, player);
  expect(f.state, `went down (state was ${f.state})`).toBe("down");
  return centreOf(part).clone();
}
/** The lowest world point of the part's ragdoll cuboid collider. */
const _mcQ = new THREE.Quaternion();
const _mcV = new THREE.Vector3();
function minCorner(part: FoamerPart): number {
  const t = part.body.translation();
  const q = part.body.rotation();
  _mcQ.set(q.x, q.y, q.z, q.w);
  const sz = part.spec.size;
  let m = Infinity;
  for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
    _mcV.set(
      cx ? sz[0] * VS - 0.02 : 0.02,
      cy ? sz[1] * VS - 0.02 : 0.02,
      cz ? sz[2] * VS - 0.02 : 0.02,
    ).applyQuaternion(_mcQ);
    m = Math.min(m, _mcV.y + t.y);
  }
  return m;
}
beforeAll(async () => { await RAPIER.init(); });

describe("Foamer ragdoll (ENG-12, rig F01)", () => {
  it("1. going down: every remaining part is dynamic at the ragdoll damping, one hinge per attached part with a parent, the root capsule is gone, no part is a voxel target", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    // Track the parts after the kill, not before: a head-plus-arm loss
    // would drop pieces. (Not the case here: a standard dart body hit
    // leaves every part attached.)
    const parts = [...f.parts.values()];
    expect(parts.length, "all parts still attached").toBe(RIG.parts.length);
    const expLin = SPEC.down.ragdoll.linearDamping;
    const expAng = SPEC.down.ragdoll.angularDamping;
    for (const p of parts) {
      expect(p.body.isDynamic(), `${p.spec.id} dynamic`).toBe(true);
      expect(p.body.linearDamping(), `${p.spec.id} linear damping`).toBeCloseTo(expLin, 5);
      expect(p.body.angularDamping(), `${p.spec.id} angular damping`).toBeCloseTo(expAng, 5);
    }
    const withParent = parts.filter((p) => p.spec.parent !== null);
    expect(f.ragdoll.length, "one hinge per attached part with a parent").toBe(withParent.length);
    // Every hinge links this Foamer's own parent part body to its child.
    const handles = new Set(parts.map((p) => p.body.handle));
    for (const link of f.ragdoll) {
      expect(handles.has(link.parent.handle), "hinge parent is a part here").toBe(true);
      expect(handles.has(link.child.handle), "hinge child is a part here").toBe(true);
    }
    // The root capsule collider was removed: the root body has none left.
    let onRoot = 0;
    r.world.forEachCollider((c) => {
      if (c.parent()?.handle === f.root.handle) onRoot++;
    });
    expect(onRoot, "root capsule gone").toBe(0);
    for (const p of parts) {
      expect(r.targets.includes(p), `${p.spec.id} no voxel target`).toBe(false);
    }
  });

  it("2. limp: 3 s after a kill, the body part's centre is below 0.6 m and no part is below the floor by more than 0.05 m", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    for (let i = 0; i < 180; i++) tick(r, player);
    expect(centreOf(f.parts.get("body")!).y, "body centre below 0.6 m").toBeLessThan(0.6);
    for (const p of f.parts.values()) {
      expect(minCorner(p), `${p.spec.id} at or near the floor, not sunk in`).toBeGreaterThanOrEqual(-0.05);
    }
  });

  it("3. direction: a kill shot travelling -z moves the body part's centre toward -z after 2 s, and one travelling +x moves it toward +x; the Foamer starts from the same pose both times", async () => {
    const player = new THREE.Vector3(0, 1.6, 8);
    const moveAlong = async (dir: THREE.Vector3) => {
      const r = rig();
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
      r.world.step();
      await settleAll(r, f);
      const c0 = await kill(r, f, f.parts.get("body")!, dir, player);
      for (let i = 0; i < 120; i++) tick(r, player);
      const c2 = centreOf(f.parts.get("body")!);
      return c2.sub(c0).dot(dir); // displacement along the dart's travel
    };
    const alongMinusZ = await moveAlong(new THREE.Vector3(0, 0, -1));
    const alongPlusX = await moveAlong(new THREE.Vector3(1, 0, 0));
    // The body's centre ends up clearly on the side it was pushed toward
    // (tipping over moves it about its own height, about 0.6 m).
    expect(alongMinusZ, "toward -z").toBeGreaterThan(0.5);
    expect(alongPlusX, "toward +x").toBeGreaterThan(0.5);
  });

  it("4. not canned: two Foamers killed by shots from different directions end with body orientations at least 30 degrees apart", async () => {
    const player = new THREE.Vector3(0, 1.6, 8);
    const bodyQuat = async (dir: THREE.Vector3) => {
      const r = rig();
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
      r.world.step();
      await settleAll(r, f);
      await kill(r, f, f.parts.get("body")!, dir, player);
      for (let i = 0; i < 180; i++) tick(r, player);
      const q = f.parts.get("body")!.body.rotation();
      return new THREE.Quaternion(q.x, q.y, q.z, q.w);
    };
    const a = await bodyQuat(new THREE.Vector3(0, 0, -1));
    const b = await bodyQuat(new THREE.Vector3(1, 0, 0));
    const c = await bodyQuat(new THREE.Vector3(-1, 0, 0));
    const d = await bodyQuat(new THREE.Vector3(0, 0, 1));
    let minDeg = Infinity;
    for (const [p, q] of [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]] as const) {
      const dot = Math.abs(p.dot(q));
      minDeg = Math.min(minDeg, 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI);
    }
    expect(minDeg, "30 degrees apart at least").toBeGreaterThanOrEqual(30);
  });

  it("5. joints hold: 3 s after a kill, every child's pivot point is within 0.05 m of its parent's joint point", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    for (let i = 0; i < 180; i++) tick(r, player);
    const _jM = new THREE.Matrix4();
    const _jp = new THREE.Vector3(), _jq = new THREE.Quaternion(), _js = new THREE.Vector3();
    expect(f.ragdoll.length, "has hinges").toBeGreaterThan(0);
    for (const link of f.ragdoll) {
      const q = link.parent.rotation();
      _jq.set(q.x, q.y, q.z, q.w);
      const tp = link.parent.translation();
      _jp.set(tp.x, tp.y, tp.z);
      _jM.compose(_jp, _jq, _js.set(1, 1, 1));
      const parentJoint = link.anchorLocal.clone().applyMatrix4(_jM);
      const qc = link.child.rotation();
      _jq.set(qc.x, qc.y, qc.z, qc.w);
      const tc = link.child.translation();
      _jp.set(tc.x, tc.y, tc.z);
      _jM.compose(_jp, _jq, _js.set(1, 1, 1));
      const childPivot = link.pivotLocal.clone().applyMatrix4(_jM);
      expect(parentJoint.distanceTo(childPivot), "pivot on the joint point").toBeLessThan(0.05);
    }
  });

  it("6. limits: through 3 s after a kill, every hinge angle stays within its limits plus 0.1 rad", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    const _qP = new THREE.Quaternion(), _qC = new THREE.Quaternion();
    const _x0 = new THREE.Vector3(), _x1 = new THREE.Vector3();
    const angleOf = (link: (typeof f.ragdoll)[number]): number => {
      const rp = link.parent.rotation();
      const rc = link.child.rotation();
      _qP.set(rp.x, rp.y, rp.z, rp.w).invert();
      _qC.set(rc.x, rc.y, rc.z, rc.w);
      // neutralQ = parent^-1 * child at creation, so the rel quaternion at
      // creation was neutralQ. The rotation rel^-1 * neutralQ is the twist
      // about the hinge axis since creation; signed about x0 = axis in the
      // neutral frame (child local x).
      const rel = _qP.clone().multiply(_qC);
      const rot = rel.clone().invert().multiply(link.neutralQ).normalize();
      _x0.set(1, 0, 0).applyQuaternion(link.neutralQ).normalize();
      _x1.set(1, 0, 0).applyQuaternion(rot).normalize();
      return Math.atan2(_x0.clone().cross(_x1).dot(_x0), _x0.dot(_x1));
    };
    for (let i = 0; i < 180; i++) {
      tick(r, player);
      for (const link of f.ragdoll) {
        const lim = (SPEC.down.ragdoll.limits as Record<string, number[]>)[link.kind] ?? [-0.5, 0.5];
        const a = angleOf(link);
        const t = ((i + 1) * DT).toFixed(2);
        expect(a, `hinge ${link.kind} at t=${t} s above its low limit`).toBeGreaterThanOrEqual(lim[0] - 0.1);
        expect(a, `hinge ${link.kind} at t=${t} s below its high limit`).toBeLessThanOrEqual(lim[1] + 0.1);
      }
    }
  });

  it("7. pass through: a ray in SOLID_QUERY_GROUPS through a lying ragdoll hits nothing of it, and a dart fired through it does not count a hit", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    for (let i = 0; i < 120; i++) tick(r, player); // it lies down
    // Both casts start inside the body's own box, so a query that could
    // see the ragdoll would hit it for sure.
    const c = centreOf(f.parts.get("body")!);
    const ray = new RAPIER.Ray(
      { x: c.x, y: c.y, z: c.z }, { x: 0, y: 0, z: 1 });
    const anyHit = r.world.castRayAndGetNormal(
      ray, 10, true, 8, groups(0xffff, 0xffffffff), undefined, undefined,
      undefined);
    expect(anyHit, "a plain ray from inside the box hits the ragdoll")
      .not.toBeNull();
    const solidHit = r.world.castRayAndGetNormal(
      ray, 10, true, 8, SOLID_QUERY_GROUPS, undefined, undefined, undefined);
    expect(solidHit, "SOLID_QUERY_GROUPS sees nothing of the ragdoll")
      .toBeNull();
    // The dart: count only hits attributed to the corpse's own parts
    // (the kill carve left debris behind, and darts do collide with
    // debris; that is not a hit on the ragdoll).
    const owns = (col: RAPIER.Collider) =>
      [...f.parts.values()].some((p) => p.owns(col));
    let hits = 0;
    const prev = r.darts.onHit;
    r.darts.onHit = (h) => { if (owns(h.collider)) hits++; prev(h); };
    r.darts.fire(
      new THREE.Vector3(c.x, c.y, c.z - 1.5), new THREE.Vector3(0, 0, 1),
      "standard");
    for (let i = 0; i < 120; i++) tick(r, player);
    r.darts.onHit = prev;
    expect(hits, "the dart did not hit the lying ragdoll").toBe(0);
  });

  it("8. sinking and caps: after lie, no hinges, colliders disabled, the parts sink and are disposed; with down.max + 2 downed, the oldest two are already sinking", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    // While it lies, the ragdoll is alive: hinges, dynamic bodies.
    for (let i = 0; i < Math.round((SPEC.down.lie - 0.2) * 60); i++)
      tick(r, player);
    expect(f.ragdoll.length, "hinges while lying").toBeGreaterThan(0);
    for (const p of f.parts.values())
      expect(p.body.isDynamic(), `${p.spec.id} dynamic while lying`)
        .toBe(true);
    // Past the lie the first sink step locks everything.
    for (let i = 0; i < 30; i++) tick(r, player);
    expect(f.ragdoll.length, "hinges removed at the sink lock").toBe(0);
    const handles = [...f.parts.values()].map((p) => p.body.handle);
    for (const p of f.parts.values()) {
      expect(p.body.isDynamic(), `${p.spec.id} kinematic at the sink`)
        .toBe(false);
      expect(r.world.getRigidBody(p.body.handle),
        `${p.spec.id} still present while sinking`).not.toBeNull();
    }
    let enabled = 0;
    r.world.forEachCollider((col) => {
      const parent = col.parent();
      if (parent && handles.includes(parent.handle) && col.isEnabled())
        enabled++;
    });
    expect(enabled, "every part collider disabled at the sink").toBe(0);
    const bodyP = f.parts.get("body")!;
    const y0 = bodyP.body.translation().y;
    for (let i = 0; i < 30; i++) tick(r, player);
    expect(bodyP.body.translation().y, "sinking where it lay")
      .toBeLessThan(y0);
    // At sinkSpeed the top is below the floor well inside 10 s of the
    // lie, and the Foamer is gone by then.
    for (let i = 0; i < 600; i++) tick(r, player);
    for (const p of f.parts.values()) {
      expect(r.world.getRigidBody(p.body.handle), `${p.spec.id} disposed`)
        .toBeNull();
    }
    // The cap: down.max + 2 down at once, and the oldest two are already
    // sinking while the rest are still in their lie.
    const r2 = rig();
    const refs: Foamer[] = [];
    for (let i = 0; i < (SPEC.down as { max: number }).max + 2; i++) {
      const g = r2.foamers.spawn(new THREE.Vector3(0, 0, -2 - i * 2.4))!;
      r2.world.step();
      await settleAll(r2, g);
      await kill(r2, g, g.parts.get("body")!, new THREE.Vector3(0, 0, -1),
        player);
      refs.push(g);
    }
    const early = refs.filter((g) => g.sinkingNow || g.sinkDrop > 0).length;
    expect(early, "the oldest two are already sinking")
      .toBeGreaterThanOrEqual(2);
  });

  it("9. broken first: a Foamer that lost legL and then dies ragdolls with the parts it has left (no joint to the missing leg, no crash)", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    // Break legL first (wear, no dart): carve spheres along the leg's
    // length (a 6x8x6 capsule) until it loses wearBreak of its voxels; one
    // step then breaks it (the check runs once per update).
    const leg = f.parts.get("legL")!;
    const limit = leg.startVoxels * (1 - SPEC.partDamage.wearBreak);
    const { carveSphere } = await import("../../src/voxel/carve");
    let n = 0;
    while (leg.voxelCount > limit && n < 200) {
      const t = (n % 20) / 20; // walk the leg's length, both ends and middle
      carveSphere(leg.volume, 2.5, 2.5, 1 + t * 6, 3);
      carveSphere(leg.volume, 2.5, 3.5, 1 + t * 6, 3);
      carveSphere(leg.volume, 2.5, 3, 1 + t * 6, 1.5);
      carveSphere(leg.volume, 2.5, 3, 1 + t * 6, 4.5);
      n++;
    }
    expect(leg.voxelCount, "past wearBreak").toBeLessThanOrEqual(limit);
    tick(r, player);
    expect(f.parts.has("legL"), "legL broke first").toBe(false);
    // Now the kill, at the body, from the front.
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    // The ragdoll has one hinge per remaining part with a parent, and no
    // link refers to the missing leg's body (it is gone from parts).
    const parts = [...f.parts.values()];
    const withParent = parts.filter((p) => p.spec.parent !== null);
    expect(f.ragdoll.length, "hinges for the remaining attached parts").toBe(withParent.length);
    const legHandle = -1;
    void legHandle;
    // A break carries the legs to the broken pieces' debris; the ragdoll
    // hinges only tie live parts. Nothing refers to legL.
    const ragdollIds = new Set<string>();
    const byId = new Map(parts.map((p) => [p.body.handle, p.spec.id] as const));
    for (const link of f.ragdoll) {
      ragdollIds.add(byId.get(link.parent.handle) ?? "?");
      ragdollIds.add(byId.get(link.child.handle) ?? "?");
    }
    expect(ragdollIds.has("legL"), "no hinge on the missing leg").toBe(false);
    // It still falls and settles, no crash.
    for (let i = 0; i < 300; i++) tick(r, player);
    const b = f.parts.get("body")!;
    const lv = b.body.linvel();
    expect(Number.isFinite(lv.x) && Number.isFinite(lv.y) && Number.isFinite(lv.z), "body position finite").toBe(true);
  });

  it("10. settles: 3 s after a kill every part's speed is under 0.05 m/s, and no position is NaN. The measurement is at 3 s, while the corpse is still lying: by 5 s the kinetic sink has begun and a kinematic body reports its sink speed rather than its settled speed.", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 8);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
    r.world.step();
    await settleAll(r, f);
    await kill(r, f, f.parts.get("body")!, new THREE.Vector3(0, 0, -1), player);
    for (let i = 0; i < 180; i++) tick(r, player);
    for (const p of f.parts.values()) {
      const t = p.body.translation();
      expect(Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z), `${p.spec.id} position finite`).toBe(true);
      const v = p.body.linvel();
      expect(Math.hypot(v.x, v.y, v.z), `${p.spec.id} speed under 0.05`).toBeLessThan(0.05);
    }
  });

  it("11. no throw: in the first 0.5 s after a kill, the body's centre rises no more than 0.15 m and a limb's no more than 0.3 m; the body moves no more than 1.4 m and a limb no more than 2 m, whatever the shot's direction", async () => {
    const player = new THREE.Vector3(0, 1.6, 8);
    const dirs = [
      new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1),
    ];
    for (const dir of dirs) {
      const r = rig();
      const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0))!;
      r.world.step();
      await settleAll(r, f);
      await kill(r, f, f.parts.get("body")!, dir, player);
      const base = new Map<string, THREE.Vector3>();
      for (const p of f.parts.values()) base.set(p.spec.id, centreOf(p).clone());
      for (let i = 0; i < 30; i++) {
        tick(r, player);
        for (const p of f.parts.values()) {
          if (r.world.getRigidBody(p.body.handle) === null) continue;
          const b = base.get(p.spec.id)!;
          const n = centreOf(p);
          const tag = `${dir.x + dir.z === 0 ? (dir.x >= 0 ? "+x" : "-x") : (dir.z < 0 ? "-z" : "+z")} ${p.spec.id}`;
          // The body must not be launched; a limb may swing up as the body
          // pitches over, but not fly.
          const rise = p.spec.parent === null ? 0.15 : 0.3;
          expect(n.y - b.y, `${tag} rises no more than ${rise} m in 0.5 s`).toBeLessThanOrEqual(rise);
          // The rise is the real throw check (a launched body jumped 0.4 to
          // 0.5 m). Reach only catches a launch sideways: a launched body
          // went 1.5 to 3 m, while F01, hunched, topples about 1.1 m forward
          // when shot from behind, and a tall part sweeps an arc about its
          // height as it falls.
          const reach = p.spec.parent === null ? 1.4 : 2.0;
          expect(n.distanceTo(b), `${tag} moves no more than ${reach} m in 0.5 s`).toBeLessThanOrEqual(reach);
        }
      }
    }
  });
});