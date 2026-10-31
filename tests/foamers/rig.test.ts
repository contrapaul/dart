import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { VoxelVolume } from "../../src/voxel/chunk";
import { materialId } from "../../src/voxel/materials";
import { buildPartVolume, restMotion, solvePose, type RigSpec } from "../../src/foamers/rig";
import { MOVEMENT_STYLES, rigMotion } from "../../src/foamers/rig-motion";
import rigData from "../../data/foamer-rigs.json";

const RIGS = rigData.rigs as unknown as RigSpec[];

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
      let prev = rigMotion(rig, 0).motion;
      for (let t = dt; t < 30; t += dt) {
        const m = rigMotion(rig, t).motion;
        const where = `${rig.id} t=${t.toFixed(2)}`;
        expect(Math.abs(m.pitch - prev.pitch), `${where} pitch`).toBeLessThan(0.35);
        expect(Math.abs(m.roll - prev.roll), `${where} roll`).toBeLessThan(0.35);
        for (const p of rig.parts) {
          const a = m.rot.get(p.id) ?? [0, 0, 0], b = prev.rot.get(p.id) ?? [0, 0, 0];
          for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i]), `${where} ${p.id}[${i}]`).toBeLessThan(0.35);
        }
        prev = m;
      }
    }
  });
});
