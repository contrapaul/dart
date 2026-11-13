// First import on purpose: a boot that fails says so on the overlay.
import "./core/boot-errors";
import * as THREE from "three";
import { VoxelVolume } from "./voxel/chunk";
import { materialId } from "./voxel/materials";
import { carveSphere } from "./voxel/carve";
import { VolumeMesh } from "./voxel/volume-mesh";
import { createGame } from "./game/game";
import { courseExtras } from "./course/extras";
import { wireTitleMenu } from "./game/title";

// Test course: proves rendering, physics, input and the player controller
// together. Steps, ledges to mantle, a wall too tall to mantle, a walkable
// and a too-steep ramp. Fire throws foam blocks.
//
// The game itself (renderer, player, blasters, Foamers, menus, sounds, the
// loop) is shared with the arena page in src/game/ (ENG-13); this page is
// its geometry and the two things only it does: the melee debug blast and
// the foam blocks thrown with E.

const SPAWN = new THREE.Vector3(0, 0, 12);
const VOXEL = 0.1;

let debugBlast: (() => void) | undefined;
const game = await createGame({
  build({ rapier, world, scene, mesherPool }) {
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
    const voxelMesh = new VolumeMesh(voxels, mesherPool, rapier, world, new THREE.Vector3(-8, 0, -10));
    scene.add(voxelMesh.group);

    // ENG-08 stage 3b: the grid is baked over the 40 m floor and the foam
    // wall beside it.
    return {
      voxels,
      voxelMesh,
      navBounds: { minX: -20, maxX: 70, minZ: -20, maxZ: 20 },
      spawn: SPAWN,
    };
  },

  configure(g) {
    // The blocks, the blast and the course's respawn live in their own file.
    const extras = courseExtras(g);
    debugBlast = extras.debugBlast;
    return extras.hooks;
  },
});

// LVL-05 stage 2: New game and Continue, before the first click. The test
// course behind them plays exactly as it did.
wireTitleMenu();

// Dev-only hook for automated checks in the browser pane.
if (import.meta.env.DEV) Object.assign(window, {
  __dart: {
    camera: game.camera, player: game.player, voxels: game.voxels,
    voxelMesh: game.voxelMesh, carveSphere, debris: game.debris,
    mesherPool: game.mesherPool, darts: game.darts, loadout: game.loadout,
    impacts: game.impacts, pieces: game.pieces, foamers: game.foamers,
    health: game.health, debugBlast: () => debugBlast?.(), loop: game.loop,
  },
});
