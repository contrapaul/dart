import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { makePitRig, DT, type PitRig } from "./pit-rig";
import { ProjectileSystem } from "../../src/foamers/projectiles";

// BUG-07: a Roamer throws when its ball cannot reach the player. The card
// saw 8 of 10 balls burst on the Pit's level trimesh 1.7 m from the hand of
// an F02 at (-6.5, 0, 5.8) while the player stood at (0, 0, 1.2): the
// Roamer's sight ray runs chest to eye, but the ball leaves its hand on an
// arc and meets the cover in front of it. This rig is the Pit as the arena
// page builds it, plus a still player capsule and the projectile system.

/** The player's eye, which is what the Foamer system is handed each step. */
const EYE = new THREE.Vector3(0, 1.6, 1.2);
const ROAMER = new THREE.Vector3(-6.5, 0, 5.8);
/** The capsule's centre: the eye less the eye's height above it (1.6 - 0.9). */
const CENTRE_Y = 0.9;

interface ThrowCounts {
  thrown: number;
  reached: number;
  live: number;
  burst: number;
}

interface ThrowRig extends PitRig {
  projectiles: ProjectileSystem;
}

/** The Pit, one still player capsule at the card's spot, and the balls. */
async function makeThrowRig(): Promise<ThrowRig> {
  const r = await makePitRig();
  const body = r.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(EYE.x, CENTRE_Y, EYE.z),
  );
  const capsule = r.world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0, 0), body,
  );
  const projectiles = new ProjectileSystem(r.rapier, r.world, r.debris, capsule, r.foamers);
  r.foamers.projectiles = projectiles;
  return { ...r, projectiles };
}

/** The rig's frame, in the game's order (the balls step after the Foamers). */
function tick(r: ThrowRig): void {
  r.darts.update(DT);
  r.foamers.update(DT, EYE);
  r.projectiles.update(DT);
  r.world.step();
  r.darts.syncRender();
}

/** Run the Pit for `seconds` with one Roamer at the card's spot. */
async function run(seconds: number) {
  const r = await makeThrowRig();
  // No keep-alive spawner: the one Roamer is the whole fight.
  r.foamers.spawnCount = 0;
  const f = r.foamers.spawn(ROAMER, EYE, "F02")!;
  expect(f).toBeTruthy();
  for (let i = 0; i < 60 * seconds; i++) tick(r);
  const s = r.projectiles.stats;
  const counts: ThrowCounts = {
    thrown: s.thrown,
    reached: s.hitPlayer,
    live: r.projectiles.list.length,
    burst: s.burst,
  };
  return { r, f, counts };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("a Roamer at the Pit's cover (BUG-07)", () => {
  // BUG-07 stage 1: the repro, expected to fail until the fix. It prints the
  // before counts (thrown, reached, still flying) on every run.
  it.fails("does not throw into the cover at (-6.5, 5.8)", async () => {
    const { counts } = await run(30);
    console.log(`BUG-07 before: thrown ${counts.thrown}, reached ${counts.reached}, `
      + `live ${counts.live}, burst ${counts.burst}`);
    expect(counts.thrown).toBeGreaterThanOrEqual(6);
    expect(counts.reached).toBeGreaterThanOrEqual(Math.ceil(counts.thrown * 0.8));
  });
});
