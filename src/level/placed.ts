import * as THREE from "three";
import type { PlacedFoamer } from "./format";

// ED-01: the Foamers a level places by hand (design/EDITOR.md section 6).
// They go in through the same spawn the arena's waves use, so they stand,
// fight and die like any other Foamer. What differs is when they wake:
//
// sight    spawns at once, idle: its brain wakes it the moment it sees the
//          player within data/ai.json's sight range (the idle state every
//          Foamer brain already has).
// trigger  and any `hidden` one are not built at all until a trigger wakes
//          it, so nothing of them is drawn, collided or counted in the
//          meantime. ED-07's trigger runner calls wake().
//
// Spawning happens when the level loads and again on every restart, so a
// restart puts the placed ones back exactly as the file has them.

/** Just the part of FoamerSystem this needs: a spawn, and where a plain
 *  spawn starts (`spawnState`, which the arena page sets to "alert"). */
export interface FoamerSpawner {
  spawnState: "idle" | "alert";
  spawn(
    feet: THREE.Vector3, facing?: THREE.Vector3, type?: string, promoted?: boolean,
  ): { yaw: number } | null;
}

/** The file's yaw (radians about Y, 0 faces -z) as the point a Foamer
 *  should face. A Foamer's own yaw 0 looks along +z, so the two differ by
 *  half a turn; spawning toward a point one metre away is how the arena
 *  spawns toward the player. */
function facingOf(pos: readonly [number, number, number], yaw: number): THREE.Vector3 {
  return new THREE.Vector3(
    pos[0] - Math.sin(yaw), pos[1], pos[2] - Math.cos(yaw),
  );
}

export class PlacedFoamers {
  /** The placed Foamers still waiting for a trigger, by id. */
  private readonly waiting = new Map<string, PlacedFoamer>();
  /** The ids that have been spawned since the last restart. */
  private readonly up = new Set<string>();
  private readonly feet = new THREE.Vector3();

  constructor(
    private readonly placed: readonly PlacedFoamer[],
    private readonly foamers: FoamerSpawner,
  ) {}

  /** How many are standing in the level right now. */
  get spawned(): number {
    return this.up.size;
  }

  /** The ids still waiting for a trigger, in file order. */
  get waitingIds(): string[] {
    return this.placed.filter((f) => this.waiting.has(f.id)).map((f) => f.id);
  }

  /** Spawns every placed Foamer that starts awake. Called on load and on
   *  every restart, so the waiting ones go back to waiting. */
  spawnAll(): void {
    this.waiting.clear();
    this.up.clear();
    for (const f of this.placed) {
      // A trigger woken Foamer, or a hidden one, is not on the board until
      // its trigger names it (ED-07).
      if (f.hidden || f.wake === "trigger") {
        this.waiting.set(f.id, f);
        continue;
      }
      this.spawnOne(f, "idle");
    }
  }

  /** Wakes the named placed Foamers. Returns how many were still waiting,
   *  so a trigger can tell whether it did anything. */
  wake(ids: readonly string[]): number {
    let woken = 0;
    for (const id of ids) {
      const f = this.waiting.get(id);
      if (!f) continue;
      this.waiting.delete(id);
      this.spawnOne(f, "alert");
      woken++;
    }
    return woken;
  }

  private spawnOne(f: PlacedFoamer, state: "idle" | "alert") {
    // The FoamerSystem's start state is one setting for all of its spawns,
    // so a sight woken one is spawned while it reads "idle" and the arena's
    // own "alert" is put back straight after. A trigger wake is already in
    // the fight, so it spawns the level's normal way.
    const was = this.foamers.spawnState;
    this.foamers.spawnState = state;
    this.feet.set(f.pos[0], f.pos[1], f.pos[2]);
    const made = this.foamers.spawn(this.feet, facingOf(f.pos, f.yaw), f.foamer, f.promoted);
    this.foamers.spawnState = was;
    // At the cap the id stays waiting, so a later trigger can still wake it.
    if (!made) {
      this.waiting.set(f.id, f);
      return;
    }
    this.up.add(f.id);
  }
}
