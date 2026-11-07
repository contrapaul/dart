// GAME-10m scratch check: F12's look, measured from the solved rest pose
// (no browser here, the way tools/pose-check.ts measures other rigs). It
// checks the three things the build's rig check must say: both feet are the
// lowest part of the rig (on the ground), the spines sit on the back (the
// body's -z side) and small, and the eyes are painted on the head's front
// (+z) face, one on either side of the middle.
// @ts-nocheck
import * as THREE from "three";
import rigData from "../data/foamer-rigs.json";
import { buildPartVolume, restMotion, solvePose, type RigSpec } from "../src/foamers/rig";
import { materialId } from "../src/voxel/materials";
import { VoxelVolume } from "../src/voxel/chunk";

const RIG = (rigData.rigs as unknown as RigSpec[]).find((r) => r.id === "F12")!;
if (!RIG) throw new Error("no F12 rig in data/foamer-rigs.json");
const vs = RIG.voxelSize;
const v = new THREE.Vector3();
const pose = solvePose(RIG, new THREE.Vector3(), 0, restMotion(), new Map());

/** World-space min/max of a part, from the solved pose. */
function box(id: string): { x0: number, x1: number, y0: number, y1: number, z0: number, z1: number } {
  const p = RIG.parts.find((x) => x.id === id)!;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
    v.set(cx * p.size[0], cy * p.size[1], cz * p.size[2]).multiplyScalar(vs).applyMatrix4(pose.get(p.id)!);
    x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); z0 = Math.min(z0, v.z);
    x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); z1 = Math.max(z1, v.z);
  }
  return { x0, x1, y0, y1, z0, z1 };
}

const boxes = new Map(RIG.parts.map((p) => [p.id, box(p.id)]));
const top = Math.max(...[...boxes.values()].map((b) => b.y1));
const ground = Math.min(...[...boxes.values()].map((b) => b.y0));

// Feet: both must be the lowest part (within a voxel of the ground).
const feet = ["footL", "footR"].map((id) => boxes.get(id)!);
// Spines: on the back, i.e. their whole box ahead of the body's back face,
// and small.
const body = boxes.get("body")!;
const spines = ["spine1", "spine2", "spine3"].map((id) => boxes.get(id)!);
// Eyes: paint the head's volume and find the eye voxels (foam-white or
// foam-ink, the painted pair plus the grin), the way the build paints them.
const head = RIG.parts.find((p) => p.id === "head")!;
const vol = new VoxelVolume(vs);
buildPartVolume(vol, head, RIG.material);
const white = materialId("foam-white"), ink = materialId("foam-ink");
let eyeCount = 0; let minX = 99, maxX = -99; let onFace = 0;
for (let y = 0; y < head.size[1]; y++) for (let x = 0; x < head.size[0]; x++) for (let z = 0; z < head.size[2]; z++) {
  const m = vol.get(x, y, z);
  if (m !== white && m !== ink) continue;
  eyeCount++;
  minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  // The build paints face detail only on the skin of the +z face: nothing
  // may sit in front of a painted voxel.
  if (z + 1 < head.size[2] && vol.get(x, y, z + 1) !== 0) continue;
  onFace++;
}

let fails = 0;
const check = (name: string, pass: boolean, detail: string) => {
  if (!pass) fails += 1;
  console.log(`${pass ? "pass" : "FAIL"}  ${name}  (${detail})`);
};

check("taller than the player", top > 1.8, `rig ${top.toFixed(2)} m, player 1.8 m`);
for (const id of ["footL", "footR"])
  check(`both feet on the ground: ${id}`, boxes.get(id)!.y0 - ground < vs, `foot bottom ${boxes.get(id)!.y0.toFixed(2)}, ground ${ground.toFixed(2)}`);
for (const id of ["spine1", "spine2", "spine3"]) {
  const s = boxes.get(id)!;
  const mid = (s.z0 + s.z1) / 2;
  const onBack = mid < 0 && mid <= body.z0 + vs * 0.5; // mid at or behind the body's back face (-z)
  check(`spine on the back: ${id}`, onBack, `mid z ${mid.toFixed(2)}, body back face ${body.z0.toFixed(2)}`);
}
check("spines kept small", spines.every((s) => s.y1 - s.y0 < vs * 6), `each spine under ${vs * 6} m tall`);
check("eyes painted", eyeCount > 0, `${eyeCount} face voxels`);
check("eyes face forward", eyeCount > 0 && onFace === eyeCount, `${onFace}/${eyeCount} on the +z face skin`);
check("eyes straddle the middle", eyeCount > 0 && minX < head.size[0] / 2 && maxX > head.size[0] / 2, `x ${minX}..${maxX} of ${head.size[0]}`);

console.log(fails === 0 ? "all checks pass" : `${fails} check(s) failed`);
process.exit(fails === 0 ? 0 : 1);
