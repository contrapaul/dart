import * as THREE from "three";
import propData from "../../data/props.json";
import barrelData from "../../data/barrel.json";
import { material, materialId } from "../voxel/materials";
import type { Level, Prim, PrimShape, Prop, Vec3 } from "./format";

// Props: barrels, crates, rubble and tanks. A prop is a short list of parts
// in the editor's own shapes (data/props.json), so the game builds it with
// the prims (merged per colour, a collider per part when it is solid) and
// the editor draws it with the same geometry. The leaking barrel is the
// Range's barrel (src/level/barrels.ts): it runs its own fuse and blast, so
// it is drawn here only for the editor and is never turned into prims.
// No DOM and no physics here, so it is tested headless.

export const LEAKING_BARREL = "barrel-leaking";

export interface PropPart {
  shape: PrimShape;
  pos: Vec3;
  size: Vec3;
  rot?: Vec3;
  colour: string;
}

export interface PropKind {
  label: string;
  group: string;
  solid: boolean;
  parts: PropPart[];
}

const DEG = Math.PI / 180;

function hexOf(name: string): string {
  const colour = material(materialId(name))?.color ?? 0xff7a1a;
  return `#${colour.toString(16).padStart(6, "0")}`;
}

/** The leaking barrel's look, from data/barrel.json: body, band and lid. */
function leakingBarrelParts(): PropPart[] {
  const L = barrelData.look;
  const d = L.diameterMetres;
  const h = L.heightMetres;
  return [
    { shape: "cylinder", pos: [0, h / 2, 0], size: [d, h, d], colour: hexOf(L.bodyMaterial) },
    { shape: "cylinder", pos: [0, h * 0.55, 0], size: [d * 1.03, L.bandHeightMetres, d * 1.03], colour: hexOf(L.bandMaterial) },
    { shape: "cylinder", pos: [0, h + L.lidHeightMetres / 2, 0], size: [d * 0.95, L.lidHeightMetres, d * 0.95], colour: hexOf(L.lidMaterial) },
  ];
}

/** Every prop kind, the leaking barrel first, in the editor's order. */
export const PROP_KINDS: Record<string, PropKind> = {
  [LEAKING_BARREL]: { label: "Leaking barrel (blows up)", group: "Barrels and tanks", solid: true, parts: leakingBarrelParts() },
  ...(propData.kinds as unknown as Record<string, PropKind>),
};

export function isPropKind(kind: string): boolean {
  return Object.hasOwn(PROP_KINDS, kind);
}

/** Whether a prop blocks: its own tick box, else its kind's default. The
 *  leaking barrel always does (its collider is how darts puncture it). */
export function propSolid(prop: Prop): boolean {
  if (prop.kind === LEAKING_BARREL) return true;
  return prop.solid ?? PROP_KINDS[prop.kind]?.solid ?? true;
}

/** The prop's local to world transform: its turn about the vertical, then
 *  its foot position. */
export function propMatrix(prop: Prop, out = new THREE.Matrix4()): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (prop.rotY ?? 0) * DEG);
  return out.compose(new THREE.Vector3(...prop.pos), q, new THREE.Vector3(1, 1, 1));
}

/** The prop's parts as world prims, ids `<prop id>#<n>`: solid or decor by
 *  `propSolid`. Empty for the leaking barrel and for an unknown kind. */
export function propPrims(prop: Prop): Prim[] {
  const kind = PROP_KINDS[prop.kind];
  if (!kind || prop.kind === LEAKING_BARREL) return [];
  const world = propMatrix(prop);
  const behaviour = propSolid(prop) ? "solid" : "decor";
  return kind.parts.map((part, i) => {
    const r = part.rot ?? [0, 0, 0];
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...part.pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ")),
      new THREE.Vector3(1, 1, 1),
    );
    const m = world.clone().multiply(local);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    m.decompose(pos, quat, new THREE.Vector3());
    const e = new THREE.Euler().setFromQuaternion(quat, "XYZ");
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    const prim: Prim = {
      id: `${prop.id}#${i}`,
      shape: part.shape,
      pos: [round(pos.x), round(pos.y), round(pos.z)],
      size: [...part.size] as Vec3,
      rot: [round(e.x / DEG), round(e.y / DEG), round(e.z / DEG)],
      colour: part.colour,
      behaviour,
    };
    return prim;
  });
}

/** Every prop in the level that becomes prims (all but the leaking barrels). */
export function levelPropPrims(level: Level): Prim[] {
  return (level.props ?? []).flatMap(propPrims);
}

/** The level's leaking barrels, as src/level/barrels.ts places them. */
export function leakingBarrels(level: Level): { pos: Vec3 }[] {
  return (level.props ?? []).filter((p) => p.kind === LEAKING_BARREL).map((p) => ({ pos: [...p.pos] as Vec3 }));
}
