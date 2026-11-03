import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Shield } from "../../src/player/shield";
import type { PlayerController } from "../../src/player/controller";
import type { Loadout } from "../../src/weapons/loadout";
import type { FoamerSystem } from "../../src/foamers/foamers";
import type { DebrisSystem } from "../../src/voxel/debris";
import type { VoxelTarget } from "../../src/weapons/impacts";
import shieldJson from "../../data/shield.json";
import playerJson from "../../data/player.json";

// GAME-04 stage 1: the shield. The disc physics needs a Rapier world and
// real Foamers (their parts are the hit surfaces), so this uses the same
// kind of rig as the Foamer tests: a world with a floor and walls, real
// spawned Foamers, and a fake player (an eye point, a yaw, a pitch: that
// is all the shield reads of the controller) and a fake loadout (never
// switching). The disc's own pose group and the viewmodel need a camera.

const DT = 1 / 60;
const T = shieldJson as unknown as typeof shieldJson;
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

/** Move the player and camera: yaw 0 looks along -z. */
function face(g: { camera: THREE.Camera; player: PlayerController }, yaw: number, pitch = 0) {
  g.player.yaw = yaw;
  g.player.pitch = pitch;
  g.camera.rotation.set(pitch, yaw, 0);
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

describe("Shield blocking (front arc, share, walk)", () => {
  it("1. a hit from the front inside the arc is blocked, one from behind is not", () => {
    const g = makeShield();
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, -2))).toBe(false); // lowered
    raise(g);
    expect(g.shield.state).toBe("raised");
    const half = (T.block.frontArcDeg / 2) * (Math.PI / 180);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, -2))).toBe(true);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(Math.sin(half - 0.2) * 2, EYE, -Math.cos(half - 0.2) * 2))).toBe(true);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(Math.sin(half + 0.2) * 2, EYE, -Math.cos(half + 0.2) * 2))).toBe(false);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, 2))).toBe(false);
    // Looking the other way: the same point behind the player is not covered.
    face(g, Math.PI);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, -2))).toBe(false);
    expect(g.shield.blocksAttackFrom(new THREE.Vector3(0, EYE, 2))).toBe(true);
  });

  it("2. the share and the walk gate come from the data", () => {
    const g = makeShield();
    expect(g.shield.damageShare).toBe(T.block.damageShare);
    raise(g);
    expect(g.player.speedScale).toBe(T.block.walkShare);
    expect(g.player.allowSprint).toBe(false);
    expect(g.shield.blocksFire).toBe(true);
    // Drop it: the walk returns to full.
    for (let i = 0; i < 40 && g.shield.state === "raised"; i++) g.shield.update(DT, CONTROLS);
    for (let i = 0; i < 40 && g.shield.raise > 0; i++) g.shield.update(DT, CONTROLS);
    expect(g.player.speedScale).toBe(1);
    expect(g.player.allowSprint).toBe(true);
    expect(g.shield.blocksFire).toBe(false);
  });

  it("3. the raise takes about the data's raiseTime", () => {
    const g = makeShield();
    let t = 0;
    while (g.shield.raise < 1 && t < 2) {
      g.shield.update(DT, HELD);
      t += DT;
    }
    expect(t).toBeGreaterThanOrEqual(T.block.raiseTime - DT);
    expect(t).toBeLessThanOrEqual(T.block.raiseTime + 2 * DT);
  });
});
