import * as THREE from "three";
import { describe, expect, it } from "vitest";
import editorData from "../../data/editor.json";
import { dolly, metresPerPixel, orbit } from "../../src/editor/camera";

// The editor camera's maths: wheel zoom toward the cursor, pan scale and
// orbit. The mouse wiring is checked in the browser.

const CAM = editorData.camera;

describe("editor camera", () => {
  it("a wheel notch in covers zoomStep of the distance to the point", () => {
    const target = new THREE.Vector3(0, 0, 0);
    const next = dolly(new THREE.Vector3(0, 0, 10), target, -100);
    expect(next.z).toBeCloseTo(10 * (1 - CAM.zoomStep), 5);
    expect(next.x).toBe(0);
  });

  it("a notch out undoes a notch in", () => {
    const target = new THREE.Vector3(3, 1, -2);
    const start = new THREE.Vector3(8, 6, 4);
    const back = dolly(dolly(start, target, -100), target, 100);
    expect(back.distanceTo(start)).toBeLessThan(1e-6);
  });

  it("never zooms past the point under the cursor", () => {
    let pos = new THREE.Vector3(0, 0, 2);
    for (let i = 0; i < 50; i++) pos = dolly(pos, new THREE.Vector3(), -500);
    expect(pos.length()).toBeCloseTo(CAM.minDistance, 5);
    expect(pos.z).toBeGreaterThan(0);
  });

  it("pans so the grabbed point keeps up with the cursor", () => {
    // At 10 m with a 90 degree view 200 px high, the view is 20 m tall.
    expect(metresPerPixel(90, 200, 10)).toBeCloseTo(0.1, 6);
  });

  it("orbits at the same distance and keeps the pivot in view", () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 5, 10);
    const pivot = new THREE.Vector3(0, 0, 0);
    cam.lookAt(pivot);
    const before = cam.position.distanceTo(pivot);
    orbit(cam, pivot, 0.7, 0.3);
    expect(cam.position.distanceTo(pivot)).toBeCloseTo(before, 5);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const toPivot = pivot.clone().sub(cam.position).normalize();
    expect(forward.dot(toPivot)).toBeCloseTo(1, 5);
  });

  it("stops short of looking straight down", () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 5, 10);
    cam.lookAt(0, 0, 0);
    orbit(cam, new THREE.Vector3(), 0, -5);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    expect(forward.y).toBeGreaterThan(-1);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    expect(up.y).toBeGreaterThan(0);
  });
});
