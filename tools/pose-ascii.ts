// ANIM-01 scratch: ASCII front and side silhouettes of a pose, so the pose
// can be checked without a browser.
// @ts-nocheck
import * as THREE from "three";
import rigData from "../data/foamer-rigs.json";
import { restMotion, solvePose, type RigMotion, type RigSpec } from "../src/foamers/rig";
import { windupMotion, strikeMotion, scrapeMotion, chargeMotion, wallStunMotion } from "../src/foamers/rig-states";

const rigs = rigData.rigs as unknown as RigSpec[];
const V = new THREE.Vector3();

function ascii(rig: RigSpec, label: string, m: RigMotion, horizontal: "z" | "x") {
  const pose = solvePose(rig, new THREE.Vector3(), 0, m, new Map());
  const W = 26, H = 20;
  const cells = Array.from({ length: H }, () => new Array(W).fill(0));
  for (const p of rig.parts) {
    for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) for (let k = 0; k < 26; k++) {
      V.set(i * p.size[0] / 26, j * p.size[1] / 26, k * p.size[2] / 26).multiplyScalar(rig.voxelSize).applyMatrix4(pose.get(p.id)!);
      const u = horizontal === "z" ? V.z : V.x; // front view looks along -z; side along -x
      const a = V.x, c = horizontal === "z" ? V.x : V.z;
      const iu = Math.min(W - 1, Math.max(0, Math.floor(((c + 1.4) / 3) * W)));
      const iy = Math.min(H - 1, Math.max(0, Math.floor(((2.6 - V.y) / 2.6) * H)));
      cells[iy][iu] = 1;
    }
  }
  console.log(`\n${label} (front, facing +z)      ${label} (side, facing +z to the right)`);
  // build side at the same time by a second pass
  return cells;
}

function both(rig: RigSpec, label: string, fill: (mm: RigMotion) => void) {
  const m = restMotion(); fill(m);
  const pose = solvePose(rig, new THREE.Vector3(), 0, m, new Map());
  const W = 30, H = 18;
  const front = Array.from({ length: H }, () => new Array(W).fill(0));
  const side = Array.from({ length: H }, () => new Array(W).fill(0));
  for (const p of rig.parts)
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) for (let k = 0; k < 20; k++) {
      V.set((i + 0.5) * p.size[0] / 20, (j + 0.5) * p.size[1] / 20, (k + 0.5) * p.size[2] / 20).multiplyScalar(rig.voxelSize).applyMatrix4(pose.get(p.id)!);
      const put = (grid, c) => {
        const iu = Math.min(W - 1, Math.max(0, Math.floor(((c + 1.6) / 3.2) * W)));
        const iy = Math.min(H - 1, Math.max(0, Math.floor(((2.7 - V.y) / 2.7) * H)));
        grid[iy][iu] = 1;
      };
      put(front, V.x);
      put(side, V.z);
    }
  const dump = (g) => g.map((row) => row.map((v) => (v ? "#" : " ")).join("")).join("\n");
  console.log(`\n${label}\nfront: ${rig.id} pitch=${(m.pitch * 180 / Math.PI).toFixed(0)}`);
  console.log(dump(front));
  console.log("side:");
  console.log(dump(side));
}

const F02 = rigs.find((r) => r.id === "F02") as RigSpec;
const F05 = rigs.find((r) => r.id === "F05") as RigSpec;
const m = () => restMotion();

both(F02, "REST", () => {});
both(F02, "WINDUP K1 (ball loaded back)", (mm) => windupMotion(F02, "throw", 1, mm));
both(F02, "STRIKE K.7 (ball whips through)", (mm) => strikeMotion(F02, "throw", 0.7, mm));
both(F02, "STRIKE K1 (follow)", (mm) => strikeMotion(F02, "throw", 1, mm));
both(F05, "TELEGRAPH K.5", (mm) => scrapeMotion(F05, 0.5, mm));
both(F05, "CHARGE", (mm) => chargeMotion(F05, 1, mm));
both(F05, "WALL STUN t=.25", (mm) => wallStunMotion(F05, 0.25, 1.2, mm));
