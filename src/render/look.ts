// R3-06: the global illumination look. Tone mapping and exposure live on the
// renderer; skyLight makes the level's sky throw light at every surface;
// bounce is the hemisphere light's ground colour. Pure data, plus a small
// three.js part for the environment map; tested headless.
import * as THREE from "three";
import type { LevelLighting } from "../level/format";
import renderJson from "../../data/render.json";

export type ToneMappingName = "none" | "aces" | "agx" | "neutral";

export const TONE_MAPPING_NAMES: readonly ToneMappingName[] = ["none", "aces", "agx", "neutral"];

export interface LookOptions {
  toneMapping: ToneMappingName;
  exposure: number;
  skyLight: number;
  bounce: string;
}

export type Gi = NonNullable<LevelLighting["gi"]>;

interface LookData {
  look: LookOptions;
}

/** The data/render.json defaults, used for every field a level omits. */
export function lookDefaults(): LookOptions {
  const look = (renderJson as LookData).look;
  return {
    toneMapping: look.toneMapping,
    exposure: look.exposure,
    skyLight: look.skyLight,
    bounce: look.bounce,
  };
}

/** three.js tone mapping enum for a name. Unknown names fall back to none. */
export function toneMappingFor(name: string): THREE.ToneMapping {
  switch (name) {
    case "aces": return THREE.ACESFilmicToneMapping;
    case "agx": return THREE.AgXToneMapping;
    case "neutral": return THREE.NeutralToneMapping;
    default: return THREE.NoToneMapping;
  }
}

/** The level's look with every field filled in. When the low quality preset
 *  is active, skyLight is forced to 0. */
export function resolveLook(
  gi: Gi | undefined,
  defaults: LookOptions = lookDefaults(),
  skyLightOff = false,
): LookOptions {
  const merged = {
    toneMapping: gi?.toneMapping ?? defaults.toneMapping,
    exposure: gi?.exposure ?? defaults.exposure,
    skyLight: gi?.skyLight ?? defaults.skyLight,
    bounce: gi?.bounce ?? defaults.bounce,
  };
  if (skyLightOff) merged.skyLight = 0;
  return merged;
}

/** Tone mapping and exposure on the renderer this look drives. */
export function applyLookToRenderer(renderer: THREE.WebGLRenderer, look: LookOptions) {
  renderer.toneMapping = toneMappingFor(look.toneMapping);
  renderer.toneMappingExposure = look.exposure;
}

/** A hex colour, the format colour pickers produce. */
export function isColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** A gradient sky as a big inside-out sphere with three stops. Mirrors the
 *  editor view's sky, standalone, so the environment map needs no DOM. */
function gradientMesh(sky: Extract<import("../level/format").Sky, { kind: "gradient" }>): THREE.Mesh {
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const pos = geo.getAttribute("position");
  const colours = new Float32Array(pos.count * 3);
  const top = new THREE.Color(sky.top);
  const horizon = new THREE.Color(sky.horizon);
  const bottom = new THREE.Color(sky.bottom);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 50;
    if (h >= 0) c.copy(horizon).lerp(top, Math.min(1, h));
    else c.copy(horizon).lerp(bottom, Math.min(1, -h));
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  mesh.frustumCulled = false;
  return mesh;
}

// PMREM textures are kept for the page's lifetime; the map is tiny (one
// texture per sky, which is rare), and a brush stroke calls show() a lot.
const envCache = new Map<string, THREE.Texture>();

function cacheKey(sky: import("../level/format").Sky): string {
  return sky.kind === "gradient" ? `g|${sky.top}|${sky.horizon}|${sky.bottom}` : `i|${sky.image.length}|${sky.image.slice(0, 64)}`;
}

/** The level's sky as an environment map, at `look.skyLight`. Sets
 *  scene.environment and scene.environmentIntensity. With no sky, or
 *  skyLight 0, the scene is left with no environment (the arena's hemisphere
 *  light is the only fill). */
export function applyLookEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  sky: import("../level/format").Sky | undefined,
  look: LookOptions,
) {
  if (look.skyLight <= 0 || !sky) {
    scene.environment = null;
    scene.environmentIntensity = 1;
    return;
  }
  if (sky.kind === "gradient") {
    const key = cacheKey(sky);
    let tex = envCache.get(key);
    if (!tex) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const temp = new THREE.Scene();
      temp.add(gradientMesh(sky));
      tex = pmrem.fromScene(temp, 0.04).texture;
      pmrem.dispose();
      envCache.set(key, tex);
    }
    scene.environment = tex;
  } else {
    // An image sky decodes asynchronously; with no DOM (headless tests)
    // there is nothing to decode.
    if (typeof document === "undefined") {
      scene.environment = null;
      scene.environmentIntensity = 1;
      return;
    }
    const key = cacheKey(sky);
    let tex = envCache.get(key);
    if (!tex) {
      new THREE.TextureLoader().load(sky.image, (image) => {
        image.mapping = THREE.EquirectangularReflectionMapping;
        image.colorSpace = THREE.SRGBColorSpace;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const rt = pmrem.fromEquirectangular(image);
        pmrem.dispose();
        image.dispose();
        tex = rt.texture;
        envCache.set(key, tex!);
        scene.environment = tex!;
        scene.environmentIntensity = look.skyLight;
      });
      scene.environment = null;
      scene.environmentIntensity = 1;
      return;
    }
    scene.environment = tex;
  }
  scene.environmentIntensity = look.skyLight;
}
