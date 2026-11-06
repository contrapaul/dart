import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import levelJson from "../../data/levels/1-2.json";
import type { Level } from "../../src/level/format";
import { makeLevelRig, DT, type PitRig } from "./pit-rig";
import { ProjectileSystem } from "../../src/foamers/projectiles";

// BUG-07: the Level 1-2 tower's first fight puts two Roamers on floor 2
// (y 5) over a player who can stand on the ground floor under the slab.
// Before the fix they threw at the slab: the chest ray to the eye went
// through the floor opening, the ball did not. With the clear-flight check
// a Roamer only throws where the arc itself is clear, so on the ground
// floor nothing bursts up on floor 2, and on floor 2 the throws still land.

const level = levelJson as unknown as Level;
/** The tower's first wave: its two rifts' feet, on floor 2. */
const RIFTS = [new THREE.Vector3(-14, 5, -26), new THREE.Vector3(-4, 5, -32)];
/** The player's eye on the ground floor, under floor 2's slab. */
const DOWN = new THREE.Vector3(-8, 1.6, -29);
/** The same spot one floor up: feet on floor 2. */
const UP = new THREE.Vector3(-8, 6.6, -29);

interface TowerRig extends PitRig {
  projectiles: ProjectileSystem;
  /** Every burst point, in order. */
  bursts: THREE.Vector3[];
}

/** The tower with the player's capsule where the case needs it. */
async function makeTower(eye: THREE.Vector3): Promise<TowerRig> {
  const r = await makeLevelRig(level);
  const body = r.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(eye.x, eye.y - 0.7, eye.z),
  );
  const capsule = r.world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35), body,
  );
  const projectiles = new ProjectileSystem(r.rapier, r.world, r.debris, capsule, r.foamers);
  r.foamers.projectiles = projectiles;
  const bursts: THREE.Vector3[] = [];
  projectiles.onSound = (kind, at) => {
    if (kind === "burst") bursts.push(at.clone());
  };
  return { ...r, projectiles, bursts };
}

/** The tower's first fight, one Roamer per rift, for `seconds`. */
async function fight(eye: THREE.Vector3, seconds: number) {
  const r = await makeTower(eye);
  r.foamers.spawnCount = 0;
  for (const at of RIFTS) r.foamers.spawn(at, eye, "F02");
  for (let i = 0; i < 60 * seconds; i++) {
    r.darts.update(DT);
    r.foamers.update(DT, eye);
    r.projectiles.update(DT);
    r.world.step();
    r.darts.syncRender();
  }
  return r;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the Level 1-2 tower's Roamers (BUG-07)", () => {
  it("does not throw into the slab at a player on the ground floor", async () => {
    const r = await fight(DOWN, 30);
    const s = r.projectiles.stats;
    console.log(`BUG-07 tower down: thrown ${s.thrown}, hit ${s.hitPlayer}, `
      + `burst ${s.burst}`);
    // Nothing bursts on floor 2: a ball that meets the slab, its edge or a
    // wall beside it never got away. A ball that drops through the floor's
    // opening and bursts on the ground floor did arrive, so it is no fail.
    const high = r.bursts.filter((b) => b.y > 3);
    expect(high.map((b) => `${b.x.toFixed(1)},${b.y.toFixed(1)},${b.z.toFixed(1)}`))
      .toEqual([]);
    // And they are still fighting: a Roamer with no clear flight from floor
    // 2 does not freeze, and the ones whose arc does reach still throw.
    expect(s.thrown).toBeGreaterThan(0);
  });

  it("still lands its throws at a player on floor 2", async () => {
    const r = await fight(UP, 30);
    const s = r.projectiles.stats;
    console.log(`BUG-07 tower up: thrown ${s.thrown}, hit ${s.hitPlayer}, `
      + `burst ${s.burst}`);
    expect(s.hitPlayer).toBeGreaterThanOrEqual(6);
  });
});
