import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DartSystem } from "../../src/weapons/darts";
import { buildDartGeometry, linear } from "../../src/weapons/dart-model";
import type { DartTypeSpec } from "../../src/weapons/dart-model";
import tuning from "../../data/darts.json";

const DT = 1 / 60;

// PT-06: the look of the dart geometry (a plain cylinder with a rounded tip
// of the same radius, flat back, outward normals, vertex colours on every
// vertex) and the in-flight orientation (a dart turns along its velocity
// every step, so its tip leads near the end of the arc and after a bounce).

function sceneWorld(rapier: typeof RAPIER) {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ignore = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
  return { scene, world, system: new DartSystem(scene, world, rapier, ignore) };
}

const cylinderTypes = (Object.keys(tuning.types) as (keyof typeof tuning.types)[]).filter(
  (t) => tuning.types[t].shape !== "ball",
);
const ballTypes = (Object.keys(tuning.types) as (keyof typeof tuning.types)[]).filter(
  (t) => tuning.types[t].shape === "ball",
);

describe("dart geometry is a cylinder with a rounded tip", () => {
  for (const type of cylinderTypes) {
    const spec = tuning.types[type] as DartTypeSpec;
    it(`${type}: tip at +Z, flat back, outward normals, vertex colours`, () => {
      const geo = buildDartGeometry(spec);
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
      const col = geo.getAttribute("color") as THREE.BufferAttribute;
      const index = geo.getIndex()!;
      expect(nrm.count).toBe(pos.count);
      expect(col.count).toBe(pos.count);
      const body = linear(spec.bodyColor);
      const tip = linear(spec.tipColor);
      const len = spec.length;
      const radius = spec.radius;
      const tipShare = "tipShare" in spec ? spec.tipShare : 0.15;
      const z1 = -len / 2 + len * (1 - tipShare);

      // One point at the tip, z = +len/2, with no radius (the pole).
      let maxZ = -Infinity;
      for (let i = 0; i < pos.count; i++) maxZ = Math.max(maxZ, pos.getZ(i));
      const tipVerts: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getZ(i) - maxZ) < 1e-4) tipVerts.push(i);
      }
      expect(maxZ).toBeCloseTo(len / 2, 4);
      expect(tipVerts.length, "the tip is one point").toBe(1);
      expect(pos.getX(tipVerts[0])).toBeCloseTo(0, 6);
      expect(pos.getY(tipVerts[0])).toBeCloseTo(0, 6);

      // Flat back: every back vertex sits at exactly z = -len/2.
      let minZ = Infinity;
      for (let i = 0; i < pos.count; i++) minZ = Math.min(minZ, pos.getZ(i));
      expect(minZ).toBeCloseTo(-len / 2, 4);
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < minZ + 1e-4) expect(pos.getZ(i)).toBeCloseTo(minZ, 4);
      }

      // Body radius everywhere, tip radius equal to the body's: no bulge.
      for (let i = 0; i < pos.count; i++) {
        const rho = Math.hypot(pos.getX(i), pos.getY(i));
        if (Math.abs(pos.getZ(i) - z1) < 1e-4) {
          expect(rho).toBeLessThanOrEqual(radius * (1 + 0.001));
        }
        expect(rho).toBeLessThanOrEqual(radius * (1 + 0.001) + 1e-6);
      }

      // All normals point outward: each stored normal points away from a
      // point strictly inside the dart (its vertex average is in by the
      // x/y symmetry being zero and z sitting between body and tip).
      const cx = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < pos.count; i++) cx.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      cx.multiplyScalar(1 / pos.count);
      for (let i = 0; i < pos.count; i++) {
        const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(cx);
        const n = new THREE.Vector3(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
        if (p.lengthSq() < 1e-12) continue;
        expect(n.dot(p), `normal ${i} is outward`).toBeGreaterThan(0);
      }

      // A triangle normal checks it too for faces each vertex touches.
      expect(index).not.toBeNull();
      for (let f = 0; f < index.count; f += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(pos, index.getX(f));
        const b = new THREE.Vector3().fromBufferAttribute(pos, index.getX(f + 1));
        const c = new THREE.Vector3().fromBufferAttribute(pos, index.getX(f + 2));
        const nnew = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        const centre = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(cx);
        expect(nnew.dot(centre), `face ${f} winds outward`).toBeGreaterThan(0);
      }

      // Vertex colours: every vertex is exactly the body or the tip colour,
      // the body part is all body, the tip part is all tip.
      for (let i = 0; i < pos.count; i++) {
        const cr = col.getX(i), cg = col.getY(i), cb = col.getZ(i);
        const onBody = cr === body[0] && cg === body[1] && cb === body[2];
        const onTip = cr === tip[0] && cg === tip[1] && cb === tip[2];
        expect(onBody || onTip, `vertex ${i} has a dart colour`).toBe(true);
        const z = pos.getZ(i);
        if (z < z1 - 1e-4) expect(onBody, `body vertex ${i} is the body colour`).toBe(true);
        if (z > z1 + 1e-4) expect(onTip, `tip vertex ${i} is the tip colour`).toBe(true);
      }
    });
  }

  for (const type of ballTypes) {
    it(`${type}: a ball, one colour, outward normals`, () => {
      const spec = tuning.types[type];
      const geo = buildDartGeometry(spec);
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
      const col = geo.getAttribute("color") as THREE.BufferAttribute;
      const body = linear(spec.bodyColor);
      expect(nrm.count).toBe(pos.count);
      expect(col.count).toBe(pos.count);
      const cx = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < pos.count; i++) cx.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      cx.multiplyScalar(1 / pos.count);
      for (let i = 0; i < pos.count; i++) {
        const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        expect(p.length()).toBeCloseTo(spec.radius, 3);
        const n = new THREE.Vector3(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
        expect(n.dot(p.sub(cx))).toBeGreaterThan(0);
        expect(col.getX(i)).toBe(body[0]);
        expect(col.getY(i)).toBe(body[1]);
        expect(col.getZ(i)).toBe(body[2]);
      }
    });
  }
});

/** Read the world pose of the newest dart of `type` from its instance matrix. */
function dartPose(system: DartSystem, type: keyof typeof tuning.types) {
  const mesh = (system as unknown as { meshes: Record<string, THREE.InstancedMesh> }).meshes[type];
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(0, m);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(p, q, s);
  return { pos: p, quat: q };
}

/** The dart's +Z axis (the tip direction) in world space. */
function tipDir(quat: THREE.Quaternion) {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
}

function angleDeg(a: THREE.Vector3, b: THREE.Vector3) {
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("a flying dart turns along its velocity", () => {
  it("a dart fired at 45 degrees up points down near the end of its arc", () => {
    const { world, system } = sceneWorld(RAPIER);
    world.step();
    const start = new THREE.Vector3(0, 2, 0);
    system.fire(start, new THREE.Vector3(0, 1, -1).normalize(), "standard");
    system.syncRender();
    const throwDir = new THREE.Vector3(0, 1, -1).normalize();
    expect(angleDeg(throwDir, tipDir(dartPose(system, "standard").quat))).toBeLessThan(5);
    let seen = false;
    for (let i = 0; i < 420 && !seen; i++) {
      system.update(DT);
      world.step();
      system.syncRender();
      const before = dartPose(system, "standard").pos;
      system.update(DT);
      world.step();
      system.syncRender();
      const after = dartPose(system, "standard").pos;
      const vel = after.sub(before);
      if (vel.y < 0) {
        seen = true;
        const tip = tipDir(dartPose(system, "standard").quat);
        expect(angleDeg(tip, vel.normalize()), "tip leads the flight near the end of the arc")
          .toBeLessThan(10);
        expect(tip.y, "the dart points downward on its way down").toBeLessThan(0);
      }
    }
    expect(seen, "the dart came to the downward half of the arc").toBe(true);
  });

  it("after a bounce off a wall its +Z axis matches its new velocity", () => {
    const { world, system } = sceneWorld(RAPIER);
    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 12, 0.5).setTranslation(0, 4, -5.5));
    world.step();
    const dir = new THREE.Vector3(0.9, 0.35, -0.5).normalize();
    system.fire(new THREE.Vector3(0, 2, 1), dir, "standard");
    system.syncRender();
    let last = dartPose(system, "standard").pos.clone();
    let bounced = false;
    for (let i = 0; i < 300 && !bounced; i++) {
      system.update(DT);
      world.step();
      system.syncRender();
      const cur = dartPose(system, "standard").pos;
      const dv = cur.sub(last);
      // Before the hit the dart flies toward -z; once its z velocity turns
      // positive it has bounced. The x velocity keeps its sign, so the
      // direction alone would not show the flip.
      if (dv.z > 0) {
        // One more step so the dart has turned to the post-bounce velocity.
        system.update(DT);
        world.step();
        system.syncRender();
        const next = dartPose(system, "standard").pos;
        const vel2 = next.sub(cur);
        const tip = tipDir(dartPose(system, "standard").quat);
        expect(angleDeg(tip, vel2.normalize()), "tip along the new velocity after the bounce")
          .toBeLessThan(15);
        bounced = true;
      }
      last.copy(cur);
    }
    expect(bounced, "the dart met the wall and bounced").toBe(true);
  });
});
