import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import editorData from "../../data/editor.json";
import { builtInCopy } from "../../src/editor/builtin";
import { openCameraSpot } from "../../src/editor/camera";
import { shellToPrims } from "../../src/editor/shell-to-prims";
import { buildLevel } from "../../src/level/build";
import type { Level, Prim } from "../../src/level/format";
import { primMatrix } from "../../src/level/prim-geometry";
import { validateLevel } from "../../src/level/validate";
import { createPhysics } from "../../src/physics/world";
import { materialId } from "../../src/voxel/materials";
import { greedyMesh, type MeshData } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";

// ED-12: a built in level's shell boxes become prims in the editor's copy,
// so they can be edited, and the copy plays the same. Also the camera spot a
// level opens on.

const FILES = import.meta.glob<{ default: unknown }>("../fixtures/levels/*.json", { eager: true });
const LEVELS = Object.entries(FILES).map(([path, module]) => ({
  name: path.split("/").pop()!.replace(/\.json$/, ""),
  level: module.default as Level,
}));
const WITH_SHELL = LEVELS.filter((l) => l.level.shell.length > 0);

const FAKE = {
  mesh(padded: Uint8Array): Promise<MeshData> {
    return Promise.resolve(greedyMesh(padded, linearColorTable()));
  },
};

beforeAll(async () => {
  await RAPIER.init();
});

async function settle(built: ReturnType<typeof buildLevel>) {
  for (let i = 0; i < 200 && built.voxelMesh.busy; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function primOf(level: Level, index: number, original: Level): Prim {
  // The converted prims follow the level's own prims, in shell order.
  return level.prims![(original.prims?.length ?? 0) + index]!;
}

describe("ED-12 shell boxes become prims", () => {
  it("has levels with a shell to try", () => {
    expect(WITH_SHELL.length).toBeGreaterThan(5);
  });

  it.each(LEVELS)("$name: an empty shell, one prim per shell box, and it still validates", ({ level }) => {
    const before = validateLevel(level).errors;
    const { level: made, warnings } = shellToPrims(level);
    expect(warnings).toEqual([]);
    expect(made.shell).toEqual([]);
    expect(made.prims?.length ?? 0).toBe((level.prims?.length ?? 0) + level.shell.length);
    expect(validateLevel(made).errors).toEqual(before);
    const ids = (made.prims ?? []).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(WITH_SHELL)("$name: a box keeps its place, its size and its colour", ({ level }) => {
    const { level: made } = shellToPrims(level);
    level.shell.forEach((box, i) => {
      if (box.shape === "ramp") return;
      const prim = primOf(made, i, level);
      expect(prim.shape).toBe("box");
      expect(prim.behaviour).toBe("solid");
      expect(prim.pos).toEqual(box.pos);
      expect(prim.size).toEqual(box.size);
      expect(prim.rot).toBeUndefined();
      expect(prim.colour).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it.each(WITH_SHELL)("$name: a ramp's walking face starts and ends at the same heights", ({ level }) => {
    const { level: made } = shellToPrims(level);
    level.shell.forEach((box, i) => {
      if (box.shape !== "ramp") return;
      const prim = primOf(made, i, level);
      const matrix = primMatrix(prim);
      const top = (z: number) => new THREE.Vector3(0, prim.size[1] / 2, z).applyMatrix4(matrix);
      const low = top(-prim.size[2] / 2);
      const high = top(prim.size[2] / 2);
      const foot = box.pos[1] - box.size[1] / 2;
      const yaw = ((box.rotY ?? 0) * Math.PI) / 180;
      // The shell ramp rises along its own +z, turned by rotY about the
      // vertical: the low edge is half a run behind the centre.
      const run = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(box.size[2] / 2);
      expect(low.y).toBeCloseTo(foot, 3);
      expect(high.y).toBeCloseTo(foot + (box.rise ?? 0), 3);
      expect(low.x).toBeCloseTo(box.pos[0] - run.x, 3);
      expect(low.z).toBeCloseTo(box.pos[2] - run.z, 3);
      expect(high.x).toBeCloseTo(box.pos[0] + run.x, 3);
      expect(high.z).toBeCloseTo(box.pos[2] + run.z, 3);
      expect(prim.size[0]).toBeCloseTo(box.size[0], 3);
      expect(prim.size[1]).toBeCloseTo(box.size[1], 3);
    });
  });

  it("leaves the level it was given alone", () => {
    const level = WITH_SHELL[0]!.level;
    const before = JSON.stringify(level);
    shellToPrims(level);
    expect(JSON.stringify(level)).toBe(before);
  });

  it("gives a shell box a new id when its own is taken", () => {
    const level = structuredClone(WITH_SHELL[0]!.level);
    const taken = level.shell[0]!.id;
    level.prims = [{ id: taken, shape: "box", pos: [0, 50, 0], size: [1, 1, 1], colour: "#ff7a1a", behaviour: "decor" }];
    const { level: made } = shellToPrims(level);
    const ids = made.prims!.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === taken).length).toBe(1);
  });

  it("does not convert a level that would pass the prim cap, and says so", () => {
    const level = structuredClone(WITH_SHELL[0]!.level);
    const one: Prim = { id: "x", shape: "box", pos: [0, 50, 0], size: [1, 1, 1], colour: "#ff7a1a", behaviour: "decor" };
    level.prims = Array.from({ length: editorData.limits.prims }, (_, i) => ({ ...one, id: `x-${i}` }));
    const { level: made, warnings } = shellToPrims(level);
    expect(made.shell.length).toBe(level.shell.length);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain(String(editorData.limits.prims));
  });

  it("is what a built in level opens as", () => {
    const pit = LEVELS.find((l) => l.name === "1-1-pit")!.level;
    const copy = builtInCopy(pit);
    expect(copy.level.shell).toEqual([]);
    expect(copy.level.prims!.length).toBe(pit.shell.length);
    expect(validateLevel(copy.level).errors).toEqual([]);
  });
});

describe("ED-12 the converted copy plays the same", () => {
  // 1-2 and 1-4 each have a piece anchored to a wall, and all three have
  // ramps with floor under them.
  it.each(["1-1-pit", "1-2", "1-4"])("%s: the same floors, walls and anchors", async (name) => {
    const level = LEVELS.find((l) => l.name === name)!.level;
    const { level: made } = shellToPrims(level);

    const a = await createPhysics();
    const builtA = buildLevel(level, a.rapier, a.world, FAKE);
    await settle(builtA);
    a.world.step();
    const b = await createPhysics();
    const builtB = buildLevel(made, b.rapier, b.world, FAKE);
    await settle(builtB);
    b.world.step();

    expect(builtB.navBounds).toEqual(builtA.navBounds);

    // Rays down and along both axes on a grid: every one must stop at the
    // same distance in both worlds. The grid is offset and its step is odd,
    // so no ray runs exactly along a box's edge, where a hit or a miss is
    // float noise (seen on 1-4's ramps at z = -186).
    const { minX, maxX, minZ, maxZ } = builtA.navBounds;
    const dirs = [{ x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];
    let rays = 0;
    let differ = 0;
    for (let x = minX + 0.37; x <= maxX; x += 1.43) {
      for (let z = minZ + 0.37; z <= maxZ; z += 1.43) {
        for (const y of [40, 1.23, -2.77]) {
          for (const dir of dirs) {
            if (dir.y === 0 && y === 40) continue;
            const ray = new RAPIER.Ray({ x, y, z }, dir);
            const hitA = a.world.castRay(ray, 80, true);
            const hitB = b.world.castRay(ray, 80, true);
            rays++;
            const ta = hitA ? hitA.timeOfImpact : -1;
            const tb = hitB ? hitB.timeOfImpact : -1;
            if (Math.abs(ta - tb) > 2e-3) differ++;
          }
        }
      }
    }
    expect(rays).toBeGreaterThan(500);
    expect(differ).toBe(0);

    // The bedrock a wall anchors a piece by is the same voxels.
    const bed = materialId("bedrock");
    const count = (built: ReturnType<typeof buildLevel>) => {
      let n = 0;
      for (const chunk of built.voxels.chunks.values()) for (const m of chunk.data) if (m === bed) n++;
      return n;
    };
    expect(count(builtB)).toBe(count(builtA));
    if (name !== "1-1-pit") expect(count(builtA)).toBeGreaterThan(0);
  }, 60000);
});

describe("ED-12 the camera a level opens on", () => {
  const CAM = editorData.camera;

  it("sits behind and above the start, looking the way it faces", () => {
    // Yaw 0 faces -z, so behind is +z.
    const spot = openCameraSpot({ pos: [2, 1, 5], yaw: 0 });
    expect(spot.pos[0]).toBeCloseTo(2, 6);
    expect(spot.pos[1]).toBeCloseTo(1 + CAM.openUp, 6);
    expect(spot.pos[2]).toBeCloseTo(5 + CAM.openBack, 6);
    expect(spot.target).toEqual([2, 1, 5]);
  });

  it("turns with the start", () => {
    // A quarter turn left faces -x, so behind is +x.
    const spot = openCameraSpot({ pos: [0, 0, 0], yaw: Math.PI / 2 });
    expect(spot.pos[0]).toBeCloseTo(CAM.openBack, 6);
    expect(spot.pos[2]).toBeCloseTo(0, 6);
  });
});
