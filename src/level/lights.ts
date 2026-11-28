import * as THREE from "three";
import type { Level, LevelLight, LevelLighting } from "./format";
import type { QualityPreset } from "../render/quality";
import editorData from "../../data/editor.json";

// ED-32: the level's lights. A point light shines every way; a spot light
// shines down its own -Y, turned by `rot` (degrees, XYZ). Level lighting
// (ambient and sun) replaces the arena's defaults; the rest are built on top
// of the scene the page already drew. No DOM and no Three.js in the data
// part, so it is tested headless.

const DEG = Math.PI / 180;
const MAX_SHADOWS = editorData.lights.maxShadows;
const REFERENCE_RANGE = editorData.lights.referenceRange;

export interface LightHandle {
  id: string;
  light: THREE.PointLight | THREE.SpotLight;
  setVisible(on: boolean): void;
}

export interface BuiltLights {
  handles: Map<string, LightHandle>;
  dispose(): void;
}

/** The direction a spot aims: its own -Y, turned by the rot triple. */
export function targetDirection(rot: [number, number, number] | undefined): THREE.Vector3 {
  const r = rot ?? [0, 0, 0];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"));
  return new THREE.Vector3(0, -1, 0).applyQuaternion(q);
}

/** The arena's ambient (hemisphere) and sun (directional) lights, found by
 *  type: createRenderer adds exactly one of each and does not name them. */
export function sceneLights(scene: THREE.Scene): { ambient: THREE.HemisphereLight | null; sun: THREE.DirectionalLight | null } {
  let ambient: THREE.HemisphereLight | null = null;
  let sun: THREE.DirectionalLight | null = null;
  for (const child of scene.children) {
    if (child instanceof THREE.HemisphereLight) ambient = child;
    else if (child instanceof THREE.DirectionalLight) sun = child;
  }
  return { ambient, sun };
}

/** Applies a level's lighting to the scene's own ambient and sun. The sun's
 *  direction comes from sunYaw (degrees about Y) and sunPitch (degrees
 *  down from level); the sun sits at dir * 20 and shines at the origin. */
export function applyLighting(scene: THREE.Scene, lighting: LevelLighting | undefined) {
  if (!lighting) return;
  const { ambient, sun } = sceneLights(scene);
  if (ambient) {
    ambient.color = new THREE.Color(lighting.ambient);
    ambient.intensity = lighting.ambientIntensity;
  }
  if (sun) {
    sun.color = new THREE.Color(lighting.sun);
    sun.intensity = lighting.sunIntensity;
    const yaw = lighting.sunYaw * DEG;
    const pitch = lighting.sunPitch * DEG;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    sun.position.copy(dir.multiplyScalar(20));
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }
}

/**
 * The light's real output (candela) for its level-file intensity and range.
 * With physical falloff (1 over distance squared) the range alone only
 * moves the cut-off, so a light's spread hardly changed with it (Paul,
 * 2026-11-28). The output now grows with the range squared, relative to
 * `lights.referenceRange` in data/editor.json: at that range a light is as
 * bright as before, and at twice the range it lights a pool twice as wide
 * at the same brightness.
 */
export function lightOutput(intensity: number, range: number): number {
  const k = range / REFERENCE_RANGE;
  return intensity * k * k;
}

/** Builds one light and adds it to the scene. Shadows are only ever on when
 *  the preset allows them and the casters are under the cap. */
function buildOne(def: LevelLight, castShadow: boolean): { id: string; light: THREE.PointLight | THREE.SpotLight; target?: THREE.Object3D } {
  const pos = new THREE.Vector3(...def.pos);
  const colour = new THREE.Color(def.colour);
  if (def.kind === "spot") {
    const spot = new THREE.SpotLight(colour, lightOutput(def.intensity, def.range), def.range, Math.min(89, (def.angle ?? 45) / 2) * DEG, Math.min(1, Math.max(0, def.softness ?? 0.3)), 2);
    spot.position.copy(pos);
    spot.castShadow = castShadow;
    // Half the full angle, since three.js wants the cone's half angle.
    const dir = targetDirection(def.rot);
    spot.target.position.copy(pos).addScaledVector(dir, Math.max(def.range, 1));
    return { id: def.id, light: spot, target: spot.target };
  }
  const point = new THREE.PointLight(colour, lightOutput(def.intensity, def.range), def.range, 2);
  point.position.copy(pos);
  point.castShadow = castShadow;
  return { id: def.id, light: point };
}

/** Builds the level's lights plus the level's overall lighting. Shadows are
 *  capped at data/editor.json `lights.maxShadows`, and none happen on a
 *  preset with shadows off. Returns handles by id with `setVisible`. */
export function buildLights(scene: THREE.Scene, level: Level, quality: QualityPreset): BuiltLights {
  applyLighting(scene, level.lighting);
  const handles = new Map<string, LightHandle>();
  let shadows = 0;
  for (const def of level.lights ?? []) {
    const want = (def.castShadow === true) && quality.shadows && shadows < MAX_SHADOWS;
    if (want) shadows += 1;
    const built = buildOne(def, want);
    built.light.visible = !def.hidden;
    scene.add(built.light);
    if (built.target) scene.add(built.target);
    handles.set(def.id, {
      id: def.id,
      light: built.light,
      setVisible: (on: boolean) => { built.light.visible = on; },
    });
  }
  return {
    handles,
    dispose() {
      for (const [, handle] of handles) {
        scene.remove(handle.light);
        handle.light.dispose();
        const target = (handle.light as THREE.SpotLight).target;
        if (target && (handle.light as THREE.SpotLight).isSpotLight) scene.remove(target);
      }
    },
  };
}
