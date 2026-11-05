import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import pitJson from "../../data/levels/1-1-pit.json";
import { buildLevel } from "../../src/level/build";
import { PlayerController } from "../../src/player/controller";
import { Shield } from "../../src/player/shield";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { DebrisSystem } from "../../src/voxel/debris";
import { FoamerSystem } from "../../src/foamers/foamers";
import type { Foamer } from "../../src/foamers/foamer";
import {
  ProjectileSystem, type LiveBall, BALL_MATERIAL,
} from "../../src/foamers/projectiles";
import { timeToImpact, playerCapsuleCentre, BALL_GRAVITY } from "../../src/foamers/ball-time";
import { CAPSULE_GROUPS, FOAMER_GROUPS } from "../../src/physics/world";
import { makeLevelAI } from "../../src/ai/level";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";
import type { Loadout } from "../../src/weapons/loadout";

// BUG-04: the watch helper in the Pit, headless (the page's own sequence:
// face a thrower, the helper's parryNext, step, lower, step, as the
// observer ran it in the browser, block(false) and 30 steps between
// tries). The Pit as the page loads it (the level build, the nav bake,
// the director's "normal"), a PlayerController on the pit floor where a
// Roamer can throw at it, two roaming F02s (wave two's), one walk per
// ball, ten walks. Every walk's own ball is recorded (its id, the walk's
// time against the ball's real flight, raise and raiseAge at the hit)
// and its outcome: parried, blocked, or hurt the player.
//
//  Stage 1 (committed on the unmodified helper) records the baseline:
//  1 parry, 0 blocked, 9 hurt of 10. The walk's timing was sound (the
//  ball lands on the watch's read, raise and raiseAge in the window);
//  the walk times the EARLIEST-arriving ball and faces the NEAREST
//  thrower, and in the Pit those are two different Foamers twenty-plus
//  metres apart, so the disc's front arc misses the incoming ball by
//  60 to 180 deg and it hurts instead of blocking.
//  Stage 2 (the helper's fix, this run's code): the walk faces the face's
//  attacker, so the arc judges it on. The helper lowers the disc again
//  when the timed ball has been parried, blocked or hit, so the caller
//  does not have to.
const PIT = pitJson as unknown as Level;
const DT = 1 / 60; // the page's fixed step
const WALKS = 10;
const FAKE = { mesh(p: Uint8Array): Promise<MeshData> {
  return Promise.resolve(greedyMesh(p, linearColorTable()));
} };
const NO_CONTROL = {
  move: () => ({ x: 0, y: 0 }), wasPressed: () => false,
  isDown: () => false, consumePress: () => {},
} as never;
const HELD = {
  fireHeld: false, firePressed: false, shieldHeld: false, shieldPressed: false,
  reloadPressed: false,
};
const raiseAgeOf = (s: Shield) => (s as unknown as { raiseAge: number }).raiseAge;

beforeAll(async () => { await RAPIER.init(); });

type WalkLog = { kind: "parry" | "block" | "hit" | "gone"; id: number;
  late: number; raise: number; age: number };

type Rig = {
  step: () => void;
  mark: () => void;
  timedRead: () => { b: LiveBall | null; t: number };
  live: (b: LiveBall | null) => boolean;
  faceThrower: (f: Foamer) => void;
  faceNearest: () => void;
  player: { yaw: number; pitch: number };
  rec: Map<LiveBall, { id: number; est: number; born: number; walk: number }>;
  shield: Shield;
  projectiles: ProjectileSystem;
  walkLogs: WalkLog[];
  roamers: Foamer[];
};

function makeRig(): Rig {
  // Each rig on its own world: createPhysics makes a fresh World per call,
  // and the rigs in the test file must not share one.
  void RAPIER;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const built = buildLevel(PIT, RAPIER, world, FAKE);
  world.step();
  const ai = makeLevelAI(RAPIER, world, built.navBounds, "normal");
  const player = new PlayerController(RAPIER, world, new THREE.Vector3(0, 0.02, -8));
  for (let i = 0; i < 60; i++) { player.update(DT, NO_CONTROL); world.step(); }
  const eye = new THREE.Vector3();
  const camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 100);
  camera.rotation.order = "YXZ";
  const debris = new DebrisSystem(RAPIER, world);
  const ignored = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3)
    .setTranslation(0, 0, 200), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignored);
  const targets: VoxelTarget[] = [];
  new DartImpacts(darts, debris, targets);
  const foamers = new FoamerSystem(RAPIER, world, FAKE, debris, darts, targets);
  foamers.director = ai.director;
  foamers.navGrid = ai.grid;
  const projectiles = new ProjectileSystem(RAPIER, world, debris, player.collider, foamers);
  foamers.projectiles = projectiles;
  const shield = new Shield(RAPIER, world, new THREE.Scene(), camera, player,
    { switching: false } as unknown as Loadout, foamers, debris, []);
  const fa = foamers.spawn(new THREE.Vector3(-8, 0.02, -2), undefined, "F02")!;
  const fb = foamers.spawn(new THREE.Vector3(8, 0.02, -2), undefined, "F02")!;
  foamers.spawnCount = 0; // no keep-alive spawner: the two roamers only
  const rec = new Map<LiveBall, { id: number; est: number;
    born: number; walk: number }>();
  let nextId = 0;
  let simTime = 0;
  const c = new THREE.Vector3();
  const mark = () => {
    playerCapsuleCentre(eye, c);
    for (const bb of projectiles.list)
      if (!bb.bounced && !rec.has(bb)) {
        rec.set(bb, { id: nextId++, est: timeToImpact(bb.pos, bb.vel, DT, c),
          born: simTime, walk: -1 });
        console.log(`SPAWN ball#${rec.get(bb)!.id} pos=(${bb.pos.x.toFixed(1)},${bb.pos.y.toFixed(1)},${bb.pos.z.toFixed(1)})`
          + ` vel=(${bb.vel.x.toFixed(1)},${bb.vel.y.toFixed(1)},${bb.vel.z.toFixed(1)})`
          + ` eye=(${eye.x.toFixed(1)},${eye.y.toFixed(1)},${eye.z.toFixed(1)})`
          + ` pc=(${player.collider.translation().x.toFixed(1)},${player.collider.translation().y.toFixed(1)},${player.collider.translation().z.toFixed(1)})`);
      }
  };
  const walkLogs: WalkLog[] = [];
  const from = new THREE.Vector3();
  const fwdKey = new THREE.Vector3();
  projectiles.onHitPlayer = (bb: LiveBall) => {
    // The page's own decision (game.ts).
    const spd = bb.vel.length();
    from.set(bb.pos.x - (bb.vel.x / spd) * 0.5, bb.pos.y - (bb.vel.y / spd) * 0.5,
      bb.pos.z - (bb.vel.z / spd) * 0.5);
    const blocked = shield.blocksAttackFrom(from);
    const canParry = bb.mesh.material === BALL_MATERIAL && shield.canParry();
    const kind: WalkLog["kind"] = blocked && canParry ? "parry"
      : (blocked ? "block" : "hit");
    if (blocked && canParry) { shield.noteParry(); projectiles.bounce(bb); }
    // SCRATCH: the angle the disc sees.
    const cp = Math.cos(player.pitch);
    fwdKey.set(-Math.sin(player.yaw) * cp, 0, -Math.cos(player.yaw) * cp);
    const dx = from.x - eye.x, dy = from.y - eye.y, dz = from.z - eye.z;
    const len = Math.hypot(dx, dy, dz);
    const ang = Math.acos(THREE.MathUtils.clamp(
      (dx * fwdKey.x + dz * fwdKey.z) / len, -1, 1)) * 180 / Math.PI;
    console.log(`HIT ball#${rec.get(bb)?.id ?? "-"} ang=${ang.toFixed(1)} yaw=${player.yaw.toFixed(2)} pitch=${player.pitch.toFixed(2)}`
      + ` from=(${from.x.toFixed(1)},${from.y.toFixed(1)},${from.z.toFixed(1)})`
      + ` pos=(${bb.pos.x.toFixed(1)},${bb.pos.y.toFixed(1)},${bb.pos.z.toFixed(1)})`
      + ` vel=(${bb.vel.x.toFixed(1)},${bb.vel.y.toFixed(1)},${bb.vel.z.toFixed(1)})`
      + ` th=(${bb.thrower.centre.x.toFixed(1)},${bb.thrower.centre.y.toFixed(1)},${bb.thrower.centre.z.toFixed(1)})`);
    const r = rec.get(bb);
    if (!r || r.walk < 0) return; // not a walk's own ball
    walkLogs.push({ kind, id: r.id, late: simTime - r.born - r.est,
      raise: shield.raise, age: raiseAgeOf(shield) });
  };
  // SCRATCH: for one near ball, re-run the sim's own raycast one step early
  // and log what the cast says, with the sim's exact filter (projectiles.ts).
  const origUpdate = projectiles.update.bind(projectiles);
  const near = (bb: LiveBall) => {
    const p = player.collider.translation();
    const dx = bb.pos.x - p.x, dz = bb.pos.z - p.z;
    return dx * dx + dz * dz < 1.44;
  };
  const prjAny = projectiles as unknown as {
    _po: { x: number; y: number; z: number };
    _pd: { x: number; y: number; z: number };
    _ray: RAPIER.Ray;
  };
  projectiles.update = (dt: number) => {
    const r = projectiles.list.find((bb) => !bb.bounced && near(bb));
    if (r) {
      const vyl = r.vel.y - BALL_GRAVITY * dt; // the gravity this step applies
      const vv = new THREE.Vector3(r.vel.x, vyl, r.vel.z);
      const sp = vv.length();
      prjAny._po.x = r.pos.x; prjAny._po.y = r.pos.y; prjAny._po.z = r.pos.z;
      prjAny._pd.x = vv.x / sp; prjAny._pd.y = vv.y / sp; prjAny._pd.z = vv.z / sp;
      const h = world.castRay(
        prjAny._ray, sp * dt, true, 8, undefined, undefined, undefined, (c) => {
          const g = c.collisionGroups();
          if (r.bounced && c === player.collider) return false;
          if (g === CAPSULE_GROUPS) return false;
          return !r.bounced ? g !== FOAMER_GROUPS : true;
        },
      );
      console.log(`SLD ball#${rec.get(r)!.id} age=${r.age.toFixed(3)}`
        + ` hit=${h ? h.timeOfImpact.toFixed(3) : "none"}`
        + ` maxd=${(sp * dt).toFixed(3)}`
        + ` pos=(${r.pos.x.toFixed(2)},${r.pos.y.toFixed(2)},${r.pos.z.toFixed(2)})`);
    }
    const wasNear = r !== undefined && near(r);
    origUpdate(dt);
    if (wasNear && r) {
      console.log(`AFT ball#${rec.get(r)!.id} age=${r.age.toFixed(3)}`
        + ` pos=(${r.pos.x.toFixed(2)},${r.pos.y.toFixed(2)},${r.pos.z.toFixed(2)})`);
      if (!projectiles.list.includes(r))
        console.log(`DEL ball#${rec.get(r)!.id} age=${r.age.toFixed(3)}`);
    }
  };
  const step = () => {
    const w = shield.slowed(DT);
    simTime += DT;
    player.update(DT, NO_CONTROL);
    player.eye(1, eye);
    camera.position.copy(eye);
    camera.rotation.y = player.yaw;
    camera.updateMatrixWorld();
    foamers.update(w, eye);
    projectiles.update(w);
    shield.update(DT, HELD);
    world.step();
  };
  // The helper's own read (the page's parryNext): the earliest incoming
  // (not bounced) ball, and its seconds by the shared flight.
  const timedRead = () => {
    playerCapsuleCentre(eye, c);
    let best = 1e9; let bb: LiveBall | null = null;
    for (const x of projectiles.list) {
      if (x.bounced) continue;
      const s = timeToImpact(x.pos, x.vel, DT, c);
      if (s < best) { best = s; bb = x; }
    }
    return { b: bb, t: best };
  };
  const faceThrower = (f: Foamer) => {
    const at = f.centre;
    const dx = at.x - eye.x, dy = at.y + 1.2 - eye.y, dz = at.z - eye.z; // feet
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)),
      -1.5, 1.5);
  };
  const faceNearest = () => {
    let near: Foamer | null = null;
    let nd = Infinity;
    for (const f of foamers.list) {
      const d = Math.hypot(f.centre.x - eye.x, f.centre.z - eye.z);
      if (d < nd) { nd = d; near = f; }
    }
    faceThrower(near!);
  };
  const live = (x: LiveBall | null) =>
    x !== null && projectiles.list.includes(x) && !x.bounced;
  return { step, mark, timedRead, live, faceThrower, faceNearest, rec,
    shield, projectiles, walkLogs, roamers: [fa, fb], player };
}

async function runSequence(r: Rig, fixed: boolean): Promise<void> {
  let done = 0;
  let guard = 60 * 300;
  while (done < WALKS && guard-- > 0) {
    let wait = 0;
    while (r.projectiles.list.length < 1 && wait++ < 60 * 40) { r.step(); r.mark(); }
    if (r.projectiles.list.length < 1) break;
    r.mark();
    r.faceNearest(); // the observer's move (both runs: it is the walk's)
    const { b: timed, t } = r.timedRead();
    if (!timed) { r.step(); continue; }
    r.rec.get(timed)!.walk = done;
    if (fixed) {
      r.faceThrower(timed.thrower);
      console.log(`FACED ball#${r.rec.get(timed)!.id} th=(${timed.thrower.centre.x.toFixed(1)},${timed.thrower.centre.z.toFixed(1)}) yaw=${r.player.yaw.toFixed(2)}`);
    }
    const n = Math.round(Math.max(0, t - r.shield.parryLead) / DT);
    for (let i = 0; i < n; i++) { r.step(); r.mark(); }
    r.shield.forcedHold = true;
    let run = 0;
    while (r.live(timed) && run++ < 60 * 15) { r.step(); r.mark(); }
    const rr = r.rec.get(timed)!;
    if (!r.walkLogs.some((l) => l.id === rr.id)) // the ball flew by: gone
      r.walkLogs.push({ kind: "gone", id: rr.id, late: Number.NaN,
        raise: r.shield.raise, age: raiseAgeOf(r.shield) });
    r.shield.forcedHold = false; // lower (the fix does it itself)
    for (let i = 0; i < 30; i++) { r.step(); r.mark(); }
    done += 1;
  }
  for (const l of r.walkLogs)
    console.log(`walk: ${l.kind} ball#${l.id} late=${Number.isNaN(l.late)
      ? "-" : l.late.toFixed(3)} raise=${l.raise.toFixed(2)} `
      + `age=${l.age.toFixed(3)}`);
  const p = r.walkLogs.filter((l) => l.kind === "parry").length;
  const b = r.walkLogs.filter((l) => l.kind === "block").length;
  const h = r.walkLogs.filter((l) => l.kind === "hit").length;
  console.log(`${fixed ? "fixed walk" : "stage-1 record"}: ${p} parries, `
    + `${b} blocked, ${h} hurt, ${r.walkLogs.length - p - b - h} went by, `
    + `of ${r.walkLogs.length} timed balls`);
}

describe("the watch helper in the Pit (BUG-04)", () => {
  it("stage 1: records the as-is walk on the Pit (the bug)", async () => {
    const r = makeRig();
    await runSequence(r, false);
    expect(r.walkLogs.length, "each walk timed one ball").toBe(WALKS);
    const parried = r.walkLogs.filter((l) => l.kind === "parry").length;
    // Result recorded in 1.11 (browser, the Pit): 2 of 10, the rest
    // blocked or hit. Same walk headless: about 1 of 10 parries, 9 winds
    // (the sole parry was lucky: the walk's forward happened to judge on
    // its ball even as the watch had the wrong Foamer's arc). Either pin:
    // the density is nowhere near 9 of 10 on the as-is helper, so the
    // stage-2 test (next) would be the one that proves the fix, not
    // the record here.
    expect(parried, "the as-is helper parries a minority of 10 in the Pit")
      .toBeLessThan(5);
  }, 300_000);
  it("stage 2: the fixed walk parries nine of the ten", async () => {
    const r = makeRig();
    await runSequence(r, true);
    expect(r.walkLogs.length, "each walk timed one ball").toBe(WALKS);
    const parried = r.walkLogs.filter((l) => l.kind === "parry").length;
    expect(parried, "the helper's fix: face the thrower of the timed ball, "
      + "and lower the disc once the ball is done").toBeGreaterThanOrEqual(9);
  }, 300_000);
});
