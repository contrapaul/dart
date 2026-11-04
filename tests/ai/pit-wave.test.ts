import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { makePitRig, tick } from "./pit-rig";

// BUG-01 part 2: the Pit's wave 2 is three F01 and two F02 out of two rifts.
// Foamers that arrive in a clump must not lock each other in place: the card
// saw four of them stand still in approach for over 30 s beside the south
// ramp, with a 2 or 3 point path and never a throw.

beforeAll(async () => {
  await RAPIER.init();
});

describe("a wave out of one rift in the Pit (BUG-01)", () => {
  it("engages the player instead of standing still", async () => {
    const r = await makePitRig();
    const player = new THREE.Vector3(0, 1.6, -4);
    // All five at the west rift: the page spawns a wave on one spot, so a
    // wave is a clump from the first frame, inside each other's capsule.
    const rift = new THREE.Vector3(-8, 0.2, 7);
    const fs = [
      r.foamers.spawn(rift, player, "F01")!,
      r.foamers.spawn(rift, player, "F01")!,
      r.foamers.spawn(rift, player, "F01")!,
      r.foamers.spawn(rift, player, "F02")!,
      r.foamers.spawn(rift, player, "F02")!,
    ];
    // Every Foamer must engage: close to bonk range, or break out of
    // approach to throw from its hold ring. A Foamer frozen against a ramp
    // does neither and stays in approach for the whole run.
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
      expect(reached || engaged[k], `Foamer ${k} closed on the player or engaged`).toBe(true);
    }
  });
});
