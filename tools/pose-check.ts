// ANIM-01 scratch check: measure the key-frame poses numerically (there is
// no browser on this machine): the world extents of each part for a pose at
// the origin, facing +z.
// @ts-nocheck
import * as THREE from "three";
import rigData from "../data/foamer-rigs.json";
import { restMotion, solvePose, type RigMotion, type RigSpec } from "../src/foamers/rig";
import { windupMotion, strikeMotion, scrapeMotion, chargeMotion, wallStunMotion } from "../src/foamers/rig-states";

const rigs = rigData.rigs as unknown as RigSpec[];
const V = new THREE.Vector3();

function measure(rig: RigSpec, label: string, fill: (m: RigMotion) => void) {
  const m = restMotion();
  fill(m);
  const pose = solvePose(rig, new THREE.Vector3(), 0, m, new Map());
  const parts = rig.parts.map((p) => {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
      V.set(cx * p.size[0], cy * p.size[1], cz * p.size[2]).multiplyScalar(rig.voxelSize).applyMatrix4(pose.get(p.id)!);
      x0 = Math.min(x0, V.x); y0 = Math.min(y0, V.y); z0 = Math.min(z0, V.z);
      x1 = Math.max(x1, V.x); y1 = Math.max(y1, V.y); z1 = Math.max(z1, V.z);
    }
    return `${p.id}=[${x0.toFixed(2)}..${x1.toFixed(2)}, ${y0.toFixed(2)}..${y1.toFixed(2)}, ${z0.toFixed(2)}..${z1.toFixed(2)}]`;
  }).join(" ");
  console.log(`${label}: pitch=${(m.pitch * 180 / Math.PI).toFixed(1)} roll=${(m.roll * 180 / Math.PI).toFixed(1)} turn=${((m.turn ?? 0) * 180 / Math.PI).toFixed(1)}  ${parts}`);
}

const F02 = rigs.find((r) => r.id === "F02") as RigSpec;
const F05 = rigs.find((r) => r.id === "F05") as RigSpec;

measure(F02, "F02 rest    ", () => {});
measure(F02, "F02 wind k.5", (m) => windupMotion(F02, "throw", 0.5, m));
measure(F02, "F02 wind k1 ", (m) => windupMotion(F02, "throw", 1, m));
measure(F02, "F02 strk k.7", (m) => strikeMotion(F02, "throw", 0.7, m));
measure(F02, "F02 strk k1 ", (m) => strikeMotion(F02, "throw", 1, m));
measure(F05, "F05 rest    ", () => {});
measure(F05, "F05 tele .25", (m) => scrapeMotion(F05, 0.25, m));
measure(F05, "F05 charge  ", (m) => chargeMotion(F05, 1, m));
measure(F05, "F05 wallstun", (m) => wallStunMotion(F05, 0.25, 1.2, m));
