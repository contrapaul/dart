import materialsData from "../../data/materials.json";
import rigData from "../../data/foamer-rigs.json";
import dartsData from "../../data/darts.json";
import blastersData from "../../data/blasters.json";
import type { Arena, Level, Piece, PieceVolume, ShellBox } from "./format";
import buttonData from "../../data/buttons.json";
import pressTuning from "../../data/press.json";

// Checks a level file against design/levels/BLOCKOUT.md section 5. Rule 7
// (secrets) is for a thing LVL-01 does not load yet; the dart type names of
// an ammo pickup (rule 8) are checked here too. The validator is plain
// data: no Three.js, no physics, so it can run in a test or in a tool.
//
// A file with errors does not load. Warnings are budget notes for a human.

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** A voxel volume is 32 x 0.1 m. */
const MAX_VOLUME = 3.2;
/** KIT 6: an arena is at most 6 voxel volumes; 5 is the warning line. */
const ARENA_VOLUMES = 6;
const ARENA_VOLUMES_WARN = 5;
/** Alive at once, per wave: Normal and Foam Fury (KIT 6). */
const WAVE_ALIVE = 12;
const WAVE_ALIVE_FURY = 16;
/** Boxes that touch to this tolerance count as adjacent. */
const TOUCH = 0.01;

const materialNames = new Set(materialsData.materials.map((m) => m.name));
/** A $darts-$ type pickup is a real dart type in data/darts.json (LVL-02a). */
const dartNames = new Set(Object.keys(dartsData.types));
/** Rule 12 asks for health, so a rig without one does not count. */
const rigIds = new Set(rigData.rigs.filter((r) => typeof r.health === "number" && r.health > 0).map((r) => r.id));

type Vec3 = [number, number, number];

/** ENV-04: the stamp of a full press, for the phase check. Computed here
 *  from the same data the system reads, because the validator is pure
 *  data: no Three.js, no physics. */
const PRESS_CYCLE_TOTAL = (() => {
  const c = (pressTuning as { cycle: { up: number; telegraph: number; slam: number; down: number; rise: number } }).cycle;
  return c.up + c.telegraph + c.slam + c.down + c.rise;
})();

function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

function boxValid(b: { pos?: unknown; size?: unknown }, what: string, errors: string[]) {
  if (!isVec3(b.pos)) errors.push(`${what}: pos must be three numbers`);
  if (!isVec3(b.size)) errors.push(`${what}: size must be three numbers`);
}

function overlap1D(aMin: number, aMax: number, bMin: number, bMax: number) {
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > TOUCH;
}

interface Bounds {
  min: Vec3;
  max: Vec3;
}

function boxBounds(pos: Vec3, size: Vec3): Bounds {
  return {
    min: [pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2],
    max: [pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2],
  };
}

/** True when the point is strictly inside the box (surfaces count as out). */
function inside(b: Bounds, p: Vec3) {
  return p[0] > b.min[0] + TOUCH && p[0] < b.max[0] - TOUCH
    && p[1] > b.min[1] + TOUCH && p[1] < b.max[1] - TOUCH
    && p[2] > b.min[2] + TOUCH && p[2] < b.max[2] - TOUCH;
}

/** Volumes touch (share a face or overlap) rather than being apart. */
function volumesTouch(a: Bounds, b: Bounds) {
  for (let i = 0; i < 3; i++) {
    if (Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]) < -TOUCH) return false;
  }
  // At least one axis must overlap with thickness: two boxes meeting only
  // along an edge are not a path.
  return [0, 1, 2].some((i) => overlap1D(a.min[i], a.max[i], b.min[i], b.max[i]));
}

/** Rule 2. Every volume reaches an anchor through touching volumes. The
 *  touching volume at the anchor's side of the piece is the one holding it. */
function pieceAnchored(piece: Piece, errors: string[]) {
  const boxes = piece.volumes.map((v) => boxBounds(v.pos, v.size));
  const reached = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const i = queue.pop()!;
    for (let j = 0; j < boxes.length; j++) {
      if (reached.has(j) || !volumesTouch(boxes[i], boxes[j])) continue;
      reached.add(j);
      queue.push(j);
    }
  }
  if (reached.size !== boxes.length) {
    errors.push(`piece ${piece.id}: volume ${boxes.findIndex((_, i) => !reached.has(i))} has no path to the anchor`);
    return;
  }
  // BUG-12 review: a piece anchored to nothing has no anchor side to reach.
  if (piece.anchor === "none") return;
  // The anchor side is the extreme of the piece along the anchor's axis.
  const axis = piece.anchor === "floor" || piece.anchor === "ceiling" ? 1 : 0;
  const wantMax = piece.anchor === "ceiling" || piece.anchor === "wall";
  const extreme = boxes.reduce(
    (best, b) => (wantMax ? Math.max(best, b.max[axis]) : Math.min(best, b.min[axis])),
    wantMax ? -Infinity : Infinity,
  );
  const holder = boxes.some((b) => (wantMax ? b.max[axis] === extreme : b.min[axis] === extreme));
  if (!holder) errors.push(`piece ${piece.id}: no volume reaches the ${piece.anchor}`);
}

/** The zone a piece volume has to sit in to count against an arena's voxel
 *  budget: the trigger, doors and rifts, grown by 4 m so cover placed behind
 *  the trigger (README pillar 3) still counts. */
const ARENA_ZONE_MARGIN = 4;

/** LVL-02b: the space an arena seals when it locks: the box around its
 *  trigger, doors and rifts, ungrown. A later arena's trigger inside it
 *  could never be reached. */
function lockedSpace(arena: Arena): Bounds {
  return arenaZone(arena, 0);
}

function arenaZone(arena: Arena, margin: number): Bounds {
  const boxes = [
    ...arena.doors.map((b) => boxBounds(b.pos, b.size)),
    ...arena.rifts.map((r) => boxBounds(r.pos, [1, 1, 1])),
    boxBounds(arena.trigger.pos, arena.trigger.size),
  ];
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i] - margin);
      max[i] = Math.max(max[i], b.max[i] + margin);
    }
  }
  return { min, max };
}

export function validateLevel(level: Level): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Structure that every rule below assumes.
  if (!level.meta || typeof level.meta.id !== "string") errors.push("meta.id is missing");
  if (!Array.isArray(level.shell) || level.shell.length === 0) errors.push("shell must be a non-empty array");
  if (!level.playerStart || !isVec3(level.playerStart.pos)) errors.push("playerStart.pos must be three numbers");
  if (!level.exit || !isVec3(level.exit.pos)) errors.push("exit.pos must be three numbers");
  if (errors.length) return { errors, warnings };

  const pieces = level.pieces ?? [];
  const arenas = level.arenas ?? [];

  // LVL-02a: a pickups entry of a darts-* type is an ammo box for that dart
  // type, and the type must be a real one in data/darts.json.
  for (const p of level.pickups ?? []) {
    if (!p.type.startsWith("darts-")) continue;
    if (!dartNames.has(p.type.slice("darts-".length))) {
      errors.push(`pickup ${p.id}: ${p.type} is not a dart type in data/darts.json`);
    }
  }

  // ENV-03: a station names a blaster and one of that blaster's mods.
  const blasters = blastersData as Record<string, { name?: string; mods?: Record<string, unknown> }>;
  for (const s of level.stations ?? []) {
    const mods = blasters[s.blaster]?.mods;
    if (!mods) {
      errors.push(`station ${s.id}: ${s.blaster} is not a blaster in data/blasters.json`);
    } else if (!(s.mod in mods)) {
      errors.push(`station ${s.id}: ${s.mod} is not a mod of ${s.blaster}`);
    }
    if (!Number.isFinite(s.facing)) errors.push(`station ${s.id}: facing must be a number`);
    if (!isVec3(s.pos)) errors.push(`station ${s.id}: pos must be three numbers`);
  }

  // Rule 1 and rule 11: every volume is small enough and uses a real material.
  const checkMaterial = (name: string, what: string) => {
    if (!materialNames.has(name)) errors.push(`${what}: unknown material ${name}`);
  };
  for (const box of level.shell) checkMaterial(box.material, `shell ${box.id}`);
  for (const piece of pieces) {
    piece.volumes.forEach((v: PieceVolume, i) => {
      const where = `piece ${piece.id} volume ${i}`;
      checkMaterial(v.material, where);
      if (!isVec3(v.pos) || !isVec3(v.size)) return;
      if (v.size.some((s) => s <= 0)) errors.push(`${where}: size must be positive`);
      if (v.size.some((s) => s > MAX_VOLUME + 0.001)) {
        errors.push(`${where}: ${v.size.join(" x ")} m exceeds the ${MAX_VOLUME} m voxel volume cap`);
      }
    });
    // Rule 2.
    pieceAnchored(piece, errors);
  }

  // Rule 5 and 6, plus the wave size budget (rule 4), and LVL-02b's arena id
  // rule. The trigger rules are with rule 9 below, where the shell is known.
  const seenWaves = new Set<string>();
  const seenArenas = new Set<string>();
  for (const arena of arenas) {
    if (seenArenas.has(arena.id)) errors.push(`arena id ${arena.id} is used twice`);
    seenArenas.add(arena.id);
    const rifts = new Set(arena.rifts.map((r) => r.id));
    const doors = new Set(arena.doors.map((d) => d.id));
    for (const id of arena.unlockOnClear) {
      if (!doors.has(id)) errors.push(`arena ${arena.id}: unlockOnClear names unknown door ${id}`);
    }
    for (const wave of arena.waves) {
      if (seenWaves.has(wave.id)) errors.push(`wave id ${wave.id} is used twice`);
      seenWaves.add(wave.id);
      let alive = 0;
      for (const spawn of wave.spawns) {
        alive += spawn.count;
        // Rule 12.
        if (!rigIds.has(spawn.foamer)) {
          errors.push(`arena ${arena.id} wave ${wave.id}: unknown foamer ${spawn.foamer}`);
        }
        if (!Number.isInteger(spawn.count) || spawn.count < 1) {
          errors.push(`arena ${arena.id} wave ${wave.id}: count for ${spawn.foamer} must be 1 or more`);
        }
      }
      for (const rift of wave.rifts) {
        if (!rifts.has(rift)) {
          errors.push(`arena ${arena.id} wave ${wave.id}: rift ${rift} is not defined in the arena`);
        }
      }
      if (alive > WAVE_ALIVE_FURY) {
        errors.push(`arena ${arena.id} wave ${wave.id}: ${alive} alive at once, over the ${WAVE_ALIVE_FURY} Fury cap`);
      } else if (alive > WAVE_ALIVE) {
        warnings.push(`arena ${arena.id} wave ${wave.id}: ${alive} alive, over the Normal cap of ${WAVE_ALIVE}`);
      }
      if (wave.delaySeconds < 0) errors.push(`arena ${arena.id} wave ${wave.id}: delaySeconds is negative`);
    }

    // Rule 3: count the piece volumes that sit in this arena.
    const bounds = arenaZone(arena, ARENA_ZONE_MARGIN);
    const inArena = pieces.filter((p) =>
      p.volumes.some((v) => v.pos[0] >= bounds.min[0] && v.pos[0] <= bounds.max[0]
        && v.pos[2] >= bounds.min[2] && v.pos[2] <= bounds.max[2]));
    const count = inArena.reduce((n, p) => n + p.volumes.length, 0);
    if (count > ARENA_VOLUMES) {
      errors.push(`arena ${arena.id}: ${count} voxel volumes, over the KIT cap of ${ARENA_VOLUMES}`);
    } else if (count >= ARENA_VOLUMES_WARN) {
      warnings.push(`arena ${arena.id}: ${count} voxel volumes, close to the KIT cap of ${ARENA_VOLUMES}`);
    }
  }

  // Rule 9: the player, the exit and the doors sit in the shell and not in
  // solid geometry. The shell bounds are the union of its boxes. A door is
  // allowed to overlap a shell box: it sits in that wall's opening, which
  // the format cannot express separately. Pieces are always solid.
  const shellBounds = shellUnion(level.shell);
  const outsideShell = (p: Vec3) =>
    p[0] < shellBounds.min[0] - TOUCH || p[0] > shellBounds.max[0] + TOUCH
    || p[1] < shellBounds.min[1] - TOUCH || p[1] > shellBounds.max[1] + TOUCH
    || p[2] < shellBounds.min[2] - TOUCH || p[2] > shellBounds.max[2] + TOUCH;
  const solid = [
    ...level.shell.map((b) => ({ name: `shell ${b.id}`, bounds: boxBounds(b.pos, b.size) })),
    ...pieces.flatMap((p) => p.volumes.map((v, i) => ({
      name: `piece ${p.id} volume ${i}`, bounds: boxBounds(v.pos, v.size),
    }))),
  ];
  const checkSpot = (name: string, p: Vec3, allowShellOverlap: boolean) => {
    if (outsideShell(p)) {
      errors.push(`${name}: outside the shell`);
      return;
    }
    for (const s of solid) {
      if (allowShellOverlap && s.name.startsWith("shell ")) continue;
      if (inside(s.bounds, p)) errors.push(`${name}: inside ${s.name}`);
    }
  };
  checkSpot("playerStart", level.playerStart.pos, false);
  checkSpot("exit", level.exit.pos, false);
  for (const arena of arenas) {
    for (const door of arena.doors) {
      boxValid(door, `arena ${arena.id} door ${door.id}`, errors);
      if (isVec3(door.pos)) checkSpot(`arena ${arena.id} door ${door.id}`, door.pos, true);
      if (door.state !== "open" && door.state !== "locked" && door.state !== "sealed") {
        errors.push(`arena ${arena.id} door ${door.id}: state must be open, locked or sealed`);
      }
    }
    // LVL-02b: the trigger is inside the shell, and the arenas are in an
    // order the player can walk: a trigger may not sit in the space an
    // earlier arena seals when it locks, or no one reaches it.
    if (isVec3(arena.trigger.pos)) {
      if (outsideShell(arena.trigger.pos)) {
        errors.push(`arena ${arena.id}: trigger outside the shell`);
      }
      for (const earlier of arenas.slice(0, arenas.indexOf(arena))) {
        if (inside(lockedSpace(earlier), arena.trigger.pos)) {
          errors.push(`arena ${arena.id}: trigger is inside arena ${earlier.id}, which locks first`);
        }
      }
    }
  }

  // ENV-02 (E08): a button sits in the shell, names a door that exists, and
  // faces out along one axis. Its cap is what a dart or a melee meets, so it
  // is a spot like a door's: it may sit against a wall, not inside one.
  const doorIds = new Set(arenas.flatMap((a) => a.doors.map((d) => d.id)));
  const seenButtons = new Set<string>();
  for (const b of level.buttons ?? []) {
    const what = `button ${b.id}`;
    if (seenButtons.has(b.id)) errors.push(`${what}: id used twice`);
    seenButtons.add(b.id);
    if (!isVec3(b.pos)) {
      errors.push(`${what}: pos must be three numbers`);
      continue;
    }
    const f = b.facing;
    if (!isVec3(f)) {
      errors.push(`${what}: facing must be three numbers`);
    } else {
      const len = Math.hypot(f[0], f[1], f[2]);
      const axes = [Math.abs(f[0]), Math.abs(f[1]), Math.abs(f[2])].filter((n) => n > 1e-3).length;
      if (Math.abs(len - 1) > 1e-3 || axes !== 1) {
        errors.push(`${what}: facing must be a unit axis, like [0, 1, 0]`);
      }
    }
    if (!b.action || typeof b.action.open !== "string") {
      errors.push(`${what}: action.open must name a door`);
    } else if (!doorIds.has(b.action.open)) {
      errors.push(`${what}: action.open names unknown door ${b.action.open}`);
    }
    checkSpot(what, b.pos, true);
    // The cap stands proud of the plate, so a floor button's centre needs
    // the plate and the cap inside the shell's height too. The plate is
    // turned so its own thin axis (size[1]) lies along `facing`.
    const top = b.pos[1] + buttonData.plate.size[1] / 2 + buttonData.cap.height;
    if (top > shellBounds.max[1] + TOUCH) errors.push(`${what}: cap reaches above the shell`);
  }

  // Rule 10 is about shell boxes alone: they may not share volume. Doors
  // are not shell, so a doorway is free to sit in a wall.
  for (let i = 0; i < level.shell.length; i++) {
    const a = boxBounds(level.shell[i].pos, level.shell[i].size);
    for (let j = i + 1; j < level.shell.length; j++) {
      const b = boxBounds(level.shell[j].pos, level.shell[j].size);
      const overlap = [0, 1, 2].every((k) => overlap1D(a.min[k], a.max[k], b.min[k], b.max[k]));
      if (overlap) errors.push(`shell ${level.shell[i].id} overlaps shell ${level.shell[j].id}`);
    }
  }

  // ENV-04 (E14): a press sits on the floor of the shell, its pad is flat
  // (the pad's height, from data, is small), it does not reach the ceiling,
  // and its phase is inside its own cycle. The head's lowest point at rest
  // is the pad top plus the spec's height, so the rest state must clear the
  // player: a level that names a height under the player's reach would
  // close in on a standing player and the card's level is 3 m high.
  const seenPresses = new Set<string>();
  for (const p of level.presses ?? []) {
    const what = `press ${p.id}`;
    if (seenPresses.has(p.id)) errors.push(`${what}: id used twice`);
    seenPresses.add(p.id);
    if (!isVec3(p.pos)) {
      errors.push(`${what}: pos must be three numbers`);
      continue;
    }
    if (!Array.isArray(p.size) || p.size.length !== 2
      || !p.size.every((n) => typeof n === "number" && n > 0)) {
      errors.push(`${what}: size must be two positive numbers, x and z`);
      continue;
    }
    if (typeof p.height !== "number" || p.height <= 0) {
      errors.push(`${what}: height must be positive`);
    }
    if (typeof p.phase !== "number" || p.phase < 0 || p.phase >= PRESS_CYCLE_TOTAL) {
      errors.push(`${what}: phase must be in [0, ${PRESS_CYCLE_TOTAL})`);
    }
    if (!outsideShell(p.pos)) {
      for (const s of solid) {
        if (s.name.startsWith("shell ")) continue;
        if (inside(s.bounds, p.pos)) errors.push(`${what}: inside ${s.name}`);
      }
    }
  }

  // GAME-10m (the ambush): an ambush names a known rig and a piece of kind
  // "growth". An ambush whose growth is missing or of another kind would
  // leave a hidden, undamageable Foamer in the level the page can never
  // wake, so it is an error, not a warning.
  const growthKinds = new Map(
    (level.pieces ?? []).map((p) => [p.id, p.kind] as const),
  );
  for (const a of level.ambushes ?? []) {
    const what = `ambush ${a.id}`;
    if (!rigIds.has(a.foamer)) errors.push(`${what}: unknown foamer ${a.foamer}`);
    const kind = growthKinds.get(a.growth);
    if (kind !== "growth") {
      errors.push(`${what}: growth ${a.growth} is not a growth piece${kind ? ` (it is a ${kind})` : " (no such piece)"}`);
    }
  }

  return { errors, warnings };
}

function shellUnion(shell: ShellBox[]): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const box of shell) {
    const b = boxBounds(box.pos, box.size);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i]);
      max[i] = Math.max(max[i], b.max[i]);
    }
  }
  return { min, max };
}
