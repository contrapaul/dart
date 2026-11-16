import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Shield } from "../../src/player/shield";
import type { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import type { FoamerSystem } from "../../src/foamers/foamers";
import type { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import playerJson from "../../data/player.json";

// ARM-01: the shield needs a free hand. Rig as block.test.ts: GAME-04 stage 1: the shield. The disc physics needs a Rapier world and
// real Foamers (their parts are the hit surfaces), so this uses the same
// kind of rig as the Foamer tests: a world with a floor and walls, real
// spawned Foamers, and a fake player (an eye point, a yaw, a pitch: that
// is all the shield reads of the controller) and a fake loadout (never
// switching). The disc's own pose group and the viewmodel need a camera.

const DT = 1 / 60;
const EYE = playerJson.eyeHeight;

const CONTROLS = {
  fireHeld: false, firePressed: false, shieldHeld: false, shieldPressed: false,
  reloadPressed: false,
};
const HELD = { ...CONTROLS, shieldHeld: true };

function makePlayer(x = 0, z = 0) {
  const collider = {} as never; // the shield only passes it as a ray filter
  const player = {
    vel: new THREE.Vector3(),
    pitch: 0,
    yaw: 0,
    speedScale: 1,
    allowSprint: true,
    collider,
  } as unknown as PlayerController;
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = "YXZ";
  camera.position.set(x, EYE, z);
  const scene = new THREE.Scene();
  const loadout = { switching: false } as unknown as Loadout;
  const debris = { spawn: () => {} } as unknown as DebrisSystem;
  return { player, camera, scene, loadout, debris };
}

function makeShield(x = 0, z = 0, targets: VoxelTarget[] = []) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const p = makePlayer(x, z);
  const shield = new Shield(
    RAPIER, world, p.scene, p.camera, p.player, p.loadout,
    { list: [] } as unknown as FoamerSystem, p.debris, targets,
  );
  p.scene.add(shield.group); // as the page does
  return { world, shield, ...p };
}

/** Steps until raised, with the budget to fail loudly. */
function raise(g: { shield: Shield }, held = HELD, cap = 40): number {
  for (let i = 0; i < cap && g.shield.state !== "raised"; i++) g.shield.update(DT, held);
  for (let i = 0; i < cap && g.shield.raise < 1; i++) g.shield.update(DT, held);
  return 0;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("ARM-01: the shield needs a free hand", () => {
  it("with both hands on the blaster the disc is put away and the shield action does nothing", () => {
    const g = makeShield();
    g.shield.handFree = false;
    for (let i = 0; i < 40; i++) g.shield.update(DT, HELD);
    expect(g.shield.state).toBe("lowered");
    expect(g.shield.raise).toBe(0);
    expect(g.shield.blocksFire).toBe(false);
    expect(g.shield.group.visible).toBe(false);
    // Toggle mode: a press with no free hand is not remembered.
    g.shield.toggleMode = true;
    g.shield.update(DT, { ...CONTROLS, shieldPressed: true });
    g.shield.handFree = true;
    for (let i = 0; i < 40; i++) g.shield.update(DT, CONTROLS);
    expect(g.shield.state).toBe("lowered");
    expect(g.shield.group.visible).toBe(true);
  });

  it("with a free hand it raises as before, and losing the hand lowers it and puts it away", () => {
    const g = makeShield();
    raise(g);
    expect(g.shield.state).toBe("raised");
    expect(g.shield.group.visible).toBe(true);
    g.shield.handFree = false;
    for (let i = 0; i < 40; i++) g.shield.update(DT, HELD);
    expect(g.shield.state).toBe("lowered");
    expect(g.shield.raise).toBe(0);
    expect(g.shield.group.visible).toBe(false);
  });
});
