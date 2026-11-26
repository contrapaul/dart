import type { Vec3 } from "./format";

// ED-31: triggers move things. The math is pure: the page registers one
// apply callback per thing, and a move eases a vertical-axis offset and turn
// from where the thing is now to where the trigger sends it. Nothing here
// knows what a mesh, a collider or a button is, and `update` allocates
// nothing (the eased value is written into each job's own array).

/** Applies a thing's move: an offset in metres and a turn in radians about
 *  its own centre. The numbers are the mover's scratch: copy what you keep. */
export type MoverApply = (x: number, y: number, z: number, turn: number) => void;

const DEG = Math.PI / 180;

/** Smoothstep: zero slope at both ends, which is the plan's "eased". */
export function ease(u: number): number {
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  return t * t * (3 - 2 * t);
}

/** A point turned `turn` radians about a vertical axis through `centre`,
 *  written into `out`. The button mounted on a moving thing rides on it. */
export function turnAbout(out: Vec3, centre: Vec3, point: Vec3, turn: number): Vec3 {
  const dx = point[0] - centre[0];
  const dz = point[2] - centre[2];
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  out[0] = centre[0] + dx * c + dz * s;
  out[1] = point[1];
  out[2] = centre[2] - dx * s + dz * c;
  return out;
}

/** One thing's current move. Positions and turns are absolute offsets and
 *  angles from the thing's rest transform, so a restart can start there. */
interface Job {
  id: string;
  from: Vec3;
  to: Vec3;
  fromTurn: number;
  toTurn: number;
  /** Where it is now: what `update` reads and what a restart starts from. */
  at: Vec3;
  turn: number;
  seconds: number;
  elapsed: number;
  running: boolean;
}

export class Movers {
  private readonly applies = new Map<string, MoverApply>();
  private readonly jobOf = new Map<string, Job>();
  /** Every job ever started, so `update` loops an array: no allocation. */
  private readonly jobs: Job[] = [];

  /** A thing a move may name. A later card's kind plugs in here. */
  register(id: string, apply: MoverApply): void {
    this.applies.set(id, apply);
  }

  has(id: string): boolean {
    return this.applies.has(id);
  }

  /** Move `ids` by `by` metres and `turnDeg` degrees about Y, over `seconds`.
   *  A thing already moving starts its new move from where it is now. */
  start(ids: string[], by: Vec3, turnDeg: number, seconds: number): void {
    for (const id of ids) this.startOne(id, by, turnDeg, seconds);
  }

  private startOne(id: string, by: Vec3, turnDeg: number, seconds: number): void {
    if (!this.applies.has(id)) return;
    let job = this.jobOf.get(id);
    if (!job) {
      job = {
        id, from: [0, 0, 0], to: [0, 0, 0], fromTurn: 0, toTurn: 0,
        at: [0, 0, 0], turn: 0, seconds: 1, elapsed: 0, running: false,
      };
      this.jobOf.set(id, job);
      this.jobs.push(job);
    }
    // Where it is now is where the new move starts: a repeat trigger moves
    // again from the thing's current spot, never snapping back to rest.
    const from = job.at;
    job.from = [from[0], from[1], from[2]];
    job.fromTurn = job.turn;
    job.to = [from[0] + by[0], from[1] + by[1], from[2] + by[2]];
    job.toTurn = job.turn + turnDeg * DEG;
    job.seconds = seconds > 0 ? seconds : 1;
    job.elapsed = 0;
    job.running = true;
  }

  /** Advance every running move. A job that just finished stays where it
   *  landed, so a later move starts from there. */
  update(dt: number): void {
    if (dt <= 0) return;
    for (const job of this.jobs) {
      if (!job.running) continue;
      job.elapsed += dt;
      const u = job.elapsed / job.seconds;
      const k = ease(u);
      job.at[0] = job.from[0] + (job.to[0] - job.from[0]) * k;
      job.at[1] = job.from[1] + (job.to[1] - job.from[1]) * k;
      job.at[2] = job.from[2] + (job.to[2] - job.from[2]) * k;
      job.turn = job.fromTurn + (job.toTurn - job.fromTurn) * k;
      this.applies.get(job.id)?.(job.at[0], job.at[1], job.at[2], job.turn);
      if (u >= 1) job.running = false;
    }
  }

  /** Back to rest (a restart of the level): every thing is applied at its
   *  rest transform with no offset and no turn. */
  reset(): void {
    for (const job of this.jobs) {
      job.at[0] = job.at[1] = job.at[2] = 0;
      job.turn = 0;
      job.running = false;
      this.applies.get(job.id)?.(0, 0, 0, 0);
    }
  }

  /** For the tests and the dev hook. */
  isMoving(id: string): boolean {
    return this.jobOf.get(id)?.running ?? false;
  }

  /** The current offset and turn of a thing, for a test. */
  offsetOf(id: string): { at: Vec3; turn: number } | null {
    const job = this.jobOf.get(id);
    return job ? { at: [job.at[0], job.at[1], job.at[2]], turn: job.turn } : null;
  }
}
