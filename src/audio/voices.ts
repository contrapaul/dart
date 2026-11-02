// AUD-01 stage 1: VoicePool, the pure logic that decides whether a sound
// may start and which playing voice to steal. No Web Audio here. Fixed
// arrays sized maxTotal, no allocation per call (the return object is
// reused by the caller).

import { makeRng } from "./synth";

export interface VoiceState {
  id: string;
  started: number;   // the call clock in seconds
  isLoop: boolean;
  busy: boolean;
}

export interface StartResult {
  voice: number;    // the slot to use for the new voice
  stop: number | null; // the slot to stop if the new one stole it, else null
}

export class VoicePool {
  readonly maxTotal: number;
  /** Fixed slots; the engine fills them in, this only books them. */
  readonly slots: VoiceState[];

  constructor(maxTotal: number) {
    this.maxTotal = maxTotal;
    this.slots = new Array(maxTotal);
    for (let i = 0; i < maxTotal; i++) {
      this.slots[i] = { id: "", started: 0, isLoop: false, busy: false };
    }
  }

  /** How many slots are playing right now. */
  playingCount(): number {
    let n = 0;
    for (let i = 0; i < this.maxTotal; i++) if (this.slots[i].busy) n++;
    return n;
  }

  idOf(voice: number): string {
    return this.slots[voice].id;
  }

  isLoop(voice: number): boolean {
    return this.slots[voice].isLoop;
  }

  /** Book a voice for id after maxForId of it are already playing.
   *
   * Rules:
   * - if id already has maxForId playing, the oldest one of that id is
   *   stopped and its slot reused;
   * - else if a free slot exists, take it;
   * - else if every slot is busy, the oldest one-shot overall is stopped
   *   and its slot reused. Loops are never stolen; if only loops remain
   *   there is no valid steal and the call is rejected with null.
   *
   * toStart marks the slot a loop; the engine passes true for loops,
   * which are at most one per id in practice but still respect the rules. */
  start(id: string, maxForId: number, now: number, isLoop = false): StartResult | null {
    // Oldest playing voice of this id.
    let sameCount = 0;
    let sameOldest = -1;
    let sameOldestT = Infinity;
    for (let i = 0; i < this.maxTotal; i++) {
      const v = this.slots[i];
      if (v.busy && v.id === id) {
        sameCount++;
        if (v.started < sameOldestT) { sameOldestT = v.started; sameOldest = i; }
      }
    }
    if (sameCount >= maxForId && sameOldest >= 0) {
      return this.occupy(sameOldest, id, now, isLoop, true);
    }
    // A free slot.
    for (let i = 0; i < this.maxTotal; i++) {
      if (!this.slots[i].busy) return this.occupy(i, id, now, isLoop, false);
    }
    // Full: the oldest one-shot overall. Loops are never stolen.
    let steal = -1;
    let stealT = Infinity;
    for (let i = 0; i < this.maxTotal; i++) {
      const v = this.slots[i];
      if (v.busy && !v.isLoop && v.started < stealT) { stealT = v.started; steal = i; }
    }
    if (steal < 0) return null;   // only loops are playing; nothing to take
    return this.occupy(steal, id, now, isLoop, true);
  }

  /** Free a slot. Safe on a free or unknown slot. */
  end(voice: number): void {
    if (voice < 0 || voice >= this.maxTotal) return;
    this.slots[voice] = { id: "", started: 0, isLoop: false, busy: false };
  }

  private occupy(slot: number, id: string, now: number, isLoop: boolean,
                 stole: boolean): StartResult {
    this.slots[slot] = { id, started: now, isLoop, busy: true };
    return { voice: slot, stop: stole ? slot : null };
  }
}

// ---- take picking ----

/** Pick a take index from `takes` numbered 0 to takes-1, never the same
 *  as `last` when there are two or more. Pure and deterministic in rng;
 *  with one take it is always take 0. */
export function pickTake(takes: number, last: number, rng: () => number): number {
  if (takes <= 1) return 0;
  let pick = Math.floor(rng() * takes);
  while (pick === last) pick = Math.floor(rng() * takes);
  return pick;
}

/** A take picker bound to a take count and to its own seeded rng. The
 *  engine keeps one of these per sound; start resets the last pick so a
 *  long gap starts fresh. The `last` index persists across picks so a
 *  sound never plays the same take twice in a row while it keeps
 *  sounding. */
export function makeTakePicker(takes: number, seed = 1): {
  pick(): number;
  reset(): void;
} {
  const rng = makeRng(seed);
  let last = -1;
  return {
    pick(): number {
      const n = pickTake(takes, last, rng);
      last = n;
      return n;
    },
    reset(): void { last = -1; },
  };
}
