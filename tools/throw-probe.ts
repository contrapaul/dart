// ANIM-01 scratch probe: where the F02's ball sits for given arm angles
// (facing +z; ball's xyz relative to the feet, dist to the right shoulder).
// @ts-nocheck
import * as THREE from "three";
import rigData from "../data/foamer-rigs.json";
import { restMotion, solvePose, type RigSpec } from "../src/foamers/rig";

const rig = rigData.rigs.find((r) => r.id === "F02") as RigSpec;

function pointOf(id: string, m: Map<string, THREE.Matrix4>): THREE.Vector3 {
  const p = rig.parts.find((q) => q.id === id)!;
  const pv = p.pivot ?? [0, 1, 0];
  const v = new THREE.Vector3((pv[0] + 1) / 2 * p.size[0], (pv[1] + 1) / 2 * p.size[1], (pv[2] + 1) / 2 * p.size[2]).multiplyScalar(rig.voxelSize);
  return v.applyMatrix4(m.get(id)!);
}

function probe(armR: number, foreArmR: number) {
  const D = Math.PI / 180;
  const m = restMotion();
  m.rot.set("armR", [armR * D, 0, 0]);
  m.rot.set("foreArmR", [foreArmR * D, 0, 0]);
  const pose = solvePose(rig, new THREE.Vector3(), 0, m, new Map());
  const b = pointOf("ball", pose);
  const sh = pointOf("armR", pose);
  return `armR=${String(armR).padStart(5)} fore=${String(foreArmR).padStart(5)} ball=[${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}] ySh=${sh.y.toFixed(2)} d=${b.distanceTo(sh).toFixed(2)}`;
}

console.log("rest (data says ball low in front):");
console.log(probe(0, 0));
console.log("loaded candidates (ball behind the shoulder line, high):");
for (const t of [[-150, 60], [-160, 80], [-170, 80], [-180, 80], [-180, 100], [-190, 100], [-190, 120], [-200, 120]])
  console.log(probe(t[0], t[1]));
console.log("follow candidates (ball in front, low, past the shoulder):");
for (const t of [[-120, 130], [-100, 150], [-80, 130], [-60, 100], [-40, 90]])
  console.log(probe(t[0], t[1]));
