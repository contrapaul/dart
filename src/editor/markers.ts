import * as THREE from "three";
import { rigHeight } from "../foamers/rig";
import type { RigSpec } from "../foamers/rig";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";
import type {
  Box, Level, LevelDoor, Pickup, PlacedFoamer, PlacedModel, PlayerStart, Prim, Prop, Rift, Vec3, Zone,
} from "../level/format";
import { primGeometry, primMatrix } from "../level/prim-geometry";
import { PROP_KINDS } from "../level/props";
import { BLASTERS, MARKERS, MELEE, doorColour, foamerColour, pickupColour } from "./parts";
import { modelMarker } from "./models-editor";

// ED-05 stage 2: one simple marker per placed thing, built in code. No model
// is loaded: a Foamer is a capsule its rig's height with a nose, a pickup is
// a box, and the rest are rings, arrows and see-through boxes. The marker is
// what the view raycasts and what the handles move, so placing and dragging
// work exactly as they do for a prim.

/** The level whose models the markers draw. The view calls markerFor without
 *  one (its signature is shared with every other card), so the page sets it
 *  before each rebuild; an unset level draws a model's placeholder box. */
let markerLevel: Level | null = null;
export function setMarkerLevel(level: Level) {
  markerLevel = level;
}

/** The pseudo ids the start and the exit are selected by. They are not level
 *  ids (the page keeps them out of the document's id space). The exit's id
 *  is on every save, so selecting it can never be confused with a level id. */
export const START_ID = "@start";
export const EXIT_ID = "@exit";

/** What the view needs to put the handles on a marker and read them back. */
export interface Marker {
  object: THREE.Object3D;
  /** The point the handles sit on: the entry's position. */
  pos: Vec3;
  /** The rotation the handles show, degrees XYZ. Only Y is edited on the
   *  things that turn by yaw; the rest stay at zero. */
  rot: Vec3;
  /** The entry's size, for the scale handles, or null when it has none. */
  size: Vec3 | null;
  kind: "foamers" | "pickups" | "doors" | "spawnPoints" | "zones" | "props" | "start" | "exit"
    // ED-31 to ED-35: each card replaces its placeholder case below.
    | "buttons" | "lights" | "physics" | "models";
}

const RIGS = rigData.rigs as unknown as RigSpec[];
const CAPSULE_SHARE = (foamerData as { test: { capsuleShare: number } }).test.capsuleShare;

/** A rig's capsule: its rest height, and the radius the Foamer's own body
 *  gives it (capsuleShare times half the narrower of its x and z size). */
const CAPSULES = new Map<string, { height: number; radius: number }>();
export function capsuleFor(rig: string): { height: number; radius: number } {
  const cached = CAPSULES.get(rig);
  if (cached) return cached;
  const spec = RIGS.find((r) => r.id === rig) ?? RIGS[0]!;
  const body = spec.parts.find((p) => p.parent === null) ?? spec.parts[0]!;
  const height = Math.max(0.5, rigHeight(spec));
  const radius = Math.max(0.15, CAPSULE_SHARE * Math.min(body.size[0], body.size[2]) * spec.voxelSize / 2);
  const made = { height, radius: Math.min(radius, height / 2 - 0.01) };
  CAPSULES.set(rig, made);
  return made;
}

/** A soft colour, no lighting tricks: markers are seen from arm's length. */
function paint(colour: string, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.9, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
  });
}

/** A short text label over a marker, drawn into a canvas: nothing is
 *  fetched, and the pickups that carry one are few. */
function labelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(20, 12, 40, 0.85)";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#fff6e8";
  g.font = "28px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  return sprite;
}

/** The box a door, a zone or the exit is drawn as: see-through, so what is
 *  inside it can still be seen and clicked. */
function ghostBox(pos: Vec3, size: Vec3, colour: string, rotY = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    paint(colour, MARKERS.markerOpacity),
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.y = rotY;
  return mesh;
}

/** A Foamer: a capsule its rig's size, with a nose along the way it faces
 *  (yaw 0 faces -z, src/level/format.ts) and a ring of its type's colour. */
function foamerMarker(f: PlacedFoamer): THREE.Group {
  const group = new THREE.Group();
  const { height, radius } = capsuleFor(f.foamer);
  const colour = foamerColour(f.foamer);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, height - radius * 2, 6, 12), paint(colour));
  body.position.y = height / 2;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.6, radius * 0.6, radius * 2), paint("#fff6e8"));
  nose.position.set(0, height * 0.78, -radius * 1.6);
  group.add(body, nose);
  group.position.set(f.pos[0], f.pos[1], f.pos[2]);
  group.rotation.y = f.yaw;
  if (f.hidden === true) group.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (mesh.material) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      mat.opacity = 0.35;
    }
  });
  return group;
}

/** A pickup: a small box in its kind's colour. A blaster or a hand weapon
 *  carries the name of what it gives above it. */
function pickupMarker(p: Pickup): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(MARKERS.pickupSize, MARKERS.pickupSize, MARKERS.pickupSize),
    paint(pickupColour(p)),
  );
  group.add(box);
  if (p.type === "blaster" || p.type === "melee") {
    const name = p.type === "blaster"
      ? BLASTERS.find((b) => b.id === p.blaster)?.name ?? p.blaster ?? ""
      : MELEE.find((m) => m.id === p.melee)?.name ?? p.melee ?? "";
    if (name) {
      const sprite = labelSprite(name);
      sprite.position.y = MARKERS.pickupSize;
      group.add(sprite);
    }
  }
  group.position.set(p.pos[0], p.pos[1] + MARKERS.pickupSize / 2, p.pos[2]);
  return group;
}

/** A spawn point: a flat ring on the floor a trigger's spawn lands on. */
function spawnMarker(r: Rift): THREE.Group {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(MARKERS.ringRadius, 0.08, 8, 32),
    paint(MARKERS.spawnColour),
  );
  ring.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(MARKERS.ringRadius * 0.55, MARKERS.ringRadius * 0.55, 0.06, 16),
    paint(MARKERS.spawnColour, MARKERS.markerOpacity),
  );
  group.add(ring, core);
  group.position.set(r.pos[0], r.pos[1] + 0.05, r.pos[2]);
  return group;
}

/** The player start: an arrow on the floor showing the way the level begins
 *  facing (yaw 0 faces -z). */
function startMarker(s: PlayerStart): THREE.Group {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 1.2), paint(MARKERS.startColour));
  shaft.position.z = -0.1;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), paint(MARKERS.startColour));
  head.rotation.x = -Math.PI / 2;
  head.position.z = -0.9;
  group.add(shaft, head);
  group.position.set(s.pos[0], s.pos[1] + 0.06, s.pos[2]);
  group.rotation.y = s.yaw;
  return group;
}

/** A prop drawn as itself: its parts in their colours, turned and placed. */
function propMarker(p: Prop): THREE.Group {
  const group = new THREE.Group();
  for (const part of PROP_KINDS[p.kind]?.parts ?? []) {
    const shape: Prim = { id: "", shape: part.shape, pos: part.pos, size: part.size, rot: part.rot, colour: part.colour, behaviour: "decor" };
    const mesh = new THREE.Mesh(primGeometry(shape), paint(part.colour));
    primMatrix(shape).decompose(mesh.position, mesh.quaternion, mesh.scale);
    group.add(mesh);
  }
  group.position.set(...p.pos);
  group.rotation.y = ((p.rotY ?? 0) * Math.PI) / 180;
  return group;
}

function doorMarker(d: LevelDoor): THREE.Mesh {
  // rotY is degrees in the level file; the mesh turns in radians.
  return ghostBox(d.pos, d.size, doorColour(d), ((d.rotY ?? 0) * Math.PI) / 180);
}

/** Builds the marker for one entry, with the data the handles need. */
export function markerFor(
  kind: Marker["kind"],
  entry: PlacedFoamer | Pickup | LevelDoor | Rift | Zone | Prop | PlayerStart | Box | PlacedModel,
): Marker {
  switch (kind) {
    case "foamers": {
      const f = entry as PlacedFoamer;
      return { object: foamerMarker(f), pos: f.pos, rot: [0, (f.yaw * 180) / Math.PI, 0], size: null, kind };
    }
    case "pickups": {
      const p = entry as Pickup;
      return { object: pickupMarker(p), pos: p.pos, rot: [0, 0, 0], size: null, kind };
    }
    case "doors": {
      const d = entry as LevelDoor;
      return { object: doorMarker(d), pos: d.pos, rot: [0, d.rotY ?? 0, 0], size: d.size, kind };
    }
    case "spawnPoints": {
      const r = entry as Rift;
      return { object: spawnMarker(r), pos: r.pos, rot: [0, 0, 0], size: null, kind };
    }
    case "zones": {
      const z = entry as Zone;
      return { object: ghostBox(z.pos, z.size, MARKERS.zoneColour), pos: z.pos, rot: [0, 0, 0], size: z.size, kind };
    }
    case "props": {
      const p = entry as Prop;
      return { object: propMarker(p), pos: p.pos, rot: [0, p.rotY ?? 0, 0], size: null, kind };
    }
    case "start": {
      const s = entry as PlayerStart;
      return { object: startMarker(s), pos: s.pos, rot: [0, (s.yaw * 180) / Math.PI, 0], size: null, kind };
    }
    case "exit": {
      const b = entry as Box;
      return { object: ghostBox(b.pos, b.size, MARKERS.exitColour), pos: b.pos, rot: [0, 0, 0], size: b.size, kind };
    }
    case "models": {
      // ED-35: the marker is the model itself, drawn at its own transform.
      // Its size is null until it loads, so the handles move and turn it and
      // its scale is typed in the inspector.
      const m = entry as unknown as PlacedModel;
      const object = markerLevel ? modelMarker(markerLevel, m) : ghostBox(m.pos, [0.6, 0.6, 0.6], MARKERS.linkedColour);
      return { object, pos: m.pos, rot: m.rot ?? [0, 0, 0], size: null, kind };
    }
    default: {
      // ED-31 to ED-35 placeholders: a small box where the thing is, until
      // its card draws it properly.
      const e = entry as unknown as { pos: Vec3; size?: Vec3; rot?: Vec3 };
      const size: Vec3 = e.size ?? [0.4, 0.4, 0.4];
      return { object: ghostBox(e.pos, size, MARKERS.linkedColour), pos: e.pos, rot: e.rot ?? [0, 0, 0], size: e.size ?? null, kind };
    }
  }
}
