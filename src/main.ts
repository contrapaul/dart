import * as THREE from "three";
import { createRenderer } from "./render/scene";
import { createPhysics } from "./physics/world";
import { startLoop } from "./core/loop";

// PRE-09 skeleton: proves Three.js and Rapier are bundled and running together.
// Foam blocks rain onto a floor; click to drop more. Real gameplay starts at ENG-01.

const FOAM_COLOURS = [0xff7a1a, 0x2ec4ff, 0xb6ff3b, 0xff4fa3, 0xffd23f, 0x9b5cff];
const MAX_BLOCKS = 200;

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

const { renderer, scene, camera } = createRenderer(canvas);
camera.position.set(0, 6, 14);
camera.lookAt(0, 1, 0);

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

function dropBlock() {
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
      .setTranslation((Math.random() - 0.5) * 6, 8 + Math.random() * 4, (Math.random() - 0.5) * 6)
      .setAngvel({ x: Math.random() * 4, y: Math.random() * 4, z: Math.random() * 4 }),
  );
  world.createCollider(rapier.ColliderDesc.cuboid(0.3, 0.3, 0.3).setRestitution(0.4), body);
  blocks.push({ mesh, body });
}

for (let i = 0; i < 40; i++) dropBlock();
window.addEventListener("pointerdown", () => {
  for (let i = 0; i < 20; i++) dropBlock();
});

status.textContent = "Click to drop foam";

startLoop(
  () => world.step(),
  () => {
    for (const { mesh, body } of blocks) {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    renderer.render(scene, camera);
  },
);
