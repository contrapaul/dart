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
/** BUG-12 review: `none` is a piece that hangs from nothing, so the first
 *  carve that reaches it drops it whole (a plug you shoot open). The others
 *  turn their contact layer into bedrock (`fillPieces`). */
export type Anchor = "floor" | "wall" | "ceiling" | "none";

export interface PieceVolume extends Box {
  material: MaterialName;
  /** ENV-01: volumes with the same id are one crate, which breaks whole
   *  once it has lost `crate.breakShare` of its voxels
   *  (`src/voxel/crates.ts`). Volumes with no id behave as before. */
  crate?: string;
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

/** GAME-10m stage 3: a Foamer hidden inside a growth piece (kind "growth").
 *  Not drawn, no colliders, no brain, out of the live list, until it wakes
 *  (the player comes within wakeMetres of the growth, or the growth loses
 *  a voxel); waking bursts it out with a pounce the player at once. */
export interface Ambush {
  /** Unique in the level. */
  id: string;
  /** A rig ID from data/foamer-rigs.json (a card with an ambush block, F12). */
  foamer: string;
  /** The ID of a piece of kind "growth". */
  growth: string;
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
  /** LVL-04b: start this wave while the one before it is still up, once the
   *  Foamers still alive hold this share (0 to 1) of the health they had when
   *  the wave started. The Ring's adds come in when the pair is at 50%. */
  startsWithHealthShare?: number;
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

/** ENV-03: a mod station (E13): an arcade cabinet that grants one mod of
 *  its blaster's set once per run, when the player holds use in front of it
 *  (`src/arena/stations.ts`). The mod is a key of the blaster's `mods` in
 *  data/blasters.json. */
export interface Station {
  id: string;
  pos: Vec3;
  /** Radians about Y, the way the facing box looks at the player. */
  facing: number;
  /** A blaster id in data/blasters.json. */
  blaster: string;
  /** A key of that blaster's mods. */
  mod: string;
}

/** ENV-04: a crushing toy press (E14): a toy stamp over a floor pad that
 *  rests, telegraphs, slams and rises on a timer, and crushes the player or
 *  a Foamer under it (`src/level/presses.ts`). The cycle's times and the
 *  damage are in data/press.json. */
export interface Press {
  id: string;
  /** The centre of the floor pad. */
  pos: Vec3;
  /** The pad's full extent, x and z. */
  size: [number, number];
  /** How high the head's face rests above the pad's top. */
  height: number;
  /** Seconds, so two presses can run off beat. */
  phase: number;
}

/** ENV-02: what pressing a button does. The only action for now, and the
 *  same verb the lock-in uses: a door id, set to open. */
export interface ButtonAction {
  open: string;
}

/** ENV-02: a toy button (E08). `pos` is the centre of the flat base plate;
 *  the cap sits on the plate's outer face. The plate and cap sizes are the
 *  same for every button and live in data/buttons.json. */
export interface Button {
  id: string;
  pos: Vec3;
  /** Outward normal of the face it is mounted on. [0, 1, 0] is a floor
   *  button, pressed by the player stepping on it. */
  facing: Vec3;
  action: ButtonAction;
}

export interface Level {
  meta: LevelMeta;
  shell: ShellBox[];
  pieces?: Piece[];
  /** GAME-10m: Foamers hidden inside growth pieces. */
  ambushes?: Ambush[];
  arenas?: Arena[];
  /** ENV-02: buttons, each wired to one action. */
  buttons?: Button[];
  /** ENV-04: the crushing toy presses. */
  presses?: Press[];
  pickups?: Pickup[];
  stations?: Station[];
  playerStart: PlayerStart;
  /** The box that completes the level (the pad behind the last door). */
  exit: Box;
}
