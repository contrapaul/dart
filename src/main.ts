import * as THREE from "three";
import { createRenderer } from "./render/scene";
import { createPhysics } from "./physics/world";
import { startLoop } from "./core/loop";
import { Input } from "./core/input";
import { PlayerController } from "./player/controller";
import { DartSystem } from "./weapons/darts";
import type { DartTypeName } from "./weapons/darts";
import dartTuning from "../data/darts.json";
import { VoxelVolume } from "./voxel/chunk";
import { materialId } from "./voxel/materials";
import { MesherPool } from "./voxel/mesher-pool";
import { VolumeMesh } from "./voxel/volume-mesh";

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
const input = new Input(canvas);

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

// Voxel demo (ENG-04): a 4 m foam wall at 0.1 m voxels, wide enough to
// cross a chunk seam, with carved holes. ENG-05 adds carving by damage.
const VOXEL = 0.1;
const voxels = new VoxelVolume(VOXEL);
const stripes = ["foam-orange", "foam-blue", "foam-lime", "foam-pink", "foam-yellow", "foam-purple"].map(materialId);
for (let y = 0; y < 24; y++) voxels.fillBox(0, y, 0, 39, y, 3, stripes[Math.floor(y / 4)]);
voxels.fillBox(0, 0, 0, 39, 0, 3, materialId("bedrock"));
function carveSphere(cx: number, cy: number, cz: number, r: number) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r) voxels.set(x, y, z, 0);
}
carveSphere(10, 12, 2, 5);
carveSphere(31, 16, 0, 4);
carveSphere(24, 23, 3, 3);
const mesherPool = new MesherPool();
const voxelMesh = new VolumeMesh(voxels, mesherPool, rapier, world, new THREE.Vector3(-8, 0, -10));
scene.add(voxelMesh.group);

// Foam blocks: one shared geometry, one material per colour.
const blockGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const materials = FOAM_COLOURS.map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
);
const blocks: { mesh: THREE.Mesh; body: ReturnType<typeof world.createRigidBody> }[] = [];

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
  blocks.push({ mesh, body });
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
let dartType: DartTypeName = "standard";
let fireCd = 0;
// KeyT toggles the dart type. A debug key read with a plain keydown listener,
// not through data/input.json.
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyT" && !e.repeat) {
    dartType = dartType === "standard" ? "suction" : "standard";
    console.info("Dart type: " + dartType);
  }
});
// Scratch vectors for the aim math; allocated once.
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

let paused = true;
function setPaused(p: boolean) {
  paused = p;
  overlay.hidden = !p;
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
      if (player.feet < -20) player.teleport(SPAWN);
      // Darts: auto-fire while held, one shot per fire interval.
      fireCd -= dt;
      if (input.isDown("fire")) {
        if (fireCd <= 0) {
          const dir = camera.getWorldDirection(_dir);
          _right.crossVectors(dir, _up).normalize();
          // Muzzle: 0.2 m right, 0.15 m down from the eye.
          _origin.copy(camera.position).addScaledVector(_right, 0.2).addScaledVector(_up, -0.15);
          // Aim at a point 50 m ahead so darts converge on the crosshair.
          _aim.copy(camera.position).addScaledVector(dir, 50);
          darts.fire(_origin, _aimDir.subVectors(_aim, _origin).normalize(), dartType);
          fireCd = dartTuning.types[dartType].fireInterval;
        }
      } else {
        fireCd = 0; // release snap: the next press fires immediately
      }
      // E throws a foam block (was fire before darts).
      if (input.wasPressed("use")) {
        const dir = camera.getWorldDirection(new THREE.Vector3());
        spawnBlock(camera.position.clone().addScaledVector(dir, 0.8), dir.multiplyScalar(THROW_SPEED));
      }
      darts.update(dt);
      world.step();
    }
    input.endStep();
  },
  render(_dt, alpha) {
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    camera.rotation.set(player.pitch, player.yaw, 0);
    for (const { mesh, body } of blocks) {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    darts.syncRender();
    renderer.render(scene, camera);
  },
});

// Dev-only hook for automated checks in the browser pane.
if (import.meta.env.DEV) Object.assign(window, { __dart: { player, voxels, carveSphere, mesherPool } });
