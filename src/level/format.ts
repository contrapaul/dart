// The level file format (design/levels/BLOCKOUT.md), typed. This is the
// subset LVL-01 loads: meta, the shell, destructible pieces, arenas,
// pickups, the player start and the exit. Stations and secrets are left
// out until a task builds them.
//
// Metres, Y up, right handed. Positions are the centre of a box; sizes are
// full extents. Rotations are degrees about Y only. Angles held by the
// player (yaw) are radians, because the controller reads radians.

export type Vec3 = [number, number, number];

export type MaterialName = string;

export interface LevelMeta {
  /** Level ID, matches the file name (`1-1`). */
  id: string;
  /** [Paul]. Shown in level select. */
  name: string;
  act: number;
  /** The beat budget in seconds, so a tool can flag an over-long level. */
  targetSeconds: number;
  /** The act's "this way on" colour. [Paul]. */
  accent: string;
  /** [Paul]. Free text, not used by the loader. */
  setting?: string;
}

export interface Box {
  pos: Vec3;
  size: Vec3;
}

/** Walkable ground and walls. Never destructible. A ramp is a slab whose
 *  top face rises `rise` metres along the box's local +z (size.z of run). */
export interface ShellBox extends Box {
  id: string;
  shape: "box" | "ramp";
  /** Key in data/materials.json. */
  material: MaterialName;
  /** Degrees about Y. */
  rotY?: number;
  /** Ramps only: metres of rise across size.z. */
  rise?: number;
}

export type PieceKind = "cover" | "plug" | "blast-wall" | "island" | "growth" | "ceiling";
export type Anchor = "floor" | "wall" | "ceiling";

export interface PieceVolume extends Box {
  material: MaterialName;
}

export interface Piece {
  id: string;
  kind: PieceKind;
  /** Each volume is at most 3.2 m per axis; bigger shapes use more volumes. */
  volumes: PieceVolume[];
  /** What the piece hangs from, for destruction islands. */
  anchor: Anchor;
  /** Optional: starts with no mesh until a trigger. Not used by LVL-01. */
  hidden?: boolean;
}

export interface Rift {
  id: string;
  pos: Vec3;
  /** Outward normal of the seam. [0, 1, 0] is a rift in the floor. */
  facing: Vec3;
}

export interface WaveSpawn {
  /** A rig ID from data/foamer-rigs.json (F01 is the Slowmer). */
  foamer: string;
  count: number;
  promoted?: boolean;
}

export interface Wave {
  id: string;
  /** Rift IDs in this arena. Spawns round-robin over them. */
  rifts: string[];
  spawns: WaveSpawn[];
  /** After the previous wave clears, or after the lock for wave 1. */
  delaySeconds: number;
  /** Optional stagger between spawns inside the wave. */
  holdSeconds?: number;
}

export type DoorState = "open" | "locked" | "sealed";

export interface Door extends Box {
  id: string;
  state: DoorState;
}

/** LVL-03b: a chase that ends by leaving, not by clearing. Entering `box`
 *  (the bottom of a drop, say) ends the arena with Foamers still up; the page
 *  is asked to clear them out, since they cannot follow, and the doors named
 *  here are sealed after `sealDelaySeconds`, so the way back is shut. */
export interface ArenaEscape {
  /** Player feet inside this box: the arena is over. */
  box: Box;
  /** Door IDs to seal. They may belong to another arena: this arena has no
   *  lock, so a door of its own would be shut the moment it starts. */
  sealDoors?: string[];
  /** Seconds after entering before the seal, so a drop reads as one way. */
  sealDelaySeconds?: number;
}

export interface Arena {
  id: string;
  /** KIT.md code, for the tool and for humans. */
  archetype: string;
  /** Player inside this box starts the lock. */
  trigger: Box;
  doors: Door[];
  rifts: Rift[];
  waves: Wave[];
  /** Door IDs to open when the last wave is cleared. */
  unlockOnClear: string[];
  /** Whether dying here restarts at the trigger, not the level start. */
  checkpoint?: boolean;
  /** Feet position of that restart, on the arena's entry side. */
  checkpointPos?: Vec3;
  /** A one-way way out: the arena clears on entering this box, Foamers and
   *  all. See `ArenaEscape`. */
  escape?: ArenaEscape;
  /** Start the waves on entry but shut no door and say nothing: a chase
   *  that runs down an open lane, where a door would shut behind the player
   *  before they reached the way out. */
  noLock?: boolean;
}

export type PickupType =
  | "darts-standard" | "shells-b03" | "darts-precision" | "mega"
  | "foam-balls" | "health" | "armor" | "token" | "toy";

export interface Pickup {
  id: string;
  type: PickupType;
  count: number;
  pos: Vec3;
}

export interface PlayerStart {
  /** Feet position. */
  pos: Vec3;
  /** Radians about Y; 0 faces -z. */
  yaw: number;
}

export interface Level {
  meta: LevelMeta;
  shell: ShellBox[];
  pieces?: Piece[];
  arenas?: Arena[];
  pickups?: Pickup[];
  playerStart: PlayerStart;
  /** The box that completes the level (the pad behind the last door). */
  exit: Box;
}
