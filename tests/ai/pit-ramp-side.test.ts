import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { makePitRig, tick } from "./pit-rig";

// BUG-01 part 2, the reported spot: the player on open pit floor at
// (0, 0, -4), and the wave spawned where the card saw it stand: the four
// Foamers against the side of ramp-s (x -16 to -10, z -9 to -1) at x about
// -9.2 to -9.8, z about -1.5 to -2.6. All four stood in approach for over
// 30 s with a 2 or 3 point path and never moved.

beforeAll(async () => {
  await RAPIER.init();
});

describe("a wave spawned against the south ramp (BUG-01)", () => {
  it("leaves the ramp's side and engages the player", async () => {
    const r = await makePitRig();
    const player = new THREE.Vector3(0, 1.6, -4);
    // Two F01 and two F02, the wave's mix, on the spots the card recorded.
    const spots: [number, number][] = [[-9.5, -2.0], [-9.8, -2.6], [-9.2, -1.5], [-9.6, -2.1]];
    const types = ["F01", "F01", "F02", "F02"];
    const fs = spots.map(([x, z], k) =>
      r.foamers.spawn(new THREE.Vector3(x, 0, z), player, types[k]!)!);

    // No Foamer may sit in approach without getting closer. Track the best
    // distance each reached and whether it ever broke out of approach.
    const closed = fs.map(() => Infinity);
    const engaged = fs.map(() => false);
    for (let i = 0; i < 60 * 20; i++) {
      tick(r, player);
      for (const [k, f] of fs.entries()) {
        const d = Math.hypot(f.centre.x - player.x, f.centre.z - player.z);
        if (d < closed[k]!) closed[k] = d;
        if (f.state !== "approach" && f.state !== "idle" && f.state !== "alert") {
          engaged[k] = true;
        }
      }
    }
    for (let k = 0; k < fs.length; k++) {
      const reached = closed[k]! < 3;
      expect(reached || engaged[k], `Foamer ${k} left the ramp's side`).toBe(true);
    }
  });
});
