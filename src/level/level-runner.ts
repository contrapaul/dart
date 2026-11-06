import type { Arena } from "./format";
import { ArenaRunner, type ArenaContext, type ArenaEvents, type ArenaState } from "./arena";

// LVL-02b: a level's arenas played in file order. Each arena is one
// ArenaRunner (its own trigger, doors, waves and checkpoint); only the
// current one is stepped, so a later arena's trigger does nothing until
// every earlier arena has cleared. Plain logic again, no Three.js and no
// physics: the page acts on the events, as it does for one arena.
//
// waiting / locked / wave / cleared  the current arena's own phase
// complete                           every arena has cleared; the page then
//                                    lets the exit pad end the level

export type LevelPhase = ArenaState["phase"] | "complete";

export interface LevelEvents extends ArenaEvents {
  /** Arena `index` (0 based) becomes the current one, from the start or
   *  after the arena before it cleared. The page swaps the banner text and
   *  the rift glow for this arena. */
  onArenaStart(arena: Arena, index: number): void;
  /** The last arena cleared: the level is over once the player reaches the
   *  exit pad. */
  onLevelCleared(): void;
}

export interface LevelState {
  phase: LevelPhase;
  /** 0 based index of the current arena; the last one once complete. */
  arenaIndex: number;
  /** Id of the current arena; the last one once complete. */
  arenaId: string;
  /** Arenas cleared so far. */
  arenasCleared: number;
  /** The current arena's own state. */
  arena: ArenaState;
  /** Arenas cleared over arenas, 0 to 1. */
  progress: number;
}

export class LevelRunner {
  private readonly runners: ArenaRunner[];
  /** Index of the arena being played; arenas.length once complete. */
  private current = 0;

  constructor(private readonly arenas: Arena[], private readonly events: LevelEvents) {
    // Every arena's runner is built up front, so every door in the file is
    // in its file state from the start: a player cannot run ahead through a
    // later arena's open door.
    this.runners = arenas.map((arena) => new ArenaRunner(arena, events));
    this.events.onArenaStart(arenas[0] ?? ({} as Arena), 0);
  }

  /** The arena being played (the last one once complete). */
  get currentArena(): Arena | undefined {
    return this.arenas[Math.min(this.current, this.arenas.length - 1)];
  }

  get state(): LevelState {
    const last = this.arenas.length - 1;
    const index = Math.min(this.current, last);
    const arena = this.arenas[index];
    const runner = this.runners[index];
    const total = Math.max(1, this.arenas.length);
    return {
      phase: this.current >= this.arenas.length ? "complete" : (runner?.state.phase ?? "waiting"),
      arenaIndex: index,
      arenaId: arena?.id ?? "",
      arenasCleared: Math.min(this.current, this.arenas.length),
      arena: runner?.state ?? { phase: "waiting", waveIndex: -1, cleared: 0, progress: 0 },
      progress: Math.min(1, this.current / total),
    };
  }

  update(dt: number, ctx: ArenaContext): void {
    // LVL-03b: an escaped arena's seal is timed after the arena is over, so
    // it is stepped here for every arena, not only the one being played.
    for (const runner of this.runners) runner.updateSeal(dt);
    if (this.current >= this.arenas.length) return;
    const runner = this.runners[this.current]!;
    runner.update(dt, ctx);
    if (runner.state.phase !== "cleared") return;
    // This arena is down: open the next one, or finish the level.
    this.current++;
    if (this.current < this.arenas.length) {
      this.events.onArenaStart(this.arenas[this.current]!, this.current);
    } else {
      this.events.onLevelCleared();
    }
  }

  /** Try again: the current arena back to waiting with its doors as the
   *  file has them, and every earlier arena still cleared. A restart of the
   *  current arena after the level is complete does nothing: there is no
   *  arena left to fight. */
  resetCurrent(): void {
    if (this.current >= this.arenas.length) return;
    this.runners[this.current]!.reset();
  }

  /** Play again / restart the level: every arena back to waiting. */
  resetAll(): void {
    this.current = 0;
    for (const runner of this.runners) runner.reset();
    this.events.onArenaStart(this.arenas[0] ?? ({} as Arena), 0);
  }
}
