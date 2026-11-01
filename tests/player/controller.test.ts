import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PlayerController, P } from "../../src/player/controller";
import type { Input } from "../../src/core/input";

beforeAll(async () => {
  await RAPIER.init();
});

/** Input that holds one move and presses nothing. */
function holding(x: number, y: number) {
  const move = { x, y };
  return {
    move: () => move,
    wasPressed: () => false,
    isDown: () => false,
  } as unknown as Input;
}

describe("PlayerController", () => {
  it("1. walking on a flat floor never stalls (Paul's movement hitch, 2026-11-01)", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0));
    const player = new PlayerController(RAPIER, world, new THREE.Vector3(-25, 0, 0));
    const input = holding(1, 0); // strafe right, along +x with yaw 0
    let atSpeed = false;
    let stalls = 0;
    for (let i = 0; i < 420; i++) { // about 48 m, short of the far edge
      player.update(1 / 60, input);
      world.step();
      const speed = Math.hypot(player.vel.x, player.vel.z);
      if (speed >= P.walkSpeed - 0.01) atSpeed = true;
      else if (atSpeed) stalls++;
    }
    expect(atSpeed).toBe(true);
    expect(stalls).toBe(0);
    expect(player.grounded).toBe(true);
    expect(Math.abs(player.feet)).toBeLessThan(0.05);
  });
});
