import * as THREE from "three";

/** A bigger level than the test course needs its fog pushed out and a
 *  shadow box that covers it. The defaults are the test course's, so
 *  index.html renders exactly as before. */
export interface SceneOptions {
  /** Fog near and far, metres. */
  fog?: [number, number];
  /** Half extent of the sun's shadow camera, metres. */
  shadowRadius?: number;
  /** Shadow map size in pixels, a power of two. */
  shadowMap?: number;
}

export function createRenderer(canvas: HTMLCanvasElement, opts: SceneOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1430);
  const fog = opts.fog ?? [20, 60];
  scene.fog = new THREE.Fog(0x1b1430, fog[0], fog[1]);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);

  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x3a2a60, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(6, 12, 4);
  sun.castShadow = true;
  const shadow = opts.shadowMap ?? 1024;
  sun.shadow.mapSize.set(shadow, shadow);
  const r = opts.shadowRadius ?? 12;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -r;
  sun.shadow.camera.right = sun.shadow.camera.top = r;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  return { renderer, scene, camera };
}
