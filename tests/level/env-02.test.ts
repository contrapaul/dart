import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import envJson from "../../data/levels/env-02.json";
import { buildLevel } from "../../src/level/build";
import { validateLevel } from "../../src/level/validate";
import { ButtonSystem } from "../../src/level/buttons";
import { LevelRunner, type LevelEvents } from "../../src/level/level-runner";
import { createPhysics } from "../../src/physics/world";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import { ARENA_LEVELS, chosenLevel } from "../../src/arena/levels";
import type { Level } from "../../src/level/format";
import buttonsJson from "../../data/buttons.json";

// ENV-02 stage 2: the test level `env-02`, two rooms joined by one door that
// only a button opens. The level is loaded and built the way the arena page
// loads it, so the door the test opens is the door the page's darts meet.

const level = envJson as unknown as Level;
const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};
const T = buttonsJson as unknown as { cap: { height: number } };
const DOOR = "env-02-door";

beforeAll(async () => {
  await RAPIER.init();
});

/** The page's wiring, in tests: the buttons open the door through the same
 *  verb the lock-in uses, and the runner sets every door to its file state. */
async function rig() {
  const { rapier, world } = await createPhysics();
  const built = buildLevel(level, rapier, world, FAKE);
  const opened: string[] = [];
  const events: LevelEvents = {
    setDoor(id, state) {
      const door = built.doors.get(id);
      if (!door || door.state === state) return;
      door.setState(state);
    },
    spawn() { return false; }, onLocked() {}, onWaveStart() {}, onCleared() {},
    onArenaStart() {}, onLevelCleared() {},
  };
  const runner = new LevelRunner(level.arenas ?? [], events);
  const buttons = new ButtonSystem(built.buttons, (open) => {
    opened.push(open);
    events.setDoor(open, "open");
  }, world);
  return { world, built, runner, buttons, opened };
}

/** Is the closed door in the way of a walk straight north from the start? */
function blocked(world: RAPIER.World): boolean {
  const hit = world.castRay(new RAPIER.Ray({ x: 0, y: 1, z: 8 }, { x: 0, y: 0, z: -1 }), 20, true);
  return hit !== null && hit.timeOfImpact < 9;
}

describe("the env-02 button test level", () => {
  it("1. loads as a registered level with no errors, two rooms and one door", () => {
    expect(ARENA_LEVELS["env-02"]).toBe(level);
    expect(chosenLevel("?level=env-02").level.meta.id).toBe("env-02");
    const report = validateLevel(level);
    expect(report.errors).toEqual([]);
    const doors = level.arenas!.flatMap((a) => a.doors);
    expect(doors.map((d) => d.id)).toEqual([DOOR]);
    expect(doors[0]!.state).toBe("locked");
    expect(level.buttons!.map((b) => b.action.open)).toEqual([DOOR, DOOR]);
  });

  it("2. the door is shut on the first frame, so the exit cannot be walked to", async () => {
    const r = await rig();
    r.world.step();
    expect(r.built.doors.get(DOOR)!.state).toBe("locked");
    expect(blocked(r.world)).toBe(true);
    // The arena has no waves: one update takes the trigger (it locks, and
    // with noLock it shuts nothing), the next clears it at once, so the exit
    // pad is free to end the level the way env-01's does.
    r.runner.update(1 / 60, { playerPos: [0, 0, 5], aliveCount: 0 });
    r.runner.update(1 / 60, { playerPos: [0, 0, 5], aliveCount: 0 });
    expect(r.runner.state.phase).toBe("complete");
    // Clearing it opens nothing: no unlockOnClear door, no lock, no change.
    expect(r.built.doors.get(DOOR)!.state).toBe("locked");
    expect(blocked(r.world)).toBe(true);
  });

  it("3. the wall button beside the door opens it, and then the way is clear", async () => {
    const r = await rig();
    r.world.step();
    const cap = r.built.buttons.find((b) => b.id === "door-button")!;
    // Eye height in front of the wall button, facing it.
    const eye = new THREE.Vector3(cap.up.x, 1.6, cap.up.z + 1.2);
    const fwd = new THREE.Vector3(0, 0, -1);
    const pressed = r.buttons.pressNear(eye, fwd, 2, 90);
    expect(pressed?.id).toBe("door-button");
    expect(r.opened).toEqual([DOOR]);
    r.world.step();
    expect(r.built.doors.get(DOOR)!.state).toBe("open");
    expect(blocked(r.world)).toBe(false);
    // A second press only clicks.
    expect(r.buttons.pressNear(eye, fwd, 2, 90)?.opened).toBe(false);
    expect(r.opened).toEqual([DOOR]);
  });

  it("3b. a swing on the far side of the wall does not press it", async () => {
    // Review: the swing's press was a reach and angle test only, and the
    // divider is 1 m thick against a 2.2 m reach, so a swing from the north
    // room pressed the button on the south face through the wall.
    const r = await rig();
    r.world.step();
    const cap = r.built.buttons.find((b) => b.id === "door-button")!;
    const eye = new THREE.Vector3(cap.up.x, 1.6, -1.3);
    const fwd = cap.up.clone().sub(eye).normalize();
    expect(eye.distanceTo(cap.up)).toBeLessThan(2.2);
    expect(r.buttons.pressNear(eye, fwd, 2.2, 70)).toBeNull();
    expect(r.opened).toEqual([]);
  });

  it("4. the floor button across the room opens the same door by a step", async () => {
    const r = await rig();
    r.world.step();
    const cap = r.built.buttons.find((b) => b.id === "floor-button")!;
    const feet = new THREE.Vector3(cap.up.x, cap.up.y + T.cap.height / 2, cap.up.z);
    // A step beside it does nothing.
    expect(r.buttons.step(new THREE.Vector3(feet.x + 1, feet.y, feet.z))).toBeNull();
    expect(r.opened).toEqual([]);
    expect(r.buttons.step(feet)?.id).toBe("floor-button");
    expect(r.opened).toEqual([DOOR]);
  });

  it("5. the level is a walk from the start, through the door, to the exit", async () => {
    const r = await rig();
    r.built.doors.get(DOOR)!.setState("open");
    r.world.step();
    // Floor under the start and under the exit pad.
    const floorAt = (x: number, z: number) => r.world.castRay(
      new RAPIER.Ray({ x, y: 4, z }, { x: 0, y: -1, z: 0 }), 6, true,
    );
    expect(floorAt(level.playerStart.pos[0], level.playerStart.pos[2])).toBeTruthy();
    expect(floorAt(level.exit.pos[0], level.exit.pos[2])).toBeTruthy();
    // The doorway itself is 3 m of clear air above the floor, 2 m wide.
    expect(r.world.castRay(
      new RAPIER.Ray({ x: 0, y: 1, z: 3 }, { x: 0, y: 0, z: -1 }), 6, true,
    )).toBeNull();
  });
});
