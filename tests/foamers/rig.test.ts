import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { buildPartVolume, restMotion, rigHeight, solvePose, type PartSpec, type RigSpec } from "../../src/foamers/rig";
import { MOVEMENT_STYLES, rigMotion } from "../../src/foamers/rig-motion";
import rigData from "../../data/foamer-rigs.json";
import { encodePng, renderRigViews, renderSheet, VIEW_SIZE, VIEWS } from "../../tools/render-rig";

const RIGS = rigData.rigs as unknown as RigSpec[];
const ORIGINAL_F01_PARTS = [
  { id: "body", kind: "body", parent: null, size: [14, 15, 12] },
  { id: "head", kind: "head", parent: "body", size: [11, 10, 11] },
  { id: "armL", kind: "arm", parent: "body", size: [5, 10, 5] },
  { id: "foreArmL", kind: "arm", parent: "armL", size: [5, 10, 5] },
  { id: "armR", kind: "arm", parent: "body", size: [5, 10, 5] },
  { id: "foreArmR", kind: "arm", parent: "armR", size: [5, 10, 5] },
  { id: "club", kind: "weapon", parent: "foreArmR", size: [8, 15, 8] },
  { id: "legL", kind: "leg", parent: "body", size: [6, 8, 6] },
  { id: "legR", kind: "leg", parent: "body", size: [6, 8, 6] },
] as const;

/** World position of a part's box point (-1..1 per axis) under a pose. */
function boxPoint(rig: RigSpec, id: string, at: [number, number, number], pose: Map<string, THREE.Matrix4>) {
  const p = rig.parts.find((q) => q.id === id)!;
  return new THREE.Vector3(
    ((at[0] + 1) / 2) * p.size[0],
    ((at[1] + 1) / 2) * p.size[1],
    ((at[2] + 1) / 2) * p.size[2],
  )
    .multiplyScalar(rig.voxelSize)
    .applyMatrix4(pose.get(id)!);
}

describe("Foamer rigs", () => {
  it("every rig uses a known movement style, and every part fits one chunk and has voxels", () => {
    for (const rig of RIGS) {
      expect(MOVEMENT_STYLES, rig.id).toContain(rig.movement);
      for (const p of rig.parts) {
        expect(Math.max(...p.size), `${rig.id}.${p.id}`).toBeLessThanOrEqual(32);
        const v = new VoxelVolume(rig.voxelSize);
        buildPartVolume(v, p, rig.material);
        expect([...v.chunks.values()].reduce((n, c) => n + c.count, 0), `${rig.id}.${p.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("each part's pivot sits on its parent's joint, through motion and a turned root", () => {
    for (const rig of RIGS) {
      const motion = rigMotion(rig, 1.3).motion;
      const pose = solvePose(rig, new THREE.Vector3(2, 0, -1), 0.7, motion, new Map());
      for (const p of rig.parts) {
        if (p.parent === null) continue;
        const joint = boxPoint(rig, p.parent, p.at ?? [0, 0, 0], pose);
        const pivot = boxPoint(rig, p.id, p.pivot ?? [0, 1, 0], pose);
        expect(pivot.distanceTo(joint), `${rig.id}.${p.id}`).toBeLessThan(1e-6);
      }
    }
  });

  it("at rest, the lowest point of a grounded rig is on the floor, and a hovering one floats", () => {
    for (const rig of RIGS) {
      const pose = solvePose(rig, new THREE.Vector3(), 0, restMotion(), new Map());
      let low = Infinity;
      for (const p of rig.parts)
        for (const c of [-1, 1]) for (const d of [-1, 1]) for (const e of [-1, 1])
          low = Math.min(low, boxPoint(rig, p.id, [c, d, e], pose).y);
      expect(low, rig.id).toBeCloseTo(rig.hover ?? 0, 6);
    }
  });

  it("left and right parts mirror each other voxel for voxel", () => {
    for (const rig of RIGS)
      for (const p of rig.parts) {
        if (!p.id.endsWith("L") && !/[FB]L$/.test(p.id)) continue;
        const twinId = p.id.replace(/L$/, "R");
        const twin = rig.parts.find((q) => q.id === twinId);
        if (!twin) continue;
        const a = new VoxelVolume(rig.voxelSize), b = new VoxelVolume(rig.voxelSize);
        buildPartVolume(a, p, rig.material);
        buildPartVolume(b, twin, rig.material);
        for (let y = 0; y < p.size[1]; y++)
          for (let z = 0; z < p.size[2]; z++)
            for (let x = 0; x < p.size[0]; x++)
              expect(a.get(x, y, z)).toBe(b.get(p.size[0] - 1 - x, y, z));
      }
  });

  it("heads with eyes get white and ink voxels on the front half, at least 3 voxels of white across", () => {
    const white = materialId("foam-white");
    const ink = materialId("foam-ink");
    for (const rig of RIGS)
      for (const p of rig.parts.filter((q) => q.eyes)) {
        const v = new VoxelVolume(rig.voxelSize);
        buildPartVolume(v, p, rig.material);
        let inkSeen = false;
        const whiteXs = new Set<number>();
        for (let y = 0; y < p.size[1]; y++)
          for (let z = 0; z < p.size[2]; z++)
            for (let x = 0; x < p.size[0]; x++) {
              const m = v.get(x, y, z);
              if (m === white || m === ink) expect(z, `${rig.id}.${p.id}`).toBeGreaterThanOrEqual(p.size[2] / 2 - 0.5);
              if (m === white) whiteXs.add(x);
              if (m === ink) inkSeen = true;
            }
        expect(inkSeen, `${rig.id}.${p.id}`).toBe(true);
        expect(whiteXs.size, `${rig.id}.${p.id}`).toBeGreaterThanOrEqual(6); // two eyes, 3 each
      }
  });

  it("eyeScale enlarges only painted eyes, not the part volume", () => {
    const head = RIGS.find((entry) => entry.id === "F01")!.parts.find((part) => part.id === "head")!;
    const plain = { ...head, eyeScale: 1 };
    const big = { ...head, eyeScale: 1.3 };
    const count = (part: PartSpec, wanted: number) => {
      const volume = new VoxelVolume(0.05);
      buildPartVolume(volume, part, "foam-lime");
      let n = 0;
      for (let y = 0; y < part.size[1]; y++) for (let z = 0; z < part.size[2]; z++) for (let x = 0; x < part.size[0]; x++)
        if (volume.get(x, y, z) && (!wanted || volume.get(x, y, z) === wanted)) n++;
      return n;
    };
    expect(count(big, 0)).toBe(count(plain, 0));
    expect(count(big, materialId("foam-white"))).toBeGreaterThan(count(plain, materialId("foam-white")));
  });

  it("shag changes only surface paint, not the part volume", () => {
    const body = RIGS.find((entry) => entry.id === "F01")!.parts.find((part) => part.id === "body")!;
    const plain = new VoxelVolume(0.05), shag = new VoxelVolume(0.05);
    buildPartVolume(plain, { ...body, shag: false }, "foam-lime");
    buildPartVolume(shag, { ...body, shag: true }, "foam-lime");
    let different = 0;
    for (let y = 0; y < body.size[1]; y++) for (let z = 0; z < body.size[2]; z++) for (let x = 0; x < body.size[0]; x++) {
      expect(Boolean(shag.get(x, y, z))).toBe(Boolean(plain.get(x, y, z)));
      if (shag.get(x, y, z) !== plain.get(x, y, z)) different++;
    }
    expect(different).toBeGreaterThan(0);
  });

  it("F01, F02 and F05 use only the palette trio and foam accents", () => {
    const roles = {
      F01: ["foam-lime", "foam-purple", "foam-orange"],
      F02: ["foam-orange", "foam-purple", "foam-lime"],
      F05: ["foam-purple-deep", "foam-lime", "foam-orange"],
    } as const;
    const allowed = new Set([
      "foam-purple", "foam-purple-light", "foam-purple-deep", "foam-orange", "foam-orange-light", "foam-orange-deep",
      "foam-lime", "foam-lime-light", "foam-lime-deep", "foam-white", "foam-ink", "foam-core",
    ]);
    for (const [id, trio] of Object.entries(roles)) {
      const rig = RIGS.find((entry) => entry.id === id)!;
      const counts = new Map<string, number>();
      for (const part of rig.parts) {
        const volume = new VoxelVolume(rig.voxelSize);
        buildPartVolume(volume, part, rig.material);
        const name = part.material ?? rig.material;
        expect(allowed.has(name), `${id}.${part.id}: ${name}`).toBe(true);
        for (let y = 0; y < part.size[1]; y++) for (let z = 0; z < part.size[2]; z++) for (let x = 0; x < part.size[0]; x++)
          if (volume.get(x, y, z)) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      const total = trio.reduce((sum, name) => sum + (counts.get(name) ?? 0), 0);
      for (const name of trio) expect(counts.get(name), `${id} has ${name}`).toBeGreaterThan(0);
      expect(counts.get(trio[0])! / total, `${id} primary share`).toBeGreaterThan(0.45);
      expect(counts.get(trio[0])! / total, `${id} primary share`).toBeLessThan(0.7);
      expect(counts.get(trio[1])! / total, `${id} secondary share`).toBeGreaterThan(0.2);
      expect(counts.get(trio[1])! / total, `${id} secondary share`).toBeLessThan(0.45);
      expect(counts.get(trio[2])! / total, `${id} third share`).toBeGreaterThan(0.05);
      expect(counts.get(trio[2])! / total, `${id} third share`).toBeLessThan(0.2);
    }
    const body = RIGS.find((entry) => entry.id === "F05")!.parts.find((part) => part.id === "body")!;
    const count = (part: PartSpec) => {
      const volume = new VoxelVolume(0.05);
      buildPartVolume(volume, part, "foam-purple-deep");
      let n = 0;
      for (let y = 0; y < part.size[1]; y++) for (let z = 0; z < part.size[2]; z++) for (let x = 0; x < part.size[0]; x++)
        if (volume.get(x, y, z)) n++;
      return n;
    };
    expect(count(body), "gapeScale opens more of the face").toBeLessThan(count({ ...body, gapeScale: 1 }));
  });

  it("F01 keeps the greybox gameplay contract and original proportions", () => {
    const rig = RIGS.find((entry) => entry.id === "F01")! as RigSpec & { health: number };
    expect(rig.speed).toBe(1.0);
    expect(rig.health).toBe(6);
    expect(rig.parts.map((p) => [p.id, p.kind, p.parent])).toEqual(ORIGINAL_F01_PARTS.map((p) => [p.id, p.kind, p.parent]));
    expect(rigHeight(rig)).toBeGreaterThanOrEqual(1.3 * 0.8);
    expect(rigHeight(rig)).toBeLessThanOrEqual(1.3 * 1.2);
    for (const original of ORIGINAL_F01_PARTS) {
      const part = rig.parts.find((p) => p.id === original.id)!;
      for (let axis = 0; axis < 3; axis++) {
        expect(part.size[axis], `F01.${part.id}[${axis}]`).toBeGreaterThanOrEqual(original.size[axis] * 0.8);
        expect(part.size[axis], `F01.${part.id}[${axis}]`).toBeLessThanOrEqual(original.size[axis] * 1.2);
      }
    }
    expect(rig.parts.find((p) => p.id === "club")?.parent).toBe("foreArmR");
    expect(rig.parts.find((p) => p.id === "head")?.mouth).toBe("grin");
  });

  it("renders F01 to valid deterministic PNGs", () => {
    const rig = RIGS.find((entry) => entry.id === "F01")!;
    const first = renderRigViews(rig);
    const second = renderRigViews(rig);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (const view of VIEWS) {
      const png = encodePng(first[view]);
      expect([...png.subarray(0, 8)]).toEqual(signature);
      const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
      expect(header.getUint32(16)).toBe(VIEW_SIZE);
      expect(header.getUint32(20)).toBe(VIEW_SIZE);
      expect(encodePng(second[view])).toEqual(png);
    }
    const sheet = encodePng(renderSheet(rig, first));
    const header = new DataView(sheet.buffer, sheet.byteOffset, sheet.byteLength);
    expect(header.getUint32(16)).toBe(VIEW_SIZE * 4);
    expect(header.getUint32(20)).toBe(VIEW_SIZE + 58);
    expect(encodePng(renderSheet(rig, second))).toEqual(sheet);
  });

  it("every movement style gives finite poses and ground speeds over a full minute", () => {
    for (const rig of RIGS)
      for (let t = 0; t < 60; t += 0.07) {
        const f = rigMotion(rig, t);
        expect(Number.isFinite(f.ground) && f.ground >= 0, `${rig.id} t=${t}`).toBe(true);
        expect(Number.isFinite(f.motion.y) && f.motion.squash > 0.5, `${rig.id} t=${t}`).toBe(true);
        for (const r of f.motion.rot.values()) expect(r.every(Number.isFinite)).toBe(true);
      }
  });

  it("movement never snaps: no joint or lean jumps more than 0.35 rad between 60 Hz frames", () => {
    const dt = 1 / 60;
    for (const rig of RIGS) {
      // The same frames and limit for every joint, but the worst jump is
      // collected and asserted once per rig. An expect call per joint per
      // frame is about 700k calls over all rigs; under a busy machine the
      // call overhead, not the motion maths, ran the test past its timeout
      // without a single jump being out of bound.
      let worst = 0;
      let at = "";
      let prev = rigMotion(rig, 0).motion;
      for (let t = dt; t < 30; t += dt) {
        const m = rigMotion(rig, t).motion;
        const frame = `${rig.id} t=${t.toFixed(2)}`;
        let d = Math.abs(m.pitch - prev.pitch);
        if (d > worst) { worst = d; at = `${frame} pitch`; }
        d = Math.abs(m.roll - prev.roll);
        if (d > worst) { worst = d; at = `${frame} roll`; }
        for (const p of rig.parts) {
          const a = m.rot.get(p.id) ?? [0, 0, 0], b = prev.rot.get(p.id) ?? [0, 0, 0];
          for (let i = 0; i < 3; i++) {
            d = Math.abs(a[i] - b[i]);
            if (d > worst) { worst = d; at = `${frame} ${p.id}[${i}]`; }
          }
        }
        prev = m;
      }
      expect(worst, `${rig.id}: worst per-frame jump was ${worst.toFixed(4)} rad at ${at}`).toBeLessThan(0.35);
    }
  });
});
