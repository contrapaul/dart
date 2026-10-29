import RAPIER from "@dimforge/rapier3d-compat";

export type Rapier = typeof RAPIER;

// The compat build carries its WebAssembly inline, so it is bundled with the
// game and never fetched from another host.
export async function createPhysics(): Promise<{ rapier: Rapier; world: RAPIER.World }> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  return { rapier: RAPIER, world };
}
