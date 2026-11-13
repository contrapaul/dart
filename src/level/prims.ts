import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { primColliderParts, primGeometry, primMatrix } from "./prim-geometry";
import { material } from "../voxel/materials";
import type { Level, Prim } from "./format";

// ED-01: the editor's primitives out of the level file and into the scene
// (design/EDITOR.md section 6). A prim that never hides and shares a colour
// with others is merged into one mesh per colour, so a wall of boxes is one
// draw call. Everything else draws on its own: a hidden prim has its own
// mesh and its own colliders (off) so a trigger can show it later.
//
// Solid prims collide. A breakable prim that is voxel foam (an upright box,
// see isVoxelBreakable) is not built here at all: ED-06 empties it into the
// level's voxel volume in build.ts. Every other breakable prim is built
// here (or by a hidden one's own mesh) and breaks by hit points in
// breakables.ts. Decor draws and does not collide. Hazard prims are drawn
// and collided by ED-03, so they are skipped here.

/** What a level page can do to a prim that a trigger names. */
export interface PrimHandle {
  setShown(shown: boolean): void;
}

export function materialFor(colour: string) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.9 });
}

/** ED-06: the foam material (a name in data/materials.json) nearest a prim's
 *  colour. The voxel palette is fixed when the module loads
 *  (src/voxel/materials.ts) because the mesher workers each keep their own
 *  copy of its colour table, so a prim colour registers nothing new: it
 *  becomes the closest foam instead. Say so in HANDOFF.md. */
export function foamMaterialFor(colour: string): string {
  const hex = /^#[0-9a-fA-F]{6}$/.test(colour) ? parseInt(colour.slice(1), 16) : 0xffffff;
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  let best = "foam-white";
  let bestD = Infinity;
  for (let id = 1; id < 256; id++) {
    const m = material(id);
    if (!m || m.indestructible || !m.name.startsWith("foam")) continue;
    const d = (m.color >> 16 & 255) - r, e = (m.color >> 8 & 255) - g, f = (m.color & 255) - b;
    const d2 = d * d + e * e + f * f;
    if (d2 < bestD) {
      bestD = d2;
      best = m.name;
    }
  }
  return best;
}

/** The prim's colliders, placed where its mesh is. A cuboid part keeps its
 *  half extents; a hull part's points are moved into world space. */
export function collidersFor(rapier: Rapier, prim: Prim): RAPIER.ColliderDesc[] {
  const m = primMatrix(prim);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  m.decompose(pos, quat, scale);
  const rot = { x: quat.x, y: quat.y, z: quat.z, w: quat.w };
  const out: RAPIER.ColliderDesc[] = [];
  const v = new THREE.Vector3();
  for (const part of primColliderParts(prim)) {
    if (part.kind === "cuboid") {
      v.set(...part.centre).applyMatrix4(m);
      out.push(rapier.ColliderDesc.cuboid(...part.half).setTranslation(v.x, v.y, v.z).setRotation(rot));
      continue;
    }
    const pts = new Float32Array(part.points.length);
    for (let i = 0; i < part.points.length; i += 3) {
      v.set(part.points[i], part.points[i + 1], part.points[i + 2]).applyMatrix4(m);
      pts[i] = v.x;
      pts[i + 1] = v.y;
      pts[i + 2] = v.z;
    }
    const hull = rapier.ColliderDesc.convexHull(pts);
    // A hull Rapier cannot build falls back to the size box, which is at
    // most a little too big and never too small to stand on.
    out.push(
      (hull ?? rapier.ColliderDesc.cuboid(prim.size[0] / 2, prim.size[1] / 2, prim.size[2] / 2))
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation(rot),
    );
  }
  return out;
}

/** Adds the level's prims to `group`, and the ones that collide to `world`.
 *  Returns a handle for each hidden prim, keyed by prim id. */
export function buildPrims(
  level: Level, rapier: Rapier, world: RAPIER.World, group: THREE.Group,
): Map<string, PrimHandle> {
  const handles = new Map<string, PrimHandle>();
  /** Merged geometry per colour, for the prims that never hide. */
  const merged = new Map<string, THREE.BufferGeometry[]>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  for (const prim of level.prims ?? []) {
    // ED-03 draws hazards; a hazard is see-through and has no collision.
    if (prim.behaviour === "hazard") continue;
    // ED-06: a breakable prim is not built here at all. The voxel kind is
    // filled into the level's volume by build.ts; the hit point kind is a
    // mesh and colliders of its own, built by breakables.ts (a hidden one
    // included, which is the hit point kind too).
    if (prim.behaviour === "breakable") continue;
    // ED-06: breakables never reach here (skipped above), so only solid
    // prims collide now.
    const collides = prim.behaviour === "solid";
    // Box, cylinder and stairs geometry is indexed and the ramp and wedge
    // are not; mergeGeometries refuses a mix, so every part goes in as
    // plain triangles (review fix: a mixed colour group drew nothing).
    let geometry = primGeometry(prim);
    if (geometry.index) {
      const flat = geometry.toNonIndexed();
      geometry.dispose();
      geometry = flat;
    }
    geometry.applyMatrix4(primMatrix(prim));

    if (!prim.hidden) {
      const list = merged.get(prim.colour) ?? [];
      // One attribute set for every merged part, or mergeGeometries refuses.
      for (const name of Object.keys(geometry.attributes)) {
        if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
      }
      list.push(geometry);
      merged.set(prim.colour, list);
      if (collides) {
        for (const desc of collidersFor(rapier, prim)) world.createCollider(desc);
      }
      continue;
    }

    // A hidden prim keeps its own mesh and colliders, both off, so a
    // trigger can show it without rebuilding the level.
    let material = materials.get(prim.colour);
    if (!material) {
      material = materialFor(prim.colour);
      materials.set(prim.colour, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.visible = false;
    group.add(mesh);
    const colliders = collides
      ? collidersFor(rapier, prim).map((d) => world.createCollider(d))
      : [];
    for (const c of colliders) c.setEnabled(false);
    handles.set(prim.id, {
      setShown(shown: boolean) {
        mesh.visible = shown;
        for (const c of colliders) c.setEnabled(shown);
      },
    });
  }

  for (const [colour, parts] of merged) {
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!geometry) continue;
    let material = materials.get(colour);
    if (!material) {
      material = materialFor(colour);
      materials.set(colour, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  return handles;
}
