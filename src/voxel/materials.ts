import data from "../../data/materials.json";

// The voxel material palette. A voxel stores one byte: 0 is empty, 1 to 255
// index this table. Edit data/materials.json, not this file.

export interface VoxelMaterial {
  id: number;
  name: string;
  /** 0xRRGGBB (sRGB), as written in the JSON. */
  color: number;
  /** How hard it is to carve: damage is divided by this. */
  hardness: number;
  indestructible: boolean;
}

export const EMPTY = 0;

export function buildPalette(entries: typeof data.materials) {
  const byId: (VoxelMaterial | undefined)[] = new Array(256);
  const byName = new Map<string, VoxelMaterial>();
  for (const e of entries) {
    if (!Number.isInteger(e.id) || e.id < 1 || e.id > 255) throw new Error(`material ${e.name}: id ${e.id} must be 1 to 255`);
    if (byId[e.id]) throw new Error(`material ${e.name}: id ${e.id} already used by ${byId[e.id]!.name}`);
    if (byName.has(e.name)) throw new Error(`material name ${e.name} used twice`);
    const m: VoxelMaterial = {
      id: e.id,
      name: e.name,
      color: parseInt(e.color.slice(1), 16),
      hardness: e.hardness,
      indestructible: "indestructible" in e && e.indestructible === true,
    };
    byId[e.id] = m;
    byName.set(e.name, m);
  }
  return { byId, byName };
}

const palette = buildPalette(data.materials);

export function material(id: number): VoxelMaterial | undefined {
  return palette.byId[id];
}

export function materialId(name: string): number {
  const m = palette.byName.get(name);
  if (!m) throw new Error(`unknown voxel material ${name}`);
  return m.id;
}

/** Linear RGB per material id (256 x 3), for vertex colours. Three.js treats
 *  vertex colours as linear, so the sRGB hex values are converted here. */
export function linearColorTable() {
  const table = new Float32Array(256 * 3);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (const m of palette.byId) {
    if (!m) continue;
    table[m.id * 3] = lin(((m.color >> 16) & 255) / 255);
    table[m.id * 3 + 1] = lin(((m.color >> 8) & 255) / 255);
    table[m.id * 3 + 2] = lin((m.color & 255) / 255);
  }
  return table;
}
