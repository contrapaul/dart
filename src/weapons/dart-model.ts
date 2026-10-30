import * as THREE from "three";
import type tuning from "../../data/darts.json";

export type DartTypeName = "standard" | "suction";
export type DartTypeSpec = (typeof tuning.types)["standard"];

// Builds one dart geometry per type from code. The long axis is +Z with the
// rounded tip at +Z and the origin at the centre, so the dart flies along +Z.
// Body and tip are merged into one geometry with vertex colours.

const SEGMENTS = 10;
const TIP_FRACTION = 0.22; // tip length as a fraction of the dart length
const TIP_RATIO = 1.25; // tip bulge vs body radius

// Linear (sRGB-decoded) colour that a standard three.js pipeline expects in
// vertex colour attributes.
function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}

export function buildDartGeometry(spec: DartTypeSpec): THREE.BufferGeometry {
  const len = spec.length;
  const radius = spec.radius;
  const tipLen = len * TIP_FRACTION;
  const bodyLen = len - tipLen;
  const body = linear(spec.bodyColor);
  const tip = linear(spec.tipColor);

  // Local layout: body from z0 to z1, rounded tip from z1 to zEnd.
  const z0 = -len / 2;
  const z1 = z0 + bodyLen;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const sideRing = (
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

  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, d, a, d, c);
  };

  // Body: cylindrical side.
  const b0 = sideRing(z0, radius, body, 0);
  const b1 = sideRing(z1, radius, body, 0);
  for (let i = 0; i < SEGMENTS; i++) quad(b0 + i, b0 + i + 1, b1 + i + 1, b1 + i);

  // Base cap (flat, facing -Z).
  const capC = positions.length / 3;
  positions.push(0, 0, z0);
  normals.push(0, 0, -1);
  colors.push(...body);
  for (let i = 0; i < SEGMENTS; i++) indices.push(capC, b0 + i + 1, b0 + i);

  // Tip: half an ellipsoid, wider than the body, from z1 to zEnd. A ring at
  // each latitude, then a pole apex. Colours blend body to tip toward the
  // nose; normals are the ellipsoid surface normals for a rounded look.
  const ax = radius * (TIP_RATIO - 1); // how much the tip bulges past the body
  const lat = [0, Math.PI / 3, Math.PI / 2];
  const mix = (t: number): [number, number, number] => [
    body[0] + (tip[0] - body[0]) * t,
    body[1] + (tip[1] - body[1]) * t,
    body[2] + (tip[2] - body[2]) * t,
  ];
  let prev: number | null = null;
  for (let li = 0; li < lat.length; li++) {
    const t = lat[li];
    const z = z1 + tipLen * Math.sin(t);
    const r = (radius + ax) * Math.cos(t);
    const base = positions.length / 3;
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = (i / SEGMENTS) * Math.PI * 2;
      // Ellipsoid normal: (X/a, Y/b, Z/c) unnormalised. b == r at this
      // latitude, so use the analytic surface normal and normalise.
      const nx = Math.cos(p) * Math.cos(t) / (radius + ax);
      const ny = Math.sin(p) * Math.cos(t) / (radius + ax);
      const nz = Math.sin(t) / tipLen;
      const nl = Math.hypot(nx, ny, nz);
      positions.push(Math.cos(p) * r, Math.sin(p) * r, z);
      normals.push(nx / nl, ny / nl, nz / nl);
      colors.push(...mix(li / (lat.length - 1)));
    }
    if (prev !== null) {
      for (let i = 0; i < SEGMENTS; i++) quad(prev + i, prev + i + 1, base + i + 1, base + i);
    } else {
      // Blend the cap into the body shoulder.
      for (let i = 0; i < SEGMENTS; i++) quad(b1 + i, b1 + i + 1, base + i + 1, base + i);
    }
    prev = base;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
