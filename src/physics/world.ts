import RAPIER from "@dimforge/rapier3d-compat";

export type Rapier = typeof RAPIER;

// The compat build carries its WebAssembly inline, so it is bundled with the
// game and never fetched from another host.
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
/** Debris touches the world only. The player is still pushed through it by
 *  physics, but character movement queries skip it so it never trips anyone. */
export const DEBRIS_GROUPS = groups(GROUP_DEBRIS, GROUP_WORLD);
/** Ragdoll bodies (a downed Foamer) touch the world only: the player walks
 *  and darts fly through them, and they never stop a live Foamer's capsule
 *  (the capsule only queries the world group). Not each other either: a
 *  Foamer's part boxes overlap where they join, and colliding them threw
 *  the whole ragdoll on the step it formed (ENG-12 review). */
export const RAGDOLL_GROUPS = groups(GROUP_RAGDOLL, GROUP_WORLD);
/** Groups for queries that should ignore debris and ragdolls. */
export const SOLID_QUERY_GROUPS = groups(0xffff, 0xffff & ~(GROUP_DEBRIS | GROUP_RAGDOLL));
