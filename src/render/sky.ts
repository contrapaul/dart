import * as THREE from "three";
import type { Sky } from "../level/format";

type Gradient = Extract<Sky, { kind: "gradient" }>;

// ED-01: the level's sky (design/EDITOR.md section 6). A gradient is a big
// sphere seen from the inside, so it works in a headless test too; an image
// is a 2:1 panorama wrapped round the level as the scene's background. A
// level with no sky leaves the scene exactly as createRenderer made it.

/** Big enough to sit outside any level the nav grid allows. */
const RADIUS = 150;
const SKY_NAME = "level-sky";

const VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
varying vec3 vDir;
void main() {
  // Above the horizon the top colour takes over quickly; below, the ground
  // colour creeps in more slowly, the way a real horizon reads.
  float h = clamp(vDir.y, -1.0, 1.0);
  vec3 c = h >= 0.0
    ? mix(horizon, top, pow(h, 0.55))
    : mix(horizon, bottom, pow(-h, 0.45));
  gl_FragColor = vec4(c, 1.0);
}
`;

function gradientSky(sky: Gradient): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(sky.top) },
      horizon: { value: new THREE.Color(sky.horizon) },
      bottom: { value: new THREE.Color(sky.bottom) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 16), material);
  mesh.name = SKY_NAME;
  // Drawn first, and never part of a shadow.
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/** Takes the sky off the scene: the sphere and its geometry and material,
 *  and an image background's texture. Leaves the scene's own background. */
export function clearSky(scene: THREE.Scene) {
  const old = scene.getObjectByName(SKY_NAME);
  if (old) {
    scene.remove(old);
    const mesh = old as THREE.Mesh;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  if (scene.background instanceof THREE.Texture) scene.background.dispose();
}

/** Puts the level's sky on the scene. Nothing to do when the level has
 *  none: the scene keeps the background createRenderer gave it. */
export function applySky(scene: THREE.Scene, sky: Sky | undefined) {
  clearSky(scene);
  if (!sky) return;
  if (sky.kind === "gradient") {
    scene.add(gradientSky(sky));
    return;
  }
  // An image sky is a data: URL inside the level file, so nothing is
  // fetched; the loader still decodes asynchronously. Without a DOM (the
  // unit tests) there is no image to decode, so the scene is left alone.
  if (typeof document === "undefined") return;
  new THREE.TextureLoader().load(sky.image, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
  });
}
