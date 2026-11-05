import RAPIER from "@dimforge/rapier3d-compat";

export type Rapier = typeof RAPIER;

// "@dimforge/rapier3d-compat" is aliased to a shim that re-exports the
// non-compat build, whose WebAssembly is a separate content-hashed file
// (OPS-02), so init() here is awaited for the compat-build call sites but
// does nothing: the module import already loaded the engine.
export async function createPhysics(): Promise<{ rapier: Rapier; world: RAPIER.World }> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return { rapier: RAPIER, world };
}

// Collision groups: a Rapier group value is (membership << 16) | filter.
export const GROUP_WORLD = 1;
export const GROUP_DEBRIS = 1 << 2;
export const GROUP_RAGDOLL = 1 << 4;
export function groups(membership: number, filter: number) {
  return ((membership << 16) | filter) >>> 0;
}
export const GROUP_FOAMER = 1 << 3;
/** A live Foamer's part boxes: darts and colliders still meet them, but they
 *  are not part of the world, so a debris piece passes through them. A
 *  piece breaks off inside the body's own space, and from GAME-11 the body
 *  then tips over the very spot the piece is flying out of: without this the
 *  falling hips squashed the piece into the floor. */
export const FOAMER_GROUPS = groups(GROUP_FOAMER, 0xffff);
/** Debris touches the world only. The player is still pushed through it by
 *  physics, but character movement queries skip it so it never trips anyone. */
export const DEBRIS_GROUPS = groups(GROUP_DEBRIS, GROUP_WORLD);
/** Ragdoll bodies (a downed Foamer) touch the world only: the player walks
 *  and darts fly through them, and they never stop a live Foamer's capsule
 *  (the capsule only queries the world group). Not each other either: a
 *  Foamer's part boxes overlap where they join, and colliding them threw
 *  the whole ragdoll on the step it formed (ENG-12 review). */
export const RAGDOLL_GROUPS = groups(GROUP_RAGDOLL, GROUP_WORLD);
export const GROUP_CAPSULE = 1 << 5;
/** A live Foamer's movement capsule. Still a world member, so everything
 *  that met it before still does (every filter in the game includes the
 *  world bit); the capsule bit only lets darts pass it. Nothing draws the
 *  capsule, and on a walking Foamer it shows between the legs and arms, so
 *  a dart that stopped on it did no damage (ENG-13 review). */
export const CAPSULE_GROUPS = groups(GROUP_WORLD | GROUP_CAPSULE, 0xffff);
/** Groups for queries that should ignore debris and ragdolls. */
export const SOLID_QUERY_GROUPS = groups(0xffff, 0xffff & ~(GROUP_DEBRIS | GROUP_RAGDOLL));
/** Groups for a Foamer's line of sight: solid level geometry only, not
 *  Foamer part boxes (its own sit round the ray's start), debris or
 *  ragdolls. */
export const SIGHT_QUERY_GROUPS = groups(0xffff, 0xffff & ~(GROUP_DEBRIS | GROUP_RAGDOLL | GROUP_FOAMER));
