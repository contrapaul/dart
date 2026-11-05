import * as THREE from "three";
import { carveSphere } from "../voxel/carve";
import { createFoamMaterial } from "../render/foam-material";
import renderJson from "../../data/render.json";
import { FALL_LIMIT } from "../game/shared";
import type { Game, GameHooks } from "../game/game";

// What only the test course does (ENG-13): foam blocks thrown with E, the
// melee debug blast, the pop burst and the course's own respawn. Kept out
// of src/main.ts, which is the course's geometry and its two hooks.

const FOAM_COLOURS = [0xff7a1a, 0x2ec4ff, 0xb6ff3b, 0xff4fa3, 0xffd23f, 0x9b5cff];
const MAX_BLOCKS = 200;
const THROW_SPEED = 18;
const VOXEL = 0.1;

export interface CourseExtras {
  hooks: Partial<GameHooks>;
  /** For the dev hook and the browser checks. */
  debugBlast(): void;
}

export function courseExtras(g: Game): CourseExtras {
  const { rapier, world, scene, camera, player, voxels, voxelMesh, debris, pieces } = g;

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

  const rot = new THREE.Quaternion();
  const spawn = g.built.spawn;

  const hooks: Partial<GameHooks> = {
    step() {
      // GAME-06: the debug blast had the melee key while the melee was
      // unbuilt; it has its own binding now (data/input.json, KeyB).
      if (g.input.wasPressed("debugBlast")) debugBlast();
    },

    afterPieces() {
      if (player.feet < FALL_LIMIT) player.teleport(spawn);
      // E throws a foam block.
      if (g.input.wasPressed("use")) {
        const dir = camera.getWorldDirection(new THREE.Vector3());
        spawnBlock(camera.position.clone().addScaledVector(dir, 0.8), dir.multiplyScalar(THROW_SPEED));
      }
    },

    beforeWorld() {
      for (const b of blocks) {
        const t = b.body.translation();
        const r = b.body.rotation();
        b.prevT.set(t.x, t.y, t.z);
        b.prevQ.set(r.x, r.y, r.z, r.w);
      }
    },

    renderLate(_dt, alpha) {
      for (const { mesh, body, prevT, prevQ } of blocks) {
        const p = body.translation();
        const r = body.rotation();
        mesh.position.set(p.x, p.y, p.z).sub(prevT).multiplyScalar(alpha).add(prevT);
        mesh.quaternion.copy(prevQ).slerp(rot.set(r.x, r.y, r.z, r.w), alpha);
      }
    },

    /** The pop: no gore, no red. A burst of foam blocks at the player in the
     *  foam colours, the edge glow in the foam-core colour, and a toy-like
     *  foam pop from the audio engine. */
    popEffect() {
      const at = player.eye(1, new THREE.Vector3());
      for (let i = 0; i < 10; i++) {
        const v = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 1.4 + 0.2,
          Math.random() * 2 - 1,
        ).multiplyScalar(4);
        spawnBlock(at.clone().addScaledVector(v, 0.15), v);
      }
      g.hud.popFlash();
      g.audio.play("FX-pop");
    },

    /** The Try again / Restart respawn: full health, back at the spawn, the
     *  Foamers cleared (the range keeps its own respawn rules). Left-over
     *  pickup blobs would collect at the next spawn, so they go too
     *  (GAME-07). */
    onRestart() {
      g.health.reset();
      player.teleport(spawn);
      g.foamers.clear();
      g.pickups.clear();
      g.hud.clearFlash();
    },

    watchName: "dartGame",

    watchState() {
      // The course's own fields in dartGame.state(), next to the shared ones.
      return { blocks: blocks.length };
    },
  };

  return { hooks, debugBlast };
}
