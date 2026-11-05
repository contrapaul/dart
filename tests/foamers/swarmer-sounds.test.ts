import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { NavGrid } from "../../src/ai/nav-grid";
import { FoamerSounds } from "../../src/audio/foamer-sounds";
import type { AudioSink, LoopHandle, PlayOptions } from "../../src/audio/sink";

// GAME-10d: the Swarmer's three sounds. The pack yips when it wakes, a
// nibble is its own line rather than a club's whoosh, and its steps
// skitter rather than thump.

const DT = 1 / 60;

class FakeSink implements AudioSink {
  readonly log: { id: string; opts?: PlayOptions }[] = [];
  play(id: string, opts?: PlayOptions): void {
    this.log.push({ id, opts });
  }
  loop(_id: string, _opts?: PlayOptions): LoopHandle {
    return { set() {}, setPosition() {}, stop() {} };
  }
}

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig(sink: FakeSink) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const ignore = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200));
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  foamers.director = new Director("normal");
  const grid = new NavGrid(RAPIER, world, { minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
  foamers.navGrid = grid;
  world.step();
  grid.bake();
  const sounds = new FoamerSounds(sink, foamers);
  return { world, darts, foamers, sounds };
}

function tick(r: ReturnType<typeof rig>, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
  r.sounds.update(DT);
}

describe("the Swarmer's sounds (GAME-10d stage 3)", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("1. a waking pack yips, and only a swarm member makes that sound", () => {
    const sink = new FakeSink();
    const r = rig(sink);
    const player = new THREE.Vector3(0, 1.6, 0);
    r.foamers.spawnState = "idle";
    const pack = r.foamers.spawnPack(new THREE.Vector3(0, 0, -5), player);
    // The Slowmer, also idle, standing in the player's sight.
    r.foamers.spawn(new THREE.Vector3(0, 0, 4), player);
    // The pack and the Slowmer both see the player at once, so the log is
    // read from the very first step.
    for (let i = 0; i < 30; i++) tick(r, player);
    const yips = sink.log.filter((x) => x.id === "F03-yip");
    expect(yips.length, "the pack yipped").toBeGreaterThan(0);
    expect(yips.length, "at most one yip per member").toBeLessThanOrEqual(pack.length);
    for (const y of yips) expect(y.opts?.position).toBeTruthy();
    // The Slowmer woke too, and stayed quiet: no shared alert sound.
    expect(sink.log.filter((x) => x.id === "FX-alert").length).toBe(0);
  });

  it("2. a nibble has its own line, a swing keeps the F01's", () => {
    const sink = new FakeSink();
    const r = rig(sink);
    const player = new THREE.Vector3(0, 1.6, 0);
    r.foamers.spawnState = "alert";
    r.foamers.spawn(new THREE.Vector3(0, 0, -1), player, "F03");
    for (let i = 0; i < 60 * 6; i++) tick(r, player);
    const ids = sink.log.map((x) => x.id);
    expect(ids, "the nibble").toContain("F03-nibble");
    expect(ids, "not a swing").not.toContain("F01-swing");
  });

  it("3. its steps skitter; the others keep thumping", () => {
    const sink = new FakeSink();
    const r = rig(sink);
    const player = new THREE.Vector3(0, 1.6, 8);
    r.foamers.spawnState = "alert";
    // Out of reach, so both walk and neither attacks.
    r.foamers.spawn(new THREE.Vector3(0, 0, -8), player, "F03");
    r.foamers.spawn(new THREE.Vector3(4, 0, -8), player, "F01");
    for (let i = 0; i < 60 * 3; i++) tick(r, player);
    const ids = sink.log.map((x) => x.id);
    expect(ids, "the skitter").toContain("F03-scurry");
    expect(ids, "the Slowmer's thump").toContain("FX-step-medium");
  });
});
