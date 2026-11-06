import type { Arena, Box, DoorState, Rift, Vec3, Wave } from "./format";

// One arena's lock-in, as plain logic: no Three.js and no physics, so the
// page feeds it the player's position and the number of Foamers still alive
// and it says what should happen (PLAN.md 4.2, README pillar 2). The page
// does the acting: it sets door states, spawns Foamers at rifts and plays
// sounds from the events here.
//
// waiting  player has not reached the trigger yet
// locked   doors closed, waiting out the first wave's delaySeconds
// wave      wave n is spawning and fighting; the next starts when this one
//           has no Foamer left and every spawn has been issued
// cleared  every wave is down, unlockOnClear doors are open

export type ArenaPhase = "waiting" | "locked" | "wave" | "cleared";

export interface ArenaContext {
  /** The player's feet, metres. */
  playerPos: Vec3;
  /** Foamers still on their feet or sinking, from FoamerSystem. */
  aliveCount: number;
}

export interface ArenaEvents {
  /** A door should open or shut. */
  setDoor(id: string, state: DoorState): void;
  /** Spawn one Foamer at a rift, facing the player. Returns false when the
   *  page refused (the FoamerSystem cap), so the runner can retry. */
  spawn(foamerId: string, rift: Rift, promoted: boolean): boolean;
  onLocked(): void;
  /** Wave `index` (0 based) begins; the page plays its sound and banner. */
  onWaveStart(wave: Wave, index: number, count: number): void;
  onCleared(): void;
  /** LVL-03b: the player took the arena's one-way way out. The arena is over
   *  even if Foamers are up: they cannot follow, and the page should take
   *  them off the board, as it would on a restart (an escape is not a clear,
   *  so no unlockOnClear door opens). Optional: a page that does not listen
   *  simply plays on with the Foamers the escape left behind. */
  onEscaped?(): void;
}

/** A wave is cleared only this long after its last spawn, so a Foamer that
 *  pops during the spawn is not counted before it exists. */
const CLEAR_GRACE = 0.25;
/** Spawning retries at this rate while the page is at its cap. */
const SPAWN_RETRY = 0.5;

function inside(box: Box, p: Vec3) {
  return Math.abs(p[0] - box.pos[0]) <= box.size[0] / 2
    && Math.abs(p[1] - box.pos[1]) <= box.size[1] / 2
    && Math.abs(p[2] - box.pos[2]) <= box.size[2] / 2;
}

export interface ArenaState {
  phase: ArenaPhase;
  /** 0 based, -1 while waiting or locked. */
  waveIndex: number;
  /** Waves cleared so far. */
  cleared: number;
  /** Progress toward the next event, 0 to 1, for a HUD ring if wanted. */
  progress: number;
}

export class ArenaRunner {
  private phase: ArenaPhase = "waiting";
  private waveIndex = -1;
  private time = 0;
  /** Seconds between the remaining spawns of the current wave. */
  private hold = 0;
  private spawnTimer = 0;
  /** Spawns still to issue, in order, as {foamer, promoted, rift}. */
  private queue: { foamer: string; promoted: boolean; rift: Rift }[] = [];
  /** Seconds until the wave may be counted as cleared. */
  private grace = 0;
  /** Seconds left before the next wave, or -1 while the wave is still on. */
  private gap = -1;
  /** LVL-03b: seconds left before an escaped arena's doors seal, or -1. */
  private sealIn = -1;

  constructor(private readonly arena: Arena, private readonly events: ArenaEvents) {
    this.reset();
  }

  get state(): ArenaState {
    const total = Math.max(1, this.arena.waves.length);
    // "cleared" counts the waves that are done: all of them once the arena
    // is clear, otherwise every wave before the one being fought.
    const cleared = this.phase === "cleared"
      ? this.arena.waves.length
      : Math.max(0, this.waveIndex);
    return {
      phase: this.phase,
      waveIndex: this.waveIndex,
      cleared,
      progress: Math.min(1, cleared / total),
    };
  }

  /** Back to waiting, doors as the file has them, no waves. The page calls
   *  this on a checkpoint restart; the voxels are the page's business. */
  reset(): void {
    this.phase = "waiting";
    this.waveIndex = -1;
    this.time = 0;
    this.hold = 0;
    this.spawnTimer = 0;
    this.grace = 0;
    this.gap = -1;
    this.sealIn = -1;
    this.queue = [];
    for (const door of this.arena.doors) this.events.setDoor(door.id, door.state);
  }

  /** LVL-03b: an escaped arena's doors seal this many seconds after the
   *  landing, which is always after the arena is over. The level runner
   *  steps this for every arena, every frame, because a cleared arena is
   *  not stepped again. */
  updateSeal(dt: number): void {
    if (this.sealIn < 0) return;
    this.sealIn -= dt;
    if (this.sealIn > 0) return;
    this.sealIn = -1;
    for (const id of this.arena.escape?.sealDoors ?? []) this.events.setDoor(id, "sealed");
  }

  update(dt: number, ctx: ArenaContext): void {
    if (this.phase === "cleared") return;
    this.time += dt;

    // LVL-03b: a one-way way out ends the fight, so a chase that the player
    // may run from needs no clear at all. It is taken from any phase: the
    // hall's wave is on when the player drops, and the drop is the answer
    // to the wave, not a way to skip it unseen.
    const escape = this.escapeBox();
    if (escape && inside(escape, ctx.playerPos)) {
      this.escape();
      return;
    }

    if (this.phase === "waiting") {
      if (!inside(this.arena.trigger, ctx.playerPos)) return;
      this.lock();
      return;
    }

    if (this.phase === "locked") {
      const first = this.arena.waves[0];
      if (!first) {
        this.clearAll();
        return;
      }
      if (this.time < first.delaySeconds) return;
      this.startWave(0);
      return;
    }

    // phase === "wave": issue spawns, then wait for the arena to empty.
    this.grace = Math.max(0, this.grace - dt);
    if (this.queue.length) {
      this.spawnTimer -= dt;
      // A wave without holdSeconds arrives as one clump.
      if (this.spawnTimer <= 0) {
        const next = this.queue[0]!;
        if (this.events.spawn(next.foamer, next.rift, next.promoted)) {
          this.queue.shift();
          this.spawnTimer = this.hold;
        } else {
          this.spawnTimer = SPAWN_RETRY;
        }
      }
      return;
    }
    if (this.grace > 0 || ctx.aliveCount > 0) return;
    if (this.gap < 0) {
      const next = this.arena.waves[this.waveIndex + 1];
      if (!next) {
        this.clearAll();
        return;
      }
      // The gap before the next wave is that wave's own delaySeconds.
      this.gap = next.delaySeconds;
      return;
    }
    this.gap -= dt;
    if (this.gap <= 0) this.startWave(this.waveIndex + 1);
  }

  /** The box that ends the fight by leaving it, when the arena has one. */
  private escapeBox(): Box | undefined {
    return this.arena.escape?.box;
  }

  /** LVL-03b: leaving, not clearing. No door opens: the way out is one way,
   *  and its doors seal `sealDelaySeconds` after the landing. */
  private escape() {
    this.phase = "cleared";
    const escape = this.arena.escape;
    if (escape?.sealDoors?.length) this.sealIn = Math.max(0, escape.sealDelaySeconds ?? 0);
    this.events.onEscaped?.();
  }

  private lock() {
    // LVL-03b: `noLock` still starts the waves (the hall's chase must spawn),
    // but shuts nothing and says nothing: there is no door to feel shut.
    if (!this.arena.noLock) {
      for (const door of this.arena.doors) {
        // A sealed door never opens and never shuts further.
        if (door.state === "sealed") continue;
        this.events.setDoor(door.id, "locked");
      }
    }
    this.phase = "locked";
    this.time = 0;
    if (!this.arena.noLock) this.events.onLocked();
  }

  private startWave(index: number) {
    const wave = this.arena.waves[index]!;
    this.phase = "wave";
    this.waveIndex = index;
    this.time = 0;
    this.hold = wave.holdSeconds && wave.holdSeconds > 0 ? wave.holdSeconds : 0;
    this.spawnTimer = 0;
    this.grace = CLEAR_GRACE;
    this.gap = -1;
    this.queue = [];
    // Round robin over the wave's rifts, so 5 Foamers from 3 rifts do not
    // all come out of one seam.
    const rifts = wave.rifts
      .map((id) => this.arena.rifts.find((r) => r.id === id))
      .filter((r): r is Rift => Boolean(r));
    let i = 0;
    for (const spawn of wave.spawns) {
      for (let n = 0; n < spawn.count; n++) {
        const rift = rifts.length ? rifts[i++ % rifts.length]! : undefined;
        if (!rift) continue;
        this.queue.push({ foamer: spawn.foamer, promoted: spawn.promoted === true, rift });
      }
    }
    this.events.onWaveStart(wave, index, this.queue.length);
  }

  private clearAll() {
    this.phase = "cleared";
    for (const id of this.arena.unlockOnClear) this.events.setDoor(id, "open");
    this.events.onCleared();
  }
}
