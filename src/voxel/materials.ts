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
