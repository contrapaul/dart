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
import { timeToImpact, playerCapsuleCentre } from "../../src/foamers/ball-time";
import { makeLevelAI } from "../../src/ai/level";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import type { Level } from "../../src/level/format";
import type { Loadout } from "../../src/weapons/loadout";

// BUG-04: the watch helper in the Pit, headless (the page's own sequence,
// the game page's parryNext mirrored: the nearest ball timed, the wait
// stepped without the disc, the hold left up till the caller lowers it).
// The Pit as the page loads it (the level build, the nav bake, the
// director's "normal"), a PlayerController on the pit floor where a Roamer
// can throw at it, two roaming F02s (wave two's), and, per walk, the
// observer's sequence: face the nearest thrower, parryNext, step, lower,
// step. Ten walks are recorded: which ball the walk timed, the walk's
// time against the ball's real flight (birth->judgment), the shield's
// raise and raiseAge at the hit, and whether the timed ball was parried,
// blocked or hurt the player. The stage-1 record sticks here (the
// helper takes below); stage 2 arrives with the fix and the expectation
// (nine or more of the ten parried) is still a todo until then.
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
  estOut: number; flight: number; raise: number; age: number };

describe("the watch helper in the Pit (BUG-04)", () => {
  it("records what ten walks give", async () => {
    const { rapier, world } = await createPhysics();
    const built = buildLevel(PIT, rapier, world, FAKE);
    world.step();
    const ai = makeLevelAI(rapier, world, built.navBounds, "normal");
    const player = new PlayerController(rapier, world, new THREE.Vector3(0, 0.02, -8));
    for (let i = 0; i < 60; i++) { player.update(DT, NO_CONTROL); world.step(); }
    const eye = new THREE.Vector3();
    const camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 100);
    camera.rotation.order = "YXZ";
    const debris = new DebrisSystem(rapier, world);
    const ignored = world.createCollider(rapier.ColliderDesc.capsule(0.5, 0.3)
      .setTranslation(0, 0, 200), world.createRigidBody(rapier.RigidBodyDesc.fixed()));
    const darts = new DartSystem(new THREE.Scene(), world, rapier, ignored);
    const targets: VoxelTarget[] = [];
    new DartImpacts(darts, debris, targets);
    const foamers = new FoamerSystem(rapier, world, FAKE, debris, darts, targets);
    foamers.director = ai.director;
    foamers.navGrid = ai.grid;
    const projectiles = new ProjectileSystem(rapier, world, debris, player.collider, foamers);
    foamers.projectiles = projectiles;
    const shield = new Shield(rapier, world, new THREE.Scene(), camera, player,
      { switching: false } as unknown as Loadout, foamers, debris, []);
    const fa = foamers.spawn(new THREE.Vector3(-8, 0.02, -2), undefined, "F02")!;
    const fb = foamers.spawn(new THREE.Vector3(8, 0.02, -2), undefined, "F02")!;
    const roamers: Foamer[] = [fa, fb];
    foamers.spawnCount = 0; // no keep-alive spawner: the two roamers only

    // Each ball's birth read: id, the shared flight's seconds from birth,
    // the birth time, and the walk that timed it (-1, until then).
    const rec = new Map<LiveBall, { id: number; est: number;
      born: number; walk: number }>();
    let nextId = 0;
    let simTime = 0;
    const c = new THREE.Vector3();
    const mark = () => {
      playerCapsuleCentre(eye, c);
      for (const bb of projectiles.list)
        if (!bb.bounced && !rec.has(bb))
          rec.set(bb, { id: nextId++, est: timeToImpact(bb.pos, bb.vel, DT, c),
            born: simTime, walk: -1 });
    };
    const walkLogs: WalkLog[] = [];
    const from = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    projectiles.onHitPlayer = (bb: LiveBall) => {
      // The page's own decision (game.ts).
      const spd = bb.vel.length();
      from.set(bb.pos.x - (bb.vel.x / spd) * 0.5, bb.pos.y - (bb.vel.y / spd) * 0.5,
        bb.pos.z - (bb.vel.z / spd) * 0.5);
      const blocked = shield.blocksAttackFrom(from);
      // The angle between the camera forward and the incoming ball's
      // incoming direction, read the same way blocksAttackFrom does.
      camera.getWorldDirection(fwd);
      const dx = from.x - eye.x, dz = from.z - eye.z;
      const ang = (Math.hypot(dx, dz) < 1e-6 ? 0
        : Math.acos(THREE.MathUtils.clamp(
          (dx * fwd.x + dz * fwd.z) / Math.hypot(dx, dz), -1, 1)) * 180 / Math.PI);
      console.log(`  hit#${rec.get(bb)!.id} blocked=${blocked} canParry=${
        bb.mesh.material === BALL_MATERIAL && shield.canParry()} `+
        `ang=${ang.toFixed(1)}deg`);
      const canParry = bb.mesh.material === BALL_MATERIAL && shield.canParry();
      const kind: WalkLog["kind"] = blocked && canParry ? "parry"
        : (blocked ? "block" : "hit");
      if (blocked && canParry) { shield.noteParry(); projectiles.bounce(bb); }
      const r = rec.get(bb);
      if (!r) return;
      if (r.walk >= 0) // this ball is the walk's own: count it for the walk
        walkLogs.push({ kind, id: r.id, estOut: simTime - r.born - r.est,
          flight: simTime - r.born, raise: shield.raise, age: raiseAgeOf(shield) });
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
    // The helper's own read (the page's parryNext) and the observer's
    // face (the nearest thrower's body, the camera forward the page sets
    // from the player's yaw the attacks read off).
    const timedRead = (): { b: LiveBall | null; t: number } => {
      playerCapsuleCentre(eye, c);
      let best = 1e9; let bb: LiveBall | null = null;
      for (const x of projectiles.list) {
        if (x.bounced) continue;
        const s = timeToImpact(x.pos, x.vel, DT, c);
        if (s < best) { best = s; bb = x; }
      }
      return { b: bb, t: best };
    };
    const facesNearest = () => {
      let near: Foamer | null = null;
      let nd = Infinity;
      for (const f of roamers) {
        const d = Math.hypot(f.centre.x - eye.x, f.centre.z - eye.z);
        if (d < nd) { nd = d; near = f; }
      }
      player.yaw = Math.atan2(-(near!.centre.x - eye.x), -(near!.centre.z - eye.z));
    };
    const live = (x: LiveBall | null) =>
      x !== null && projectiles.list.includes(x) && !x.bounced;

    let done = 0;
    let guard = 60 * 300;
    while (done < WALKS && guard-- > 0) {
      let wait = 0;
      while (projectiles.list.length < 1 && wait++ < 60 * 40) { step(); mark(); }
      if (projectiles.list.length < 1) break;
      mark();
      facesNearest();
      const { b: timed, t } = timedRead();
      if (!timed) { step(); continue; }
      if (rec.get(timed)) rec.get(timed)!.walk = done;
      // The helper's own walk (the page's parryNext, stepped here): step
      // the wait without the disc, then hold (the hold stays till the
      // caller lowers it, as on the current code).
      const waitFrom = simTime;
      const n = Math.round(Math.max(0, t - shield.parryLead) / DT);
      for (let i = 0; i < n; i++) { step(); mark(); }
      shield.forcedHold = true;
      let run = 0;
      while (live(timed) && run++ < 60 * 15) { step(); mark(); }
      if (!rec.get(timed)!) rec.get(timed)!.walk = done;
      const r = rec.get(timed)!;
      if (walkLogs.length <= done) // the timed ball flew by without a hit
        walkLogs.push({ kind: "gone", id: r.id, estOut: simTime - r.born,
          flight: simTime - r.born, raise: shield.raise, age: raiseAgeOf(shield) });
      shield.forcedHold = false; // the observer's lower
      for (let i = 0; i < 30; i++) { step(); mark(); }
      done += 1;
      void waitFrom;
    }
    for (const l of walkLogs)
      console.log(`walk: ${l.kind} ball#${l.id} est-out=${l.estOut.toFixed(3)} `
        + `flight=${l.flight.toFixed(3)} raise=${l.raise.toFixed(2)} `
        + `age=${l.age.toFixed(3)}`);
    const parried = walkLogs.filter((l) => l.kind === "parry").length;
    const blocked = walkLogs.filter((l) => l.kind === "block").length;
    const hurt = walkLogs.filter((l) => l.kind === "hit").length;
    console.log(`BUG-04 stage 1: ${parried} parries, ${blocked} blocked, `
      + `${hurt} hurt the player, ${walkLogs.length - parried - blocked - hurt} `
      + `went by, of ${walkLogs.length} timed balls`);
    expect(walkLogs.length, "each walk timed one ball").toBe(WALKS);
  }, 300_000);
  // BUG-04 stage 2: with the fixed helper the same ten walks parry nine or
  // more of the ten. Marked todo until the fix lands (stage 1 ships with
  // the record above, on the unmodified code).
  it.todo("the fixed walk parries nine of the ten in the Pit");
});
