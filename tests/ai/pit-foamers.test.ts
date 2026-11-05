import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { makePitRig, tick } from "./pit-rig";
import { DT } from "./pit-rig";

// BUG-01 on the real Pit: the ring hangs over the pit floor, and a Foamer
// whose player stands under it must walk in under it too.

beforeAll(async () => {
  await RAPIER.init();
});

describe("a Foamer and a player under the Pit's ring (BUG-01)", () => {
  it("bakes the pit floor under the ring, not the ring's top", async () => {
    const r = await makePitRig();
    // ring-s is a box at z -13 to -9 with its top at y 4; the pit floor
    // under it is y 0 and is where a player can walk.
    expect(r.grid.groundAt(0, -11), "the floor under ring-s").toBeCloseTo(0, 1);
    expect(r.grid.walkableAt(0, -11)).toBe(true);
    expect(r.grid.groundAt(0, 11), "the floor under ring-n").toBeCloseTo(0, 1);
  });

  it("keeps the ring's top as well as the floor under it", async () => {
    const r = await makePitRig();
    // Both surfaces are floor an agent can stand on, so the cell holds two
    // layers and the height asked for picks one (BUG-01 round 2).
    expect(r.grid.groundAt(0, -11, 4), "the ring's top").toBeCloseTo(4, 1);
    expect(r.grid.walkableAt(0, -11, 4)).toBe(true);
    expect(r.grid.groundAt(0, -11, 0), "the pit floor").toBeCloseTo(0, 1);
    expect(r.grid.walkableAt(0, -11, 0)).toBe(true);
  });

  it("walks up to the player standing on the ring", async () => {
    const r = await makePitRig();
    // The player stands on ring-s (top y 4), the Foamer starts on open floor
    // north of the Pit: it has to find the ramp rather than walk under it.
    const player = new THREE.Vector3(0, 5.6, -11);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, 0), player, "F01")!;
    expect(f).toBeTruthy();
    let reached = Infinity;
    let engaged = false;
    // 45 s, not the card's 25: the only route up is the south ramp, which
    // makes it about 28 m, and an F01 walks one metre a second. It is on the
    // ring by second 25 and reaches the player at about second 35.
    for (let i = 0; i < 60 * 45; i++) {
      tick(r, player);
      const d = Math.hypot(
        f.centre.x - player.x, f.centre.y - (player.y - 1.6), f.centre.z - player.z,
      );
      if (d < reached) reached = d;
      // Engaging does not count from under the ring: the pre-fix Foamer stood
      // on pit floor beneath the player, swinging at nothing 4 m below.
      if (f.centre.y > 2.5 &&
        (f.state === "windup" || f.state === "strike" || f.state === "recover")) engaged = true;
      if (d < 1.6 || engaged) break;
    }
    expect(engaged || reached < 1.6, "the Foamer reached or engaged the player on the ring")
      .toBe(true);
  });

  it("walks under the ring to reach the player", async () => {
    const r = await makePitRig();
    // The player stands on the pit floor under ring-s; the Foamer starts on
    // open floor north of it, with a clear straight line all the way.
    const player = new THREE.Vector3(0, 1.6, -11);
    const f = r.foamers.spawn(new THREE.Vector3(0, 0, -6), player, "F01")!;
    expect(f).toBeTruthy();
    let reached = Infinity;
    for (let i = 0; i < 60 * 12; i++) {
      tick(r, player);
      const d = Math.hypot(f.centre.x - player.x, f.centre.z - player.z);
      if (d < reached) reached = d;
      if (d < 1.6) break;
    }
    expect(reached, "the Foamer reached the player under the ring").toBeLessThan(1.6);
    expect(DT).toBeGreaterThan(0);
  });
});
