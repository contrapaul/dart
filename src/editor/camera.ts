import * as THREE from "three";
import editorData from "../../data/editor.json";

// The editor's camera, laid out the way most 3D editors do it, and with the
// cursor left alone (no pointer lock):
//   wheel           zoom toward the point under the cursor
//   middle drag     pan, the point grabbed stays under the cursor
//   right drag      look round; WASD, Q/E fly while it is held, Shift faster
//   Alt + left drag orbit round the point under the cursor
// The numbers are in data/editor.json `camera`. The maths is in plain
// functions so it can be tested without a page.

const CAM = editorData.camera;

/** Moves `pos` toward `target` for a wheel turn of `deltaY` (negative is
 *  in). A notch (100) covers `zoomStep` of the distance, so zooming slows as
 *  the target gets near, and it never goes past `minDistance` from it. */
export function dolly(pos: THREE.Vector3, target: THREE.Vector3, deltaY: number): THREE.Vector3 {
  const d = pos.distanceTo(target);
  const notches = Math.max(-5, Math.min(5, deltaY / 100));
  const next = Math.max(CAM.minDistance, d * Math.pow(1 - CAM.zoomStep, -notches));
  const dir = pos.clone().sub(target).normalize();
  return target.clone().addScaledVector(dir, next);
}

/** World metres per screen pixel at `distance` in front of the camera. */
export function metresPerPixel(fovDeg: number, viewHeight: number, distance: number): number {
  return (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / Math.max(1, viewHeight);
}

/** Turns the camera round `pivot`: yaw about the world up, pitch about the
 *  camera's right. The pitch stops short of straight up or down, so the view
 *  never flips over. Changes `camera` in place. */
export function orbit(camera: THREE.Camera, pivot: THREE.Vector3, yaw: number, pitch: number) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const limit = Math.PI / 2 - 0.05;
  const now = Math.asin(Math.max(-1, Math.min(1, forward.y)));
  const turnPitch = Math.max(-limit, Math.min(limit, now + pitch)) - now;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right, turnPitch));
  camera.position.sub(pivot).applyQuaternion(q).add(pivot);
  camera.quaternion.premultiply(q);
}

type Drag = { kind: "look" | "pan" | "orbit"; x: number; y: number; pivot: THREE.Vector3; distance: number };

export class EditorCamera {
  private drag: Drag | null = null;
  private keys = new Set<string>();

  /** `pickAt` is where a ray from the cursor meets the level, or null. */
  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private pickAt: (ndcX: number, ndcY: number) => THREE.Vector3 | null,
  ) {
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    window.addEventListener("blur", () => this.stop());
    canvas.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
  }

  /** True while the right button is held (the keys then fly, not edit). */
  get looking(): boolean {
    return this.drag?.kind === "look";
  }

  /** True while any camera drag is going on, so a click is not a pick. */
  get busy(): boolean {
    return this.drag !== null;
  }

  keyDown(code: string) {
    this.keys.add(code);
  }

  keyUp(code: string) {
    this.keys.delete(code);
  }

  /** Flies while the right button is held. */
  update(dt: number) {
    if (!this.looking) return;
    const k = this.keys;
    const speed = (k.has("ShiftLeft") || k.has("ShiftRight") ? CAM.fastSpeed : CAM.flySpeed) * dt;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    if (k.has("KeyW")) move.add(forward);
    if (k.has("KeyS")) move.sub(forward);
    if (k.has("KeyD")) move.add(right);
    if (k.has("KeyA")) move.sub(right);
    if (k.has("KeyE")) move.y += 1;
    if (k.has("KeyQ")) move.y -= 1;
    if (move.lengthSq() > 0) this.camera.position.addScaledVector(move.normalize(), speed);
  }

  private ndc(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  }

  /** The point under the cursor, or one `fallbackDistance` ahead along the
   *  cursor's ray when the ray meets nothing. */
  private target(e: { clientX: number; clientY: number }): THREE.Vector3 {
    const [x, y] = this.ndc(e);
    const hit = this.pickAt(x, y);
    if (hit) return hit;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
    return ray.ray.at(CAM.fallbackDistance, new THREE.Vector3());
  }

  private down(e: PointerEvent) {
    const kind = e.button === 2 ? "look" : e.button === 1 ? "pan" : e.button === 0 && e.altKey ? "orbit" : null;
    if (!kind) return;
    e.preventDefault();
    const pivot = kind === "look" ? this.camera.position.clone() : this.target(e);
    this.drag = { kind, x: e.clientX, y: e.clientY, pivot, distance: this.camera.position.distanceTo(pivot) };
    this.canvas.style.cursor = kind === "pan" ? "grabbing" : kind === "orbit" ? "move" : "";
  }

  private move(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    const cam = this.camera;
    if (d.kind === "look") {
      const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ");
      euler.y -= dx * CAM.lookSpeed;
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x - dy * CAM.lookSpeed));
      cam.quaternion.setFromEuler(euler);
    } else if (d.kind === "pan") {
      const m = metresPerPixel(cam.fov, this.canvas.clientHeight, d.distance);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(right, -dx * m).addScaledVector(up, dy * m);
    } else {
      orbit(cam, d.pivot, -dx * CAM.orbitSpeed, -dy * CAM.orbitSpeed);
    }
  }

  private up(e: PointerEvent) {
    if (!this.drag) return;
    const kind = this.drag.kind;
    if ((kind === "look" && e.button === 2) || (kind === "pan" && e.button === 1) || (kind === "orbit" && e.button === 0)) {
      // The click the browser sends after an orbit drag must not select.
      if (kind === "orbit") this.swallowClick = true;
      this.stop();
    }
  }

  /** Set when an orbit ends, read (and cleared) by the page's click. */
  swallowClick = false;

  private stop() {
    this.drag = null;
    this.keys.clear();
    this.canvas.style.cursor = "";
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    // A line-mode wheel (Firefox) reports lines, not pixels.
    const deltaY = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    this.camera.position.copy(dolly(this.camera.position, this.target(e), deltaY));
  }
}
