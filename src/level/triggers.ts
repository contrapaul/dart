// ED-07a: the trigger runner (design/EDITOR.md section 3), the level's
// "when this happens, do that" logic. Plain TypeScript: no Three.js, no
// DOM, no Math.random. The page owns the world and hands the runner a
// TriggerHost with one method per trigger action, so nothing here knows
// what a mesh or a Foamer is. A trigger fires once unless `repeat`; its
// do list runs in order. All arrays are built in the constructor and
// `update` only loops them, so no allocation once running.

import type { Level, Trigger, TriggerDo, Vec3, Zone } from "./format";
import tuning from "../../data/editor.json";

const T = tuning as unknown as {
  triggerDefaults: { messageSeconds: number };
};

export interface TriggerHost {
  /** Spawn one Foamer at a spawn point; `tag` is the spawn action's id,
   *  and the Foamer's deaths come back to the runner under that tag. */
  spawnOne(foamer: string, at: string, tag: string, promoted: boolean): void;
  wake(ids: string[]): void;
  show(ids: string[]): void;
  hide(ids: string[]): void;
  open(door: string): void;
  close(door: string): void;
  message(text: string, seconds: number): void;
  checkpoint(pos: Vec3, yaw: number): void;
}

/** One in-flight `spawn` do: round robin over `at`, `hold` seconds apart,
 *  the first one at once. */
interface SpawnJob {
  id: string;
  foamer: string;
  at: string[];
  promoted: boolean;
  hold: number;
  nextAt: number;
  nextIdx: number;
  remaining: number;
  active: boolean;
}

export class TriggerRunner {
  readonly level: Level;
  readonly host: TriggerHost;

  private readonly triggers: Trigger[];
  private readonly repeat: boolean[];
  private readonly fired: boolean[];
  private readonly isZone: boolean[];
  private readonly zoneBox: (Zone | null)[];
  private readonly inside: boolean[];
  private readonly isKilled: boolean[];
  private readonly killSet: Set<string>[];
  private readonly counts: number[];
  private readonly need: number[];
  private readonly isAfter: boolean[];
  private readonly afterParent: string[];
  private readonly afterSecs: number[];
  private readonly afterAt: number[];
  private readonly jobSlot: number[][];
  private readonly jobs: SpawnJob[];

  private clock = 0;
  private started = false;
  private firing = false;
  /** Fires deferred while one is running (a do effect that reports a press
   *  or kill in the same call). */
  private readonly queued: number[] = [];

  constructor(level: Level, host: TriggerHost) {
    this.level = level;
    this.host = host;
    this.triggers = level.triggers ?? [];
    const n = this.triggers.length;
    this.repeat = new Array(n).fill(false);
    this.fired = new Array(n).fill(false);
    this.isZone = new Array(n).fill(false);
    this.zoneBox = new Array(n).fill(null);
    this.inside = new Array(n).fill(false);
    this.isKilled = new Array(n).fill(false);
    this.killSet = new Array(n);
    this.counts = new Array(n).fill(0);
    this.need = new Array(n).fill(0);
    this.isAfter = new Array(n).fill(false);
    this.afterParent = new Array(n).fill("");
    this.afterSecs = new Array(n).fill(0);
    this.afterAt = new Array(n).fill(NaN);
    this.jobSlot = new Array(n);
    this.jobs = [];

    // Each spawn action's count, so a `killed` trigger's "all" total
    // counts every Foamer a named spawn will make.
    const spawnCount = new Map<string, number>();
    for (const t of this.triggers) {
      for (const d of t.do) if (d.kind === "spawn") spawnCount.set(d.id, d.count);
    }

    for (let i = 0; i < n; i++) {
      const t = this.triggers[i];
      this.repeat[i] = t.repeat === true;
      const w = t.when;
      if (w.kind === "enter") {
        this.isZone[i] = true;
        this.zoneBox[i] = (level.zones ?? []).find((z) => z.id === w.zone) ?? null;
      } else if (w.kind === "killed") {
        this.isKilled[i] = true;
        this.killSet[i] = new Set(w.ids);
        let total = 0;
        for (const id of w.ids) total += spawnCount.get(id) ?? 1;
        this.need[i] = w.count ?? total;
      } else if (w.kind === "after") {
        this.isAfter[i] = true;
        this.afterParent[i] = w.trigger;
        this.afterSecs[i] = w.seconds;
      }
      const row: number[] = [];
      for (const d of t.do) {
        if (d.kind === "spawn") {
          row.push(this.jobs.length);
          this.jobs.push({
            id: d.id, foamer: d.foamer, at: d.at,
            promoted: d.promoted === true, hold: d.holdSeconds ?? 0,
            nextAt: 0, nextIdx: 0, remaining: d.count, active: false,
          });
        } else {
          row.push(-1);
        }
      }
      this.jobSlot[i] = row;
    }
  }

  /** Fires the "start" triggers. Call once, when the level begins. */
  start(): void {
    if (this.started) return;
    this.started = true;
    for (let i = 0; i < this.triggers.length; i++) {
      if (this.triggers[i].when.kind === "start") this.fire(i);
    }
  }

  /** Zones (player feet inside a zone box: fires on entering, not while
   *  standing in it), "after" timers and spawn holds. */
  update(dt: number, playerFeet: Vec3): void {
    if (!this.started || dt <= 0) return;
    this.clock += dt;

    for (let i = 0; i < this.triggers.length; i++) {
      if (this.isZone[i]) {
        const z = this.zoneBox[i];
        const inNow = z !== null && insideBox(playerFeet, z);
        if (inNow && !this.inside[i] && (this.repeat[i] || !this.fired[i])) {
          this.fire(i);
        }
        this.inside[i] = inNow;
      }
    }
    for (let i = 0; i < this.triggers.length; i++) {
      if (this.isAfter[i]) {
        const at = this.afterAt[i];
        if (Number.isNaN(at)) continue;
        if (this.clock < at) continue;
        this.afterAt[i] = NaN;
        this.fire(i);
      }
    }
    for (let i = 0; i < this.triggers.length; i++) {
      if (
        this.isKilled[i] && this.need[i] > 0 &&
        this.counts[i] >= this.need[i] &&
        (this.repeat[i] || !this.fired[i])
      ) {
        this.counts[i] = 0;
        this.fire(i);
      }
    }
    for (const job of this.jobs) this.advance(job);
  }

  /** A Foamer died. `tag` is its placed id, or the spawn action id that
   *  made it; every `killed` trigger that counts the tag re-checks on the
   *  next `update` (a kill before the set can fire still counts). */
  killed(tag: string): void {
    for (let i = 0; i < this.triggers.length; i++) {
      if (this.isKilled[i] && this.killSet[i].has(tag)) this.counts[i] += 1;
    }
  }

  /** A button was pressed. */
  pressed(button: string): void {
    this.onEvent("button", button);
  }

  /** A pickup was taken. */
  taken(pickup: string): void {
    this.onEvent("pickup", pickup);
  }

  /** Back to the level's start state (a restart): start again with `start`. */
  reset(): void {
    this.started = false;
    this.clock = 0;
    this.queued.length = 0;
    for (let i = 0; i < this.fired.length; i++) {
      this.fired[i] = false;
      this.inside[i] = false;
      this.counts[i] = 0;
      this.afterAt[i] = NaN;
    }
    for (const job of this.jobs) {
      job.active = false;
      job.remaining = 0;
      job.nextIdx = 0;
      job.nextAt = 0;
    }
  }

  // Internals: event dispatch, firing, the do effects.

  /** "pressed"/"taken": fire every trigger listening on that id. */
  private onEvent(field: "button" | "pickup", id: string): void {
    for (let i = 0; i < this.triggers.length; i++) {
      const w = this.triggers[i].when;
      if (field === "button") {
        if (w.kind !== "pressed" || w.button !== id) continue;
      } else {
        if (w.kind !== "taken" || w.pickup !== id) continue;
      }
      if (this.repeat[i] || !this.fired[i]) this.fire(i);
    }
  }

  private fire(i: number): void {
    if (this.firing) {
      this.queued.push(i);
      return;
    }
    this.fireOne(i);
  }

  private fireOne(i: number): void {
    this.firing = true;
    this.fired[i] = true;
    this.runDoList(i);
    this.startAfters(this.triggers[i].id);
    // Do effects that fired something else in the same call run now (rare:
    // a host that reports a press or kill inside a spawn). The guard keeps
    // a cyclic level from recursing forever.
    let guard = 0;
    while (this.queued.length > 0 && guard++ < 64) {
      const j = this.queued.shift();
      if (j === undefined) break;
      if (this.repeat[j] || !this.fired[j]) this.fireOne(j);
    }
    if (this.queued.length > 0) this.queued.length = 0;
    this.firing = false;
  }

  /** Run the do list in order. A repeat trigger fires it again later. */
  private runDoList(i: number): void {
    const t = this.triggers[i];
    const rows = this.jobSlot[i];
    for (let d = 0; d < t.do.length; d++) {
      const do_ = t.do[d];
      if (do_.kind === "spawn") {
        const job = this.jobs[rows[d]];
        job.active = do_.count > 0;
        job.remaining = do_.count;
        job.nextIdx = 0;
        job.nextAt = this.clock;
        this.advance(job); // the first is at once; hold 0 means all at once
      } else {
        this.simpleDo(do_);
      }
    }
  }

  /** Issues the spawnOne calls whose time has come for this job. `update`
   *  drags it for every active job, and a fired trigger drags its own job at
   *  once, so the first Foamer is at once and each next one `hold` seconds
   *  later (0: all at once). */
  private advance(job: SpawnJob): void {
    if (!job.active || job.remaining <= 0) return;
    while (job.remaining > 0 && this.clock >= job.nextAt) {
      this.host.spawnOne(
        job.foamer, job.at[job.nextIdx % job.at.length], job.id,
        job.promoted,
      );
      job.nextIdx += 1;
      job.remaining -= 1;
      if (job.remaining > 0) job.nextAt += job.hold;
    }
    if (job.remaining <= 0) job.active = false;
  }

  private simpleDo(d: TriggerDo): void {
    const h = this.host;
    switch (d.kind) {
      case "wake": h.wake(d.ids); break;
      case "show": h.show(d.ids); break;
      case "hide": h.hide(d.ids); break;
      case "open": h.open(d.door); break;
      case "close": h.close(d.door); break;
      case "message": h.message(d.text, d.seconds ?? T.triggerDefaults.messageSeconds); break;
      case "checkpoint": h.checkpoint(d.pos, d.yaw); break;
      default: break;
    }
  }

  /** Every "after" trigger whose named trigger just fired starts, or
   *  restarts, its clock: the card's rule is "after fires seconds after the
   *  named trigger fired (each time, if that one repeats)", so the re-arm
   *  follows the parent, not the after's own repeat flag. */
  private startAfters(parentId: string): void {
    for (let i = 0; i < this.triggers.length; i++) {
      if (!this.isAfter[i] || this.afterParent[i] !== parentId) continue;
      this.afterAt[i] = this.clock + this.afterSecs[i];
    }
  }
}

/** Player feet inside a zone box (position the centre, size the full
 *  extents). */
function insideBox(feet: Vec3, box: Zone): boolean {
  return (
    feet[0] >= box.pos[0] - box.size[0] / 2 &&
    feet[0] <= box.pos[0] + box.size[0] / 2 &&
    feet[1] >= box.pos[1] - box.size[1] / 2 &&
    feet[1] <= box.pos[1] + box.size[1] / 2 &&
    feet[2] >= box.pos[2] - box.size[2] / 2 &&
    feet[2] <= box.pos[2] + box.size[2] / 2
  );
}
