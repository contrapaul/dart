import { afterEach, describe, expect, it } from "vitest";
import { VoxelVolume, chunkKey } from "../../src/voxel/chunk";
import { buildPadded, greedyMesh } from "../../src/voxel/mesher";
import { linearColorTable } from "../../src/voxel/materials";
import { MesherPool } from "../../src/voxel/mesher-pool";

// PT-09: a Foamer part must always finish meshing, in every browser. A worker
// that fails to start, throws, or sends a reply that cannot be cloned is
// replaced by a main-thread mesh of the same job.

const colors = linearColorTable();

/** A real job: a padded chunk with a few voxels in it. */
function paddedJob(seed: number) {
  const v = new VoxelVolume(seed);
  v.set(3, 4, 5, 1);
  v.set(3, 4, 6, 2);
  v.set(9, 2, 7, 3);
  const chunk = v.chunks.get(chunkKey(0, 0, 0))!;
  return buildPadded(v, 0, 0, 0, chunk);
}

function sameMesh(a: ReturnType<typeof greedyMesh>, b: ReturnType<typeof greedyMesh>) {
  expect([...a.positions]).toEqual([...b.positions]);
  expect([...a.indices]).toEqual([...b.indices]);
  expect([...a.colors]).toEqual([...b.colors]);
}

/** A fake Worker: nothing runs, the test drives its callbacks. */
class FakeWorker {
  static made: FakeWorker[] = [];
  static throwOnConstruction = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  posted: { id: number; padded: Uint8Array }[] = [];
  terminated = false;

  constructor() {
    if (FakeWorker.throwOnConstruction) throw new Error("no module workers here");
    FakeWorker.made.push(this);
  }

  postMessage(msg: { id: number; padded: Uint8Array }) {
    this.posted.push(msg);
  }

  terminate() {
    this.terminated = true;
  }

  /** Answer the newest job the way the real worker does. */
  answerWithMesh() {
    const last = this.posted[this.posted.length - 1];
    const mesh = greedyMesh(last.padded, colors);
    this.onmessage?.({ data: { id: last.id, mesh, ms: 1 } });
  }

  fail(message = "worker blew up") {
    this.onerror?.({ message });
  }
}

function install(factory: new (...args: unknown[]) => unknown) {
  const g = globalThis as Record<string, unknown>;
  const priorWorker = g.Worker;
  const priorNav = g.navigator;
  g.Worker = factory;
  Object.defineProperty(g, "navigator", { value: { hardwareConcurrency: 5 }, configurable: true });
  return () => {
    g.Worker = priorWorker;
    Object.defineProperty(g, "navigator", { value: priorNav, configurable: true });
    FakeWorker.made = [];
    FakeWorker.throwOnConstruction = false;
  };
}

let uninstall: (() => void) | null = null;
afterEach(() => {
  uninstall?.();
  uninstall = null;
});

describe("MesherPool (PT-09)", () => {
  it("a normal worker path is unchanged: one post, the reply is the result", async () => {
    uninstall = install(FakeWorker);
    const pool = new MesherPool(1);
    expect(FakeWorker.made).toHaveLength(1);
    const padded = paddedJob(1);
    const expected = greedyMesh(padded.slice(), colors);
    const done = pool.mesh(padded);
    expect(pool.busy).toBe(1);
    expect(FakeWorker.made[0].posted).toHaveLength(1);
    FakeWorker.made[0].answerWithMesh();
    sameMesh(await done, expected);
    expect(pool.busy).toBe(0);
    expect(pool.recentMs).toEqual([1]);
  });

  it("a worker whose onerror fires still finishes its job, with the mesh the worker would have made", async () => {
    uninstall = install(FakeWorker);
    const pool = new MesherPool(2);
    const warm = pool.mesh(paddedJob(2));
    const padded = paddedJob(3);
    const expected = greedyMesh(padded.slice(), colors);
    const job = pool.mesh(padded);
    // The first worker dies on its job.
    FakeWorker.made[0].fail();
    // The other worker answers the first job.
    FakeWorker.made[1].answerWithMesh();
    await warm;
    sameMesh(await job, expected);
    expect(pool.busy).toBe(0);
    expect(FakeWorker.made[0].terminated).toBe(true);
  });

  it("a worker whose reply cannot be cloned still finishes its job", async () => {
    uninstall = install(FakeWorker);
    const pool = new MesherPool(1);
    const padded = paddedJob(4);
    const job = pool.mesh(padded);
    FakeWorker.made[0].onmessageerror?.();
    expect((await job).positions.length).toBeGreaterThan(0);
    expect(pool.busy).toBe(0);
  });

  it("a pool whose workers throw on construction still meshes everything", async () => {
    FakeWorker.throwOnConstruction = true;
    uninstall = install(FakeWorker);
    const pool = new MesherPool(3);
    expect(FakeWorker.made).toHaveLength(0);
    const padded = paddedJob(5);
    sameMesh(await pool.mesh(padded), greedyMesh(padded.slice(), colors));
    expect(pool.busy).toBe(0);
  });

  it("after every worker has failed, later jobs go to the main thread too", async () => {
    uninstall = install(FakeWorker);
    const pool = new MesherPool(2);
    const a = pool.mesh(paddedJob(6));
    const b = pool.mesh(paddedJob(7));
    FakeWorker.made[0].fail();
    FakeWorker.made[1].fail();
    await Promise.all([a, b]);
    const padded = paddedJob(8);
    sameMesh(await pool.mesh(padded), greedyMesh(padded.slice(), colors));
  });

  it("a worker that fails keeps no late reply: a stale message is ignored", async () => {
    uninstall = install(FakeWorker);
    const pool = new MesherPool(1);
    const job = pool.mesh(paddedJob(9));
    const w = FakeWorker.made[0];
    const stale = w.posted[0];
    w.fail();
    const mesh = greedyMesh(stale.padded.slice(), colors);
    w.onmessage?.({ data: { id: stale.id, mesh, ms: 99 } });
    expect((await job).positions.length).toBeGreaterThan(0);
    expect(pool.recentMs).not.toContain(99);
  });
});
