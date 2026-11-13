import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PlacedFoamers } from "../../src/level/placed";
import type { PlacedFoamer } from "../../src/level/format";

// ED-01: the level's placed Foamers, without a physics world: a stand-in
// spawner records what the game would have been asked for.

function fake() {
  const made: { pos: [number, number, number]; type: string; state: string; facing: THREE.Vector3 }[] = [];
  const spawner = {
    spawnState: "alert" as "idle" | "alert",
    spawn(feet: THREE.Vector3, facing?: THREE.Vector3, type = "F01", _promoted = false) {
      made.push({
        pos: [feet.x, feet.y, feet.z], type,
        state: spawner.spawnState,
        facing: (facing ?? new THREE.Vector3()).clone(),
      });
      return { yaw: 0 };
    },
  };
  return { made, spawner };
}

const placed: PlacedFoamer[] = [
  { id: "a", foamer: "F01", pos: [1, 0, 2], yaw: 0 },
  { id: "b", foamer: "F02", pos: [-3, 0, 4], yaw: Math.PI / 2, promoted: true },
  { id: "c", foamer: "F01", pos: [5, 0, 5], yaw: 0, wake: "trigger" },
  { id: "d", foamer: "F01", pos: [7, 0, 7], yaw: 0, hidden: true },
];

describe("PlacedFoamers", () => {
  it("spawns the sight woken ones at their place, facing their yaw, idle", () => {
    const { made, spawner } = fake();
    const p = new PlacedFoamers(placed, spawner);
    p.spawnAll();
    expect(made.map((m) => m.type)).toEqual(["F01", "F02"]);
    expect(made[0]!.pos).toEqual([1, 0, 2]);
    expect(made[1]!.pos).toEqual([-3, 0, 4]);
    // yaw 0 faces -z: a Foamer spawned toward a point is turned that way.
    expect(made[0]!.facing.z).toBeLessThan(2);
    expect(made[0]!.facing.x).toBeCloseTo(1);
    // The second faces its own +x (yaw PI/2 turns -z to -x).
    expect(made[1]!.facing.x).toBeLessThan(-3);
    // Both start idle, so the brain's own sight test wakes them.
    expect(made.map((m) => m.state)).toEqual(["idle", "idle"]);
    // The arena's start state is put back after each spawn.
    expect(spawner.spawnState).toBe("alert");
    expect(p.spawned).toBe(2);
  });

  it("leaves the trigger woken and the hidden ones waiting", () => {
    const { made, spawner } = fake();
    const p = new PlacedFoamers(placed, spawner);
    p.spawnAll();
    expect(made.length).toBe(2);
    expect(p.waitingIds).toEqual(["c", "d"]);
  });

  it("spawns them all again on a restart, once each", () => {
    const { made, spawner } = fake();
    const p = new PlacedFoamers(placed, spawner);
    p.spawnAll();
    p.spawnAll();
    expect(made.length).toBe(4);
    expect(p.spawned).toBe(2);
    // A waiting one woken before a restart is waiting again after it.
    p.wake(["c"]);
    expect(made.length).toBe(5);
    p.spawnAll();
    expect(p.waitingIds).toEqual(["c", "d"]);
  });

  it("wakes a named Foamer into the fight, and only once", () => {
    const { made, spawner } = fake();
    const p = new PlacedFoamers(placed, spawner);
    p.spawnAll();
    expect(p.wake(["c"])).toBe(1);
    expect(made[2]!.state).toBe("alert");
    expect(made[2]!.pos).toEqual([5, 0, 5]);
    expect(p.wake(["c"])).toBe(0);
    expect(p.wake(["a"])).toBe(0);
    expect(made.length).toBe(3);
    expect(p.waitingIds).toEqual(["d"]);
    expect(p.spawned).toBe(3);
  });

  it("keeps them all waiting when the system is at its cap", () => {
    const { spawner } = fake();
    const full = { ...spawner, spawn: () => null };
    const p = new PlacedFoamers(placed, full);
    p.spawnAll();
    expect(p.spawned).toBe(0);
    expect(p.waitingIds).toEqual(["a", "b", "c", "d"]);
  });
});
