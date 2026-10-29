import * as THREE from "three";
import { createRenderer } from "./render/scene";
import { createPhysics } from "./physics/world";
import { startLoop } from "./core/loop";
import { Input } from "./core/input";

// Test scene: proves rendering, physics and input together. A temporary
// walker (no collisions) looks and moves; fire throws foam blocks.
// ENG-02 replaces the walker with the real first person controller.

const FOAM_COLOURS = [0xff7a1a, 0x2ec4ff, 0xb6ff3b, 0xff4fa3, 0xffd23f, 0x9b5cff];
const MAX_BLOCKS = 200;
const EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;
const SPRINT_SPEED = 10;
const THROW_SPEED = 18;

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

const { renderer, scene, camera } = createRenderer(canvas);
camera.rotation.order = "YXZ";
const input = new Input(canvas);

const { rapier, world } = await createPhysics();

// Floor
const floorSize = 20;
const floor = new THREE.Mesh(
  new THREE.BoxGeometry(floorSize, 1, floorSize),
  new THREE.MeshStandardMaterial({ color: 0x3d2f6b, roughness: 0.9 }),
);
floor.position.y = -0.5;
floor.receiveShadow = true;
scene.add(floor);
world.createCollider(
  rapier.ColliderDesc.cuboid(floorSize / 2, 0.5, floorSize / 2).setTranslation(0, -0.5, 0),
);

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

for (let i = 0; i < 40; i++) {
  spawnBlock(
    new THREE.Vector3((Math.random() - 0.5) * 6, 8 + Math.random() * 4, (Math.random() - 0.5) * 6),
    new THREE.Vector3(),
  );
}

// Temporary walker state
const player = new THREE.Vector3(0, EYE_HEIGHT, 8);
let yaw = 0;
let pitch = -0.2;
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

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
    if (paused) return;
    const look = input.takeLook(dt);
    yaw -= look.yaw;
    pitch = THREE.MathUtils.clamp(pitch + look.pitch, -1.5, 1.5);
  },
  update(dt) {
    // Gamepad start toggles pause; with a mouse, Esc releases the lock instead.
    if (input.wasPressed("pause")) setPaused(!paused);
    if (!paused) {
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const m = input.move();
      const speed = input.isDown("sprint") ? SPRINT_SPEED : WALK_SPEED;
      player.addScaledVector(forward, m.y * speed * dt).addScaledVector(right, m.x * speed * dt);
      player.x = THREE.MathUtils.clamp(player.x, -floorSize / 2, floorSize / 2);
      player.z = THREE.MathUtils.clamp(player.z, -floorSize / 2, floorSize / 2);

      if (input.wasPressed("fire")) {
        const dir = camera.getWorldDirection(new THREE.Vector3());
        spawnBlock(player.clone().addScaledVector(dir, 0.8), dir.multiplyScalar(THROW_SPEED));
      }
      world.step();
    }
    input.endStep();
  },
  render() {
    camera.position.copy(player);
    camera.rotation.set(pitch, yaw, 0);
    for (const { mesh, body } of blocks) {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    renderer.render(scene, camera);
  },
});
