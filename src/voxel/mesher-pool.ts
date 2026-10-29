import type { MeshData } from "./mesher";

// A small pool of mesher workers so remeshing never stalls the main thread.

export class MesherPool {
  /** Worker-side milliseconds of the most recent jobs, for profiling. */
  readonly recentMs: number[] = [];

  private idle: Worker[] = [];
  private queue: { padded: Uint8Array; resolve: (m: MeshData) => void }[] = [];
  private pending = new Map<number, (m: MeshData) => void>();
  private nextId = 0;

  constructor(size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL("./mesher.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<{ id: number; mesh: MeshData; ms: number }>) => {
        this.recentMs.push(e.data.ms);
        if (this.recentMs.length > 100) this.recentMs.shift();
        this.pending.get(e.data.id)!(e.data.mesh);
        this.pending.delete(e.data.id);
        this.idle.push(w);
        this.pump();
      };
      this.idle.push(w);
    }
  }

  /** The padded buffer is transferred to the worker and unusable afterwards. */
  mesh(padded: Uint8Array) {
    return new Promise<MeshData>((resolve) => {
      this.queue.push({ padded, resolve });
      this.pump();
    });
  }

  get busy() {
    return this.pending.size + this.queue.length;
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      const id = this.nextId++;
      this.pending.set(id, job.resolve);
      w.postMessage({ id, padded: job.padded }, [job.padded.buffer]);
    }
  }
}
