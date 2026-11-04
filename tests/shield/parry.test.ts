import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { ProjectileSystem } from "../../src/foamers/projectiles";
import { Shield } from "../../src/player/shield";
import type { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import shieldJson from "../../data/shield.json";
import playerJson from "../../data/player.json";
import { DIFFICULTIES } from "../../src/core/settings";

// GAME-04 stage 2: the parry. (a) and (b) are decided by the page the same way
// the bonk and the throw test drive them: the shield's own read of a
// point's direction of travel (blocksAttackFrom) and the window's own
// read (canParry); (d) is the difficulty multiplier on the window; (c)
// drives the actual bounce-back through the projectile system with the
// range's rig (a world, a player's capsule, a real Foamer).

const DT = 1 / 60;
const T = shieldJson as unknown as typeof shieldJson;
const EYE = playerJson.eyeHeight;
const HELD = {
  fireHeld: false, firePressed: false, shieldHeld: true, shieldPressed: false,
  reloadPressed: false,
};

/** The same fake player and shield rig the block tests use. */
function makeShield() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const collider = {} as never; // the shield only passes it as a ray filter
  const player = {
    vel: new THREE.Vector3(), pitch: 0, yaw: 0, speedScale: 1,
    allowSprint: true, collider,
  } as unknown as PlayerController;
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = "YXZ";
  camera.position.set(0, EYE, 0);
  const scene = new THREE.Scene();
  const loadout = { switching: false } as unknown as Loadout;
  const debris = { spawn: () => {} } as unknown as DebrisSystem;
  const shield = new Shield(
    RAPIER, world, scene, camera, player, loadout,
    { list: [] } as unknown as FoamerSystem, debris, [],
  );
  scene.add(shield.group);
  return { world, shield, player, camera };
}

function raise(g: ReturnType<typeof makeShield>, cap = 40): void {
  for (let i = 0; i < cap && g.shield.state !== "raised"; i++) g.shield.update(DT, HELD);
  for (let i = 0; i < cap && g.shield.raise < 1; i++) g.shield.update(DT, HELD);
}

/** The same point the page's ball handler asks about: where the ball
 *  came from (its position minus its direction of travel). */
const _from = new THREE.Vector3();
function fromOf(px: number, py: number, pz: number, vx: number, vy: number, vz: number) {
  const s = Math.hypot(vx, vy, vz);
  return _from.set(px - (vx / s) * 0.5, py - (vy / s) * 0.5, pz - (vz / s) * 0.5);
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the parry's window (GAME-04 stage 2)", () => {
  it("a ball arriving just after the raise is parried, one later is only blocked", () => {
    const g = makeShield();
    raise(g);
    // A ball 3 m out at 9 m/s is about 0.33 s away: the page parries it
    // (front arc + inside the window); the decision is the same three
    // pages use.
    const ballFront = () => fromOf(0, EYE, -3, 0, 0, 1);
    const decision = (b: THREE.Vector3) =>
      g.shield.blocksAttackFrom(b) && g.shield.canParry() ? "parry" :
      g.shield.blocksAttackFrom(b) ? "block" : "hit";
    expect(g.shield.canParry()).toBe(true);
    expect(decision(ballFront())).toBe("parry");
    // Age the raise just past the data's window (a quarter of a second):
    // the same ball now only blocks, as before stage 2.
    const window = T.parry.window; // 0.25 in the data
    for (let i = 0; i < Math.ceil(window / DT) + 2; i++) g.shield.update(DT, HELD);
    expect(g.shield.state).toBe("raised"); // it is still held up
    expect(g.shield.canParry()).toBe(false);
    expect(decision(ballFront())).toBe("block");
  });

  it("a ball arriving from behind the arc is not parried, only the front is", () => {
    const g = makeShield();
    raise(g);
    expect(g.shield.canParry()).toBe(true); // it is in the window
    // A ball 3 m behind the player, travelling the other way: it is not a
    // front hit at all, so the page neither parries it nor blocks it.
    const fromBehind = fromOf(0, EYE, 3, 0, 0, -1);
    expect(g.shield.blocksAttackFrom(fromBehind)).toBe(false);
    expect(g.shield.blocksAttackFrom(fromBehind) && g.shield.canParry()).toBe(false);
    // And the front one at the same moment is parried: the arc is the
    // discrimination, with the window open for both.
    expect(g.shield.blocksAttackFrom(fromOf(0, EYE, -3, 0, 0, 1))).toBe(true);
    expect(g.shield.blocksAttackFrom(fromOf(0, EYE, -3, 0, 0, 1)) && g.shield.canParry()).toBe(true);
  });

  it("the difficulty multiplier widens and narrows the window (PLAN 10)", () => {
    const g = makeShield();
    const story = DIFFICULTIES["story"].parryWindow;
    const fury = DIFFICULTIES["fury"].parryWindow;
    expect(story).toBeGreaterThan(1);
    expect(fury).toBeLessThan(1);
    // At the data's own window the raise just over the window is no
    // longer a parry; at story's wider one it is still a parry; at
    // fury's narrower one it is already past.
    const margin = 0.18; // older than fury's (0.15), inside story's (0.375)
    raise(g);
    for (let i = 0; i < Math.round(margin / DT); i++) g.shield.update(DT, HELD);
    g.shield.parryWindowScale = story;
    expect(g.shield.canParry()).toBe(true);
    g.shield.parryWindowScale = fury;
    expect(g.shield.canParry()).toBe(false);
    // The window itself scales with the multiplier too.
    g.shield.parryWindowScale = fury;
    expect(g.shield.parryWindow()).toBeCloseTo(T.parry.window * fury, 5);
  });
});

describe("the bounce-back (GAME-04 stage 2)", () => {
  /** The range test's rig plus a Foamer that throws, so a bounced ball
   *  can come back to the one it left. */
  function makeBounceRig() {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
    const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, 1, 8));
    const playerCollider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0), playerBody,
    );
    const ignored = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3)
      .setTranslation(0, 0, 200), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
    const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignored);
    const debris = new DebrisSystem(RAPIER, world);
    const targets: VoxelTarget[] = [];
    const colors = linearColorTable();
    const mesher = { mesh: (padded: Uint8Array) => Promise.resolve(greedyMesh(padded, colors)) };
    const foamers = new FoamerSystem(RAPIER, world, mesher, debris, darts, targets);
    new DartImpacts(darts, debris, targets);
    const projectiles = new ProjectileSystem(RAPIER, world, debris, playerCollider, foamers);
    const f = foamers.spawn(new THREE.Vector3(0, 0, 5), undefined, "F02")!;
    f.state = "idle"; // hold it where it was thrown from
    return { r: { world, darts, debris, foamers, projectiles }, f,
      // Let the part colliders build (async mesher), as the Foamer tests do.
      settle: async () => {
        for (const p of f.parts.values()) {
          p.mesh.update();
          await new Promise((r) => setTimeout(r, 0));
          world.step();
        }
      },
    };
  }

  function tick(r: ReturnType<typeof makeBounceRig>["r"], player: THREE.Vector3) {
    r.darts.update(DT);
    r.foamers.update(DT, player);
    r.projectiles.update(DT);
    r.world.step();
  }

  it("a bounced ball hits its thrower, staggers it, never the player", async () => {
    const rig = makeBounceRig();
    await rig.settle();
    const { r, f } = rig;
    const eye = new THREE.Vector3(0, 1, 8);
    let playerHits = 0;
    // This is the page's own decision: one ball that will parry. A real
    // player cannot hurt, so the page calls bounce instead of burst.
    r.projectiles.onHitPlayer = (b) => {
      playerHits++;
      r.projectiles.bounce(b);
    };
    r.projectiles.launch(f, eye);
    expect(r.projectiles.list.length).toBe(1);
    expect(f.health).toBe(f.maxHealth);
    let staggered = false;
    for (let i = 0; i < 60 * 6 && r.projectiles.list.length; i++) {
      tick(r, eye);
      if (f.state === "stagger") staggered = true;
    }
    expect(playerHits, "it met the player once").toBe(1);
    expect(r.projectiles.stats.bounced, "the page parried it").toBe(1);
    expect(r.projectiles.stats.parryHits, "it came back to the one it came from").toBe(1);
    expect(f.health, "it did its damage, but did not kill it")
      .toBe(f.maxHealth - 4); // the parry block's data damage
    expect(staggered, "and the thrower staggered").toBe(true);
  });
});
