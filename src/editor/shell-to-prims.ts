import * as THREE from "three";
import materialData from "../../data/materials.json";
import type { Level, Prim, ShellBox, Vec3 } from "../level/format";
import { ENTRY_KINDS, LIMITS } from "./doc";

// ED-12: a built in level keeps its walls and floors in `shell`, which the
// editor draws and cannot edit. This turns every shell box into a solid prim
// that fills the same space, so the copy can be reworked and still plays the
// same. Pure: the level it is given is not changed.

export interface ShellCopy {
  level: Level;
  warnings: string[];
}

const DEG = Math.PI / 180;
const GREYBOX = "#6f6788";
const COLOURS = new Map(materialData.materials.map((m) => [m.name, m.color]));

/** Four decimals: a tenth of a millimetre, and no long float tails in the file. */
function tidy(n: number): number {
  const r = Math.round(n * 1e4) / 1e4;
  return r === 0 ? 0 : r;
}

/** A shell ramp is a slab turned about x so that its top face rises `rise`
 *  over the box's run (src/level/build.ts `addRamp`). The same slab as a
 *  prim is a turned box, not a prim ramp: a prim ramp is filled underneath,
 *  and the levels use the space under their ramps. */
function rampPrim(box: ShellBox, id: string, colour: string): Prim {
  const [x, y, z] = box.pos;
  const [w, h, d] = box.size;
  const yaw = (box.rotY ?? 0) * DEG;
  const rise = box.rise ?? 0;
  const theta = Math.atan2(rise, d);
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-theta, yaw, 0, "YXZ"));
  const normal = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const mid = new THREE.Vector3(x, y - h / 2 + rise / 2, z).addScaledVector(normal, -h / 2);
  const e = new THREE.Euler().setFromQuaternion(rot, "XYZ");
  return {
    id, shape: "box",
    pos: [tidy(mid.x), tidy(mid.y), tidy(mid.z)],
    size: [w, h, tidy(Math.hypot(d, rise))],
    rot: [tidy(e.x / DEG), tidy(e.y / DEG), tidy(e.z / DEG)],
    colour, behaviour: "solid",
  };
}

/** The level with every shell box as a solid prim and an empty shell. A
 *  level that would pass the prim cap is returned as it is, with a warning. */
export function shellToPrims(level: Level): ShellCopy {
  if (!level.shell.length) return { level, warnings: [] };
  const have = level.prims?.length ?? 0;
  if (have + level.shell.length > LIMITS.prims) {
    return {
      level,
      warnings: [
        `the walls and floors stay as they are and cannot be edited: ${level.shell.length} shell boxes and ${have} prims are over the cap of ${LIMITS.prims}`,
      ],
    };
  }
  const warnings: string[] = [];
  const used = new Set<string>();
  for (const kind of ENTRY_KINDS) {
    for (const entry of (level[kind] ?? []) as { id: string }[]) used.add(entry.id);
  }
  const freeId = (id: string): string => {
    let made = id;
    for (let n = 2; used.has(made); n++) made = `${id}-${n}`;
    used.add(made);
    return made;
  };
  const prims: Prim[] = level.shell.map((box) => {
    const id = freeId(box.id);
    const colour = COLOURS.get(box.material) ?? GREYBOX;
    if (box.shape === "ramp") return rampPrim(box, id, colour);
    // The game builds a shell box unturned whatever its rotY says, so the
    // prim is unturned too.
    if (box.rotY) warnings.push(`shell ${box.id}: its turn of ${box.rotY} degrees is not used by the game, so the copy has it unturned`);
    return { id, shape: "box", pos: [...box.pos] as Vec3, size: [...box.size] as Vec3, colour, behaviour: "solid" };
  });
  return {
    level: { ...level, shell: [], prims: [...(level.prims ?? []), ...prims] },
    warnings,
  };
}
