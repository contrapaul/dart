import * as THREE from "three";
import tuning from "../../data/darts.json";

// Dart types are data (GAME-09): the list comes from data/darts.json, and a
// name is a string type checked against it (the slug type is added there).
export type DartTypeName = keyof typeof tuning.types;
export type DartTypeSpec = (typeof tuning.types)[DartTypeName];
export const DART_TYPES: DartTypeName[] = Object.keys(tuning.types) as DartTypeName[];

// Builds one dart geometry per type from code. The long axis is +Z with the
// rounded tip at +Z and the origin at the centre, so the dart flies along +Z.
// Body and tip are merged into one geometry with vertex colours.
// PT-06: the shape is a plain cylinder, flat at the back, with a rounded
// foam tip that is tipShare of its length and the same radius as the body.
// Normals are set per face row and all point outward, so no black faces
// from any angle.

const SEGMENTS = 10;

// Linear (sRGB-decoded) colour that a standard three.js pipeline expects in
// vertex colour attributes.
export function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}

export function buildDartGeometry(spec: DartTypeSpec): THREE.BufferGeometry {
  // GAME-09g: the foam ball (B08) is a sphere, not a dart shape.
  // PT-06: the launcher round is a ball too, and takes this path.
  if ("shape" in spec && spec.shape === "ball") {
    const geo = new THREE.SphereGeometry(spec.radius, 14, 10);
    const n = geo.getAttribute("position").count;
    const body = linear(spec.bodyColor);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = body[0];
      colors[i * 3 + 1] = body[1];
      colors[i * 3 + 2] = body[2];
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }
  const len = spec.length;
  const radius = spec.radius;
  const tipShare = "tipShare" in spec ? spec.tipShare : 0.15;
  const tipLen = len * tipShare;
  const bodyLen = len - tipLen;
  const body = linear(spec.bodyColor);
  const tip = linear(spec.tipColor);

  // Local layout: body side from z0 to z1, rounded tip from z1 to zEnd.
  const z0 = -len / 2;
  const z1 = z0 + bodyLen;
  const zEnd = len / 2;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // A row of SEGMENTS+1 vertices at height z (vertex i = SEGMENTS repeats
  // vertex i = 0 so quads wrap around), with a fixed normal z component that
  // the tilt factor spreads across the radial direction.
  const row = (
    z: number, r: number, color: [number, number, number], nz: number,
  ) => {
    const base = positions.length / 3;
    const tilt = Math.sqrt(Math.max(0, 1 - nz * nz));
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      positions.push(Math.cos(a) * r, Math.sin(a) * r, z);
      normals.push(tilt * Math.cos(a), tilt * Math.sin(a), nz);
      colors.push(...color);
    }
    return base;
  };

  // Corners: a and b on the tail ring (angles i, i+1), d and c on the
  // shoulder ring in the same angle order. Both triangles take the a-c
  // diagonal, so both wind the same way: outward (the old order mixed them
  // and showed a streak of black faces, PT-06).
  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };

  // Body: the cylindrical side, two rows of its own vertices so the
  // body-tip colour seam stays sharp.
  const b0 = row(z0, radius, body, 0);
  const b1 = row(z1, radius, body, 0);
  for (let i = 0; i < SEGMENTS; i++) quad(b0 + i, b0 + i + 1, b1 + i + 1, b1 + i);

  // Base cap (flat, facing -Z).
  const capC = positions.length / 3;
  positions.push(0, 0, z0);
  normals.push(0, 0, -1);
  colors.push(...body);
  for (let i = 0; i < SEGMENTS; i++) indices.push(capC, b0 + i + 1, b0 + i);

  // Tip: half an ellipsoid of the body's own radius, from z1 to zEnd.
  // One row at latitude t; its analytic surface
  // normal points radially plus (radius / tipLen) * tan(t) forward. All tip
  // rows are the tip colour, no blend.
  const tipRow = (t: number) => {
    const r = radius * Math.cos(t);
    const z = z1 + tipLen * Math.sin(t);
    const kx = Math.cos(t) / radius; // radial part of the surface normal
    const kz = Math.sin(t) / tipLen; // forward part of the surface normal
    const kn = Math.hypot(kx, kz);
    return row(z, r, tip, kz / kn);
  };

  // Four rings from the equator up, so the tip reads round, not pointed
  // (review: two rings looked like a crayon point).
  let e1 = tipRow(0);
  for (let k = 1; k < 4; k++) {
    const e0 = e1;
    e1 = tipRow((k / 4) * (Math.PI / 2));
    for (let i = 0; i < SEGMENTS; i++) quad(e0 + i, e0 + i + 1, e1 + i + 1, e1 + i);
  }
  // The tip's pole is one vertex; the last ring fans to it.
  const pole = positions.length / 3;
  positions.push(0, 0, zEnd);
  normals.push(0, 0, 1);
  colors.push(tip[0], tip[1], tip[2]);
  for (let i = 0; i < SEGMENTS; i++) indices.push(e1 + i, e1 + i + 1, pole);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
