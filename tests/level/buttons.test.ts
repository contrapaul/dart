import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildLevel } from "../../src/level/build";
import { ButtonSystem, type PressEvent } from "../../src/level/buttons";
import { validateLevel } from "../../src/level/validate";
import type { Level } from "../../src/level/format";
import { DartSystem } from "../../src/weapons/darts";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import meleeJson from "../../data/melee.json";
import buttonsJson from "../../data/buttons.json";

// ENV-02 stage 1 (E08): the toy button. A dart on the cap presses it, a melee
// swing within reach presses it, a step on a floor one presses it, the action
// runs once, a second press changes nothing, and a level with no buttons
// loads as before. Built through `buildLevel`, which is the builder the arena
// page uses, so the collider a dart meets here is the one it meets in play.

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};
const DT = 1 / 60;
const T = buttonsJson as unknown as {
  plate: { size: [number, number, number] };
  cap: { height: number; pressDepth: number; diameter: number };
};
/** Reach and arc the page hands from data/melee.json (ENV-02 wiring). */
const REACH = (meleeJson as unknown as { reach: number }).reach;
const ARC = (meleeJson as unknown as { arcDeg: number }).arcDeg;

/** The room the buttons are tested in: 10 x 3 x 10, one arena with one
 *  locked door, so the action has a real door to open. */
function room(withButtons: boolean): Level {
  return {
    meta: { id: "env-02-test", name: "test", act: 1, targetSeconds: 30, accent: "#fff" },
    shell: [
      { id: "floor", shape: "box", pos: [0, -0.5, 0], size: [12, 1, 12], material: "greybox-dark" },
      { id: "ceiling", shape: "box", pos: [0, 3.5, 0], size: [12, 1, 12], material: "greybox" },
      { id: "wall-w", shape: "box", pos: [-5.5, 1.5, 0], size: [1, 3, 12], material: "greybox" },
      { id: "wall-e", shape: "box", pos: [5.5, 1.5, 0], size: [1, 3, 12], material: "greybox" },
      { id: "wall-n", shape: "box", pos: [0, 1.5, -5.5], size: [10, 3, 1], material: "greybox" },
      { id: "wall-s", shape: "box", pos: [0, 1.5, 5.5], size: [10, 3, 1], material: "greybox" },
    ],
    arenas: [
      {
        id: "a1", archetype: "A1",
        trigger: { pos: [0, 1, 3], size: [2, 2, 2] },
        doors: [{ id: "d1", state: "locked", pos: [0, 1.5, -5.5], size: [2, 3, 0.6] }],
        rifts: [], waves: [], unlockOnClear: [],
      },
    ],
    buttons: withButtons
      ? [
        // A wall button on the north wall, facing into the room (+z).
        { id: "wall-btn", pos: [0, 1.5, -4.94], facing: [0, 0, 1], action: { open: "d1" } },
        // A floor button in the middle of the room.
        { id: "floor-btn", pos: [1.5, T.plate.size[1] / 2, 1], facing: [0, 1, 0], action: { open: "d1" } },
      ]
      : undefined,
    playerStart: { pos: [0, 0, 3], yaw: 0 },
    exit: { pos: [4, 0.5, 4], size: [1, 1, 1] },
  };
}

beforeAll(async () => {
  await RAPIER.init();
});

/** The page's wiring, in tests: build the level, then hand the buttons the
 *  same door verb the lock-in uses. Counts the actions that ran. */
async function rig(withButtons = true) {
  const rapier = RAPIER;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const level = room(withButtons);
  const built = buildLevel(level, rapier, world, FAKE);
  const opened: string[] = [];
  const presses: PressEvent[] = [];
  const buttons = new ButtonSystem(built.buttons, (open) => {
    opened.push(open);
    built.doors.get(open)?.setState("open");
  });
  return { rapier, world, level, built, buttons, opened, presses };
}

/** The cap's centre in world space, from the built handle. */
function capCentre(rigged: Awaited<ReturnType<typeof rig>>, id: string): THREE.Vector3 {
  return rigged.built.buttons.find((b) => b.id === id)!.up.clone();
}

/** Fires one dart at `target` from 3 m back along +z, and runs it in. */
function fireAt(rigged: Awaited<ReturnType<typeof rig>>, target: THREE.Vector3) {
  const ignore = rigged.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3));
  const darts = new DartSystem(new THREE.Scene(), rigged.world, RAPIER, ignore);
  const previous = darts.onHit;
  darts.onHit = (hit) => {
    previous(hit);
    const e = rigged.buttons.pressByCollider(hit.collider, hit.point);
    if (e) rigged.presses.push(e);
  };
  rigged.world.step();
  darts.fire(target.clone().setZ(target.z + 3), new THREE.Vector3(0, 0, -1), "standard");
  for (let i = 0; i < 60; i++) {
    darts.update(DT);
    rigged.world.step();
  }
  return darts;
}

describe("the toy button", () => {
  it("a level with buttons validates and builds one handle per button", async () => {
    const r = await rig();
    expect(validateLevel(r.level).errors).toEqual([]);
    expect(r.built.buttons.map((b) => b.id)).toEqual(["wall-btn", "floor-btn"]);
    expect(r.buttons.count).toBe(2);
  });

  it("a dart on the cap presses the button and opens the door once", async () => {
    const r = await rig();
    const cap = capCentre(r, "wall-btn");
    fireAt(r, cap);
    expect(r.buttons.isPressed("wall-btn")).toBe(true);
    expect(r.presses.map((p) => p.id)).toEqual(["wall-btn"]);
    expect(r.presses[0]!.opened).toBe(true);
    expect(r.opened).toEqual(["d1"]);
    expect(r.built.doors.get("d1")!.state).toBe("open");
  });

  it("a second press only clicks: the action does not run again", async () => {
    const r = await rig();
    const cap = capCentre(r, "wall-btn");
    const collider = r.built.buttons.find((b) => b.id === "wall-btn")!.collider;
    r.buttons.pressByCollider(collider, cap);
    r.buttons.pressByCollider(collider, cap);
    expect(r.opened).toEqual(["d1"]);
    const second = r.buttons.pressByCollider(collider, cap);
    expect(second!.opened).toBe(false);
    expect(r.built.doors.get("d1")!.state).toBe("open");
    expect(second).not.toBeNull(); // the page still has a click to play
  });

  it("a melee swing in reach presses it, and one out of reach does not", async () => {
    const r = await rig();
    const cap = capCentre(r, "wall-btn");
    const forward = new THREE.Vector3(0, 0, -1);
    // 1.6 m back from the cap: inside the swing's reach.
    const near = cap.clone().setZ(cap.z + 1.6);
    expect(r.buttons.pressNear(near, forward, REACH, ARC)).not.toBeNull();
    // The same swing turned away from the button is a miss.
    const r2 = await rig();
    expect(r2.buttons.pressNear(near, new THREE.Vector3(0, 0, 1), REACH, ARC)).toBeNull();
    // 3 m back: outside the swing's reach.
    const r3 = await rig();
    expect(r3.buttons.pressNear(cap.clone().setZ(cap.z + 3), forward, REACH, ARC)).toBeNull();
    expect(r3.opened).toEqual([]);
  });

  it("the first press squashes the cap into the plate and lights it", async () => {
    const r = await rig();
    const handle = r.built.buttons.find((b) => b.id === "wall-btn")!;
    const restY = handle.cap.position.y;
    expect(handle.cap.scale.y).toBe(1);
    r.buttons.pressNear(capCentre(r, "wall-btn").setZ(capCentre(r, "wall-btn").z + 1.5),
      new THREE.Vector3(0, 0, -1), REACH, ARC);
    expect(handle.cap.scale.y).toBeCloseTo(1 - T.cap.pressDepth / T.cap.height, 6);
    // The cap sinks by half the press depth along its facing (+z here).
    expect(handle.cap.position.z).toBeCloseTo(handle.up.z - T.cap.pressDepth / 2, 6);
    expect(restY).toBe(handle.up.y);
  });

  it("a step on a floor button presses it, and a step beside it does not", async () => {
    const r = await rig();
    const cap = capCentre(r, "floor-btn");
    expect(r.buttons.step(new THREE.Vector3(cap.x + 1.5, cap.y, cap.z))).toBeNull();
    const e = r.buttons.step(new THREE.Vector3(cap.x, cap.y + T.cap.height / 2, cap.z));
    expect(e?.id).toBe("floor-btn");
    expect(r.opened).toEqual(["d1"]);
  });

  it("a wall button is never pressed by walking past it", async () => {
    const r = await rig();
    const cap = capCentre(r, "wall-btn");
    // Feet at the wall button's own height, standing in its footprint.
    expect(r.buttons.step(new THREE.Vector3(cap.x, cap.y, cap.z))).toBeNull();
    expect(r.opened).toEqual([]);
  });

  it("a level with no buttons loads as before", async () => {
    const r = await rig(false);
    expect(validateLevel(r.level).errors).toEqual([]);
    expect(r.built.buttons).toEqual([]);
    expect(r.buttons.count).toBe(0);
    expect(r.buttons.step(new THREE.Vector3(0, 0, 0))).toBeNull();
    expect(r.built.doors.get("d1")!.state).toBe("locked");
  });

  it("a retry resets a pressed button, so it can open the re-locked door", async () => {
    const r = await rig();
    const collider = r.built.buttons.find((b) => b.id === "wall-btn")!.collider;
    r.buttons.pressByCollider(collider);
    expect(r.buttons.isPressed("wall-btn")).toBe(true);
    r.built.doors.get("d1")!.setState("locked");
    r.buttons.reset();
    expect(r.buttons.isPressed("wall-btn")).toBe(false);
    expect(r.opened).toEqual(["d1"]);
    r.buttons.pressByCollider(collider);
    expect(r.opened).toEqual(["d1", "d1"]);
  });

  it("a button naming a door that does not exist is a validation error", async () => {
    const level = room(true);
    level.buttons![0]!.action.open = "nope";
    expect(validateLevel(level).errors.some((e) => e.includes("unknown door nope"))).toBe(true);
  });
});
