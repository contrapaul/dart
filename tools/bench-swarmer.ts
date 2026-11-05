// GAME-10d range benchmark, headless: two Swarmer packs (10 alive) in the
// same rig the tests use, stepped at 60 Hz. Times the simulation half of a
// frame (dart + Foamer update + physics step); the renderer is not here.
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { linearColorTable } from "../src/voxel/materials";
import { greedyMesh } from "../src/voxel/mesher";
import { DebrisSystem } from "../src/voxel/debris";
import { DartSystem } from "../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../src/weapons/impacts";
import { FoamerSystem } from "../src/foamers/foamers";
import { Director } from "../src/ai/director";
import { NavGrid } from "../src/ai/nav-grid";

const DT = 1 / 60;
const FRAMES = 600;

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
const ignore = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200));
const colors = linearColorTable();
const mesher = { mesh: (padded: never) => Promise.resolve(greedyMesh(padded, colors)) };
const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
const debris = new DebrisSystem(RAPIER, world);
const targets: VoxelTarget[] = [];
const foamers = new FoamerSystem(RAPIER, world, mesher as never, debris, darts, targets);
new DartImpacts(darts, debris, targets);
foamers.director = new Director("normal");
const grid = new NavGrid(RAPIER, world, { minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
foamers.navGrid = grid;
foamers.spawnState = "alert";
world.step();
grid.bake();
const player = new THREE.Vector3(0, 1.6, 0);
const a = foamers.spawnPack(new THREE.Vector3(-3, 0, -4), player);
const b = foamers.spawnPack(new THREE.Vector3(3, 0, -4), player);
console.log(`spawned ${a.length + b.length} Swarmers, ${foamers.list.length} live`);

let worst = 0;
const samples: number[] = [];
for (let i = 0; i < FRAMES; i++) {
  const t0 = performance.now();
  darts.update(DT);
  foamers.update(DT, player);
  world.step();
  const ms = performance.now() - t0;
  worst = Math.max(worst, ms);
  if (i >= 60) samples.push(ms);
}
samples.sort((x, y) => x - y);
// The first frames include the mesh worker's warm-up, so the figures are
// taken after a second of frames.
const mean = samples.reduce((x, y) => x + y, 0) / samples.length;
const p95 = samples[Math.floor(samples.length * 0.95)]!;
console.log(`frames ${FRAMES}: mean ${mean.toFixed(2)} ms, median ${samples[Math.floor(samples.length / 2)]!.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, worst ${worst.toFixed(2)} ms`);
console.log(`live ${foamers.list.length}, nibbles ${foamers.stats.bonks}, spawned ${foamers.stats.spawned}`);
console.log("headless: simulation only, no renderer");
