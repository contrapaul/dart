import { greedyMesh, type MeshData } from "./mesher";
import { linearColorTable } from "./materials";

// A small pool of mesher workers so remeshing never stalls the main thread.
//
// A part must always finish meshing: a job whose worker fails to start,
// throws, or whose reply cannot be cloned is meshed on the main thread with
// the same greedyMesh call instead, so its VolumeMesh never stays busy and
// the part is drawn and gets a collider. Run with no workers (a browser that
// refuses module workers): everything is meshed on the main thread.

/** A worker job, kept so it can be meshed here if its worker fails. */
interface Job {
  padded: Uint8Array;
  resolve: (m: MeshData) => void;
}

/** A worker and the job it is on (null when idle). */
interface Slot {
  worker: Worker | null;
  job: Job | null;
  id: number;
}

export class MesherPool {
  /** Worker-side milliseconds of the most recent jobs, for profiling. */
  readonly recentMs: number[] = [];

  private slots: Slot[] = [];
  private idle: Slot[] = [];
  private queue: Job[] = [];
  private colors: Float32Array | null = null;
  /** True once no worker could be made: every job is meshed here. */
  private noWorkers = false;

  constructor(size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))) {
    for (let i = 0; i < size; i++) {
      let worker: Worker;
      try {
        worker = new Worker(new URL("./mesher.worker.ts", import.meta.url), { type: "module" });
      } catch (err) {
        // A browser that cannot start module workers. Nothing to recover:
        // mesh on this thread from now on.
        console.warn("mesher: no module workers, meshing on the main thread", err);
        this.noWorkers = true;
        break;
      }
      const slot: Slot = { worker, job: null, id: -1 };
      worker.onmessage = (e: MessageEvent<{ id: number; mesh: MeshData; ms: number }>) => {
        // Ignore a late reply from a worker that already failed its job.
        const job = slot.job;
        if (!job || e.data.id !== slot.id) return;
        this.recentMs.push(e.data.ms);
        if (this.recentMs.length > 100) this.recentMs.shift();
        this.finish(slot);
        job.resolve(e.data.mesh);
      };
      // A worker that cannot load (a bad import, a blocked script) or that
      // throws while meshing reports here and never answers: mesh that job
      // here so the part still finishes.
      worker.onerror = (e) => {
        this.fail(slot, e.message || "worker error");
      };
      worker.onmessageerror = () => {
        this.fail(slot, "worker reply could not be cloned");
      };
      this.slots.push(slot);
      this.idle.push(slot);
    }
    if (this.slots.length === 0) this.noWorkers = true;
  }

  /** The padded buffer is transferred to the worker and unusable afterwards. */
  mesh(padded: Uint8Array) {
    return new Promise<MeshData>((resolve) => {
      const job: Job = { padded, resolve };
      if (this.noWorkers) {
        this.meshHere(job);
        return;
      }
      this.queue.push(job);
      this.pump();
    });
  }

  get busy() {
    return this.queue.length + this.slots.filter((s) => s.job).length;
  }

  /** Mesh a job on this thread. The same call the worker makes. */
  private meshHere(job: Job) {
    this.colors ??= linearColorTable();
    job.resolve(greedyMesh(job.padded, this.colors));
  }

  /** Mark a slot's job done and give the worker the next one. */
  private finish(slot: Slot) {
    slot.job = null;
    this.idle.push(slot);
    this.pump();
  }

  /** A worker that failed is dropped (one that throws once usually throws
   *  again) and its job is meshed here; the rest of the pool carries on. */
  private fail(slot: Slot, cause: string) {
    console.warn(`mesher: ${cause}, meshing the part on the main thread`);
    const job = slot.job;
    slot.job = null;
    const i = this.idle.indexOf(slot);
    if (i >= 0) this.idle.splice(i, 1);
    try {
      slot.worker?.terminate();
    } catch {
      // Already dead.
    }
    const at = this.slots.indexOf(slot);
    if (at >= 0) this.slots.splice(at, 1);
    if (this.slots.length === 0) this.noWorkers = true;
    if (job) this.meshHere(job);
    this.pump();
  }

  private pump() {
    if (this.noWorkers) {
      while (this.queue.length) this.meshHere(this.queue.shift()!);
      return;
    }
    while (this.idle.length && this.queue.length) {
      const slot = this.idle.pop()!;
      const job = this.queue.shift()!;
      slot.job = job;
      slot.id++;
      try {
        const copy = job.padded.slice();
        slot.worker!.postMessage({ id: slot.id, padded: job.padded }, [job.padded.buffer]);
        // The worker owns the transferred buffer now; keep the copy in case
        // the worker fails and the job has to run here.
        job.padded = copy;
      } catch (err) {
        this.fail(slot, `postMessage failed (${String(err)})`);
      }
    }
  }
}
