import * as THREE from "three";
import { createRenderer } from "./render/scene";
import { createPhysics, SOLID_QUERY_GROUPS } from "./physics/world";
import { startLoop } from "./core/loop";
import { Input } from "./core/input";
import { PlayerController } from "./player/controller";
import { DartSystem } from "./weapons/darts";
import { Blaster, type BlasterSpec } from "./weapons/blaster";
import { BlasterModel } from "./weapons/blaster-model";
import { DartImpacts, type VoxelTarget } from "./weapons/impacts";
import { FoamerSystem } from "./foamers/foamers";
import { Hud } from "./ui/hud";
import blasterTuning from "../data/blasters.json";
import { VoxelVolume } from "./voxel/chunk";
import { materialId } from "./voxel/materials";
import { carveSphere } from "./voxel/carve";
import { DebrisSystem } from "./voxel/debris";
import { MesherPool } from "./voxel/mesher-pool";
import { VolumeMesh } from "./voxel/volume-mesh";
import { FallingPieces } from "./voxel/pieces";
import { createFoamMaterial } from "./render/foam-material";
import renderJson from "../data/render.json";

// Test course: proves rendering, physics, input and the player controller
// together. Steps, ledges to mantle, a wall too tall to mantle, a walkable
// and a too-steep ramp. Fire throws foam blocks.

const FOAM_COLOURS = [0xff7a1a, 0x2ec4ff, 0xb6ff3b, 0xff4fa3, 0xffd23f, 0x9b5cff];
const MAX_BLOCKS = 200;
const THROW_SPEED = 18;
const SPAWN = new THREE.Vector3(0, 0, 12);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

const { renderer, scene, camera } = createRenderer(canvas);
camera.rotation.order = "YXZ";
scene.add(camera); // needed so children (the blaster viewmodel) render
const input = new Input(canvas);
const hud = new Hud(document.querySelector<HTMLDivElement>("#hud")!);

const { rapier, world } = await createPhysics();

// Static geometry: a box mesh plus a matching fixed collider.
function addBox(
  x: number, y: number, z: number, w: number, h: number, d: number,
  color: number, rotX = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const q = mesh.quaternion;
  world.createCollider(
    rapier.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(x, y, z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
  );
}

const WALL = 0x5a4890;
addBox(0, -0.5, 0, 40, 1, 40, 0x3d2f6b); // floor
// Steps 0.3 m high: walked up without jumping.
for (let i = 1; i <= 4; i++) addBox(-12, 0.15 * i, 4.8 - i * 0.8, 3, 0.3 * i, 0.8, WALL);
// Ledges: 1.0 m and 2.4 m can be mantled from a jump (reach is jump height
// plus mantleMaxHeight, about 2.7 m); 3.2 m cannot.
addBox(-5, 0.5, 0, 3, 1.0, 3, 0x6b58a8);
addBox(0, 1.2, 0, 3, 2.4, 3, 0x6b58a8);
addBox(5, 1.6, 0, 3, 3.2, 3, WALL);
// Ramps: 25 degrees walkable, 55 degrees too steep.
addBox(11, 1.2, 2, 3, 0.4, 7, 0x7a68c0, THREE.MathUtils.degToRad(25));
addBox(16, 2, 2, 3, 0.4, 6, WALL, THREE.MathUtils.degToRad(55));
// Outer walls
addBox(0, 2, -20, 40, 4, 1, WALL);
addBox(0, 2, 20, 40, 4, 1, WALL);
addBox(-20, 2, 0, 1, 4, 40, WALL);
addBox(20, 2, 0, 1, 4, 40, WALL);

// Voxel demo (ENG-04, ENG-05): a 4 m foam wall at 0.1 m voxels, wide enough
// to cross a chunk seam. Melee (F / middle mouse) is a temporary debug blast
// that carves where you look and throws foam debris, until blasters exist.
const VOXEL = 0.1;
const voxels = new VoxelVolume(VOXEL);
const stripes = ["foam-orange", "foam-blue", "foam-lime", "foam-pink", "foam-yellow", "foam-purple"].map(materialId);
for (let y = 0; y < 24; y++) voxels.fillBox(0, y, 0, 39, y, 3, stripes[Math.floor(y / 4)]);
voxels.fillBox(0, 0, 0, 39, 0, 3, materialId("bedrock"));
carveSphere(voxels, 10, 12, 2, 5);
carveSphere(voxels, 31, 16, 0, 4);
carveSphere(voxels, 24, 23, 3, 3);
// A cardboard, wood and concrete strip on top, to show hardness.
voxels.fillBox(0, 24, 0, 12, 27, 3, materialId("cardboard"));
voxels.fillBox(13, 24, 0, 26, 27, 3, materialId("wood"));
voxels.fillBox(27, 24, 0, 39, 27, 3, materialId("concrete"));
// Test tower for ENG-06: shoot through the pillar and the top falls;
// cut an arm at the joint and the arm falls.
voxels.fillBox(52, 0, 0, 55, 19, 3, materialId("foam-lime"));
voxels.fillBox(52, 0, 0, 55, 0, 3, materialId("bedrock"));
voxels.fillBox(44, 20, 0, 63, 23, 3, materialId("foam-pink"));
const mesherPool = new MesherPool();
const voxelMesh = new VolumeMesh(voxels, mesherPool, rapier, world, new THREE.Vector3(-8, 0, -10));
scene.add(voxelMesh.group);
const debris = new DebrisSystem(rapier, world);
scene.add(debris.mesh);
// Loose islands cut by a carve break off and fall as their own bodies.
const pieces = new FallingPieces(rapier, world, mesherPool, debris);
scene.add(pieces.group);

const BLAST_RADIUS_METRES = 0.35;
const blastRay = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
function debugBlast() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  blastRay.origin = camera.position;
  blastRay.dir = dir;
  const hit = world.castRay(blastRay, 60, true, 8 /* EXCLUDE_SENSORS */, undefined, player.collider);
  if (!hit || !voxelMesh.owns(hit.collider)) return;
  // Centre slightly inside the surface so the crater is not half empty air.
  const point = camera.position.clone().addScaledVector(dir, hit.timeOfImpact + VOXEL * 0.5);
  const c = voxelMesh.worldToVoxel(point);
  const removed = carveSphere(voxels, c.x, c.y, c.z, BLAST_RADIUS_METRES / VOXEL);
  debris.spawn(removed, c, VOXEL, (v) => voxelMesh.voxelToWorld(v));
  pieces.afterCarve(voxelMesh, removed);
}

// Foam blocks: one shared geometry, one foam material per colour.
const blockGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const materials = FOAM_COLOURS.map(
  (color) => createFoamMaterial({ cellsPerUnit: renderJson.foam.poreCellsPerVoxel / VOXEL, wrapCells: 0, color }),
);
// prevT and prevQ: the pose before the last step, for render interpolation.
const blocks: {
  mesh: THREE.Mesh;
  body: ReturnType<typeof world.createRigidBody>;
  prevT: THREE.Vector3;
  prevQ: THREE.Quaternion;
}[] = [];

function spawnBlock(pos: THREE.Vector3, vel: THREE.Vector3) {
  if (blocks.length >= MAX_BLOCKS) {
    const old = blocks.shift()!;
    scene.remove(old.mesh);
    world.removeRigidBody(old.body);
  }
  const mesh = new THREE.Mesh(blockGeo, materials[Math.floor(Math.random() * materials.length)]);
  mesh.castShadow = true;
  scene.add(mesh);
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinvel(vel.x, vel.y, vel.z)
      .setAngvel({ x: Math.random() * 4, y: Math.random() * 4, z: Math.random() * 4 }),
  );
  world.createCollider(rapier.ColliderDesc.cuboid(0.3, 0.3, 0.3).setRestitution(0.4), body);
  blocks.push({ mesh, body, prevT: pos.clone(), prevQ: new THREE.Quaternion() });
}

for (let i = 0; i < 30; i++) {
  spawnBlock(
    new THREE.Vector3(8 + Math.random() * 6, 0.3 + i * 0.7, -8 + Math.random() * 4),
    new THREE.Vector3(),
  );
}

const player = new PlayerController(rapier, world, SPAWN);
const eye = new THREE.Vector3();

// Darts: one pooled system, excluding the player's own capsule from hits.
const darts = new DartSystem(scene, world, rapier, player.collider);
// The placeholder pump blaster: ammo, priming, reload. Numbers in
// data/blasters.json.
const blasterSpec = blasterTuning.placeholder as unknown as BlasterSpec;
const blaster = new Blaster(blasterSpec, darts);
const blasterModel = new BlasterModel(blasterSpec, camera);
blaster.onShot = () => blasterModel.kick();
// Voxel targets: the wall, and every live Foamer (spawn and pop keep it
// in step). Darts carve both.
const voxelTargets: VoxelTarget[] = [voxelMesh];
// Dart hits on the voxel wall carve a crater and throw foam debris.
const impacts = new DartImpacts(darts, debris, voxelTargets);
// Darts stuck to a broken-off island fall off as loose darts.
pieces.onBreak = (c, r) => darts.releaseInSphere(c, r);
// Islands only form in the wall, so isolate the carve notification there.
impacts.onCarve = (target, removed) => {
  if (target === voxelMesh) pieces.afterCarve(voxelMesh, removed);
};
// Foamer system: spawn, bonk, dart damage, pop. This is the first enemy,
// GAME-03.
const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
scene.add(foamers.group);
// The bonk just logs; player damage arrives in the later card.
foamers.onBonk = () => console.info("Bonk");
// KeyT toggles the dart type. A debug key read with a plain keydown listener,
// not through data/input.json.
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyT" && !e.repeat) {
    blaster.dartType = blaster.dartType === "standard" ? "suction" : "standard";
    console.info("Dart type: " + blaster.dartType);
  }
});
// Scratch vectors for the aim math; allocated once.
const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toMuzzle = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
const _rot = new THREE.Quaternion();
const muzzleRay = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

let paused = true;
function setPaused(p: boolean) {
  paused = p;
  overlay.hidden = !p;
  hud.show(!p);
  status.textContent = "Click to play. Esc to pause.";
  if (p && input.locked) document.exitPointerLock();
}
input.onLockChange = (locked) => setPaused(!locked);
setPaused(true);

startLoop({
  frame(dt) {
    input.poll();
    voxelMesh.update();
    if (paused) return;
    const look = input.takeLook(dt);
    player.yaw -= look.yaw;
    player.pitch = THREE.MathUtils.clamp(player.pitch + look.pitch, -1.5, 1.5);
  },
  update(dt) {
    // Gamepad start toggles pause; with a mouse, Esc releases the lock instead.
    if (input.wasPressed("pause")) setPaused(!paused);
    if (!paused) {
      player.update(dt, input);
      // Foamer on a fixed step, before world.step().
      foamers.update(dt, player.eye(1, _playerPos));
      if (input.wasPressed("melee")) debugBlast();
      // Blaster: muzzle from the camera, aim 50 m down the view, then the
      // blaster's fixed step, then the darts.
      camera.updateMatrixWorld();
      _muzzle.set(blasterSpec.muzzle[0], blasterSpec.muzzle[1], blasterSpec.muzzle[2]);
      camera.localToWorld(_muzzle);
      // Up against a wall the muzzle is inside it: pull it back to just in
      // front of the surface, or darts would start inside solid geometry.
      _toMuzzle.subVectors(_muzzle, camera.position);
      const muzzleDist = _toMuzzle.length();
      muzzleRay.origin = camera.position;
      muzzleRay.dir = _toMuzzle.divideScalar(muzzleDist);
      const blocked = world.castRay(muzzleRay, muzzleDist, true, 8 /* EXCLUDE_SENSORS */, SOLID_QUERY_GROUPS, player.collider);
      if (blocked) _muzzle.copy(camera.position).addScaledVector(_toMuzzle, Math.max(0, blocked.timeOfImpact - 0.02));
      camera.getWorldDirection(_dir);
      _aim.copy(camera.position).addScaledVector(_dir, 50);
      _aimDir.subVectors(_aim, _muzzle).normalize();
      blaster.update(
        dt,
        { firePressed: input.wasPressed("fire"), reloadPressed: input.wasPressed("reload") },
        _muzzle,
        _aimDir,
      );
      debris.update(dt);
      pieces.update(dt);
      if (player.feet < -20) player.teleport(SPAWN);
      // E throws a foam block.
      if (input.wasPressed("use")) {
        const dir = camera.getWorldDirection(new THREE.Vector3());
        spawnBlock(camera.position.clone().addScaledVector(dir, 0.8), dir.multiplyScalar(THROW_SPEED));
      }
      darts.update(dt);
      for (const b of blocks) {
        const t = b.body.translation();
        const r = b.body.rotation();
        b.prevT.set(t.x, t.y, t.z);
        b.prevQ.set(r.x, r.y, r.z, r.w);
      }
      world.step();
    }
    input.endStep();
  },
  render(_dt, alpha) {
    // Everything that moves on the fixed step is drawn alpha of the way
    // between its last two steps, so it moves smoothly at any refresh rate.
    debris.syncRender(alpha);
    pieces.syncRender(alpha);
    foamers.syncRender(alpha);
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    camera.rotation.set(player.pitch, player.yaw, 0);
    blasterModel.update(_dt, blaster);
    hud.setAmmo(blaster.mag, blaster.reserve, blaster.state);
    for (const { mesh, body, prevT, prevQ } of blocks) {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z).sub(prevT).multiplyScalar(alpha).add(prevT);
      mesh.quaternion.copy(prevQ).slerp(_rot.set(r.x, r.y, r.z, r.w), alpha);
    }
    darts.syncRender(alpha);
    renderer.render(scene, camera);
  },
});

// Dev-only hook for automated checks in the browser pane.
if (import.meta.env.DEV) Object.assign(window, { __dart: { player, voxels, voxelMesh, carveSphere, debris, debugBlast, mesherPool, darts, blaster, impacts, pieces, foamers } });
