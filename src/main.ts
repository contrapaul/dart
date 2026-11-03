import * as THREE from "three";
import { createRenderer } from "./render/scene";
import { createPhysics } from "./physics/world";
import { startLoop } from "./core/loop";
import { Input, settings as lookSettings } from "./core/input";
import { SettingsStore, type Settings } from "./core/settings";
import { PlayerController } from "./player/controller";
import { PlayerHealth } from "./player/health";
import { DartSystem } from "./weapons/darts";
import { Loadout } from "./weapons/loadout";
import { updateAim } from "./weapons/aim";
import { DartImpacts, type VoxelTarget } from "./weapons/impacts";
import { FoamerSystem } from "./foamers/foamers";
import { makeLevelAI } from "./ai/level";
import { Hud } from "./ui/hud";
import { SettingsPanel } from "./ui/menus";
import { VoxelVolume } from "./voxel/chunk";
import { materialId } from "./voxel/materials";
import { carveSphere } from "./voxel/carve";
import { DebrisSystem } from "./voxel/debris";
import { MesherPool } from "./voxel/mesher-pool";
import { VolumeMesh } from "./voxel/volume-mesh";
import { FallingPieces } from "./voxel/pieces";
import { createFoamMaterial } from "./render/foam-material";
import { AudioEngine } from "./audio/audio";
import { GameSounds } from "./audio/game-sounds";
import renderJson from "../data/render.json";
import foamerData from "../data/foamers.json";

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

// UI-01 stage 1: the player's health. The damage of each Foamer attack comes
// from data/foamers.json (attacks[].damage), looked up by id on the bonk.
const health = new PlayerHealth();
const ATTACK_DAMAGE = new Map<string, number>(
  (foamerData.test as unknown as { attacks: { id: string; damage: number }[] })
    .attacks.map((a) => [a.id, a.damage]),
);

// UI-01 stage 2: one settings store (localStorage, defaults on failure),
// applied live to look, FOV, volume and damage taken. The panels subscribe
// through the store's change callback.
const store = new SettingsStore();
function applySettings(s: Settings): void {
  lookSettings.mouseSensitivity = s.mouseSensitivity;
  lookSettings.invertY = s.invertY;
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  health.damageTaken = s.damageTaken;
  hud.reduceFlashes = s.reduceFlashes;
  if (engine) {
    engine.volume = s.volume;
    engine.muted = s.muted;
  }
}
store.onChange(applySettings);

// Darts: one pooled system, excluding the player's own capsule from hits.
const darts = new DartSystem(scene, world, rapier, player.collider);
// The loadout: all three blasters and their viewmodels, driven by data in
// data/blasters.json. Loads before the start overlay can resolve, so by
// the time the player can act every viewmodel is on screen.
const loadout = await Loadout.load(camera, darts);
// Sound (AUD-01 stage 2): the engine opens on the first click (the browser
// keeps sound off before a click), and GameSounds gets it as its sink.
// While the engine loads, or on a host with no Web Audio, the game carries
// on silent.
let engine: AudioEngine | null = null;
let sounds: GameSounds | null = null;
let audioStarting = false;
// The defaults from storage go onto the camera, look and health now; the
// engine gets volume and mute when it arrives (see startAudio).
applySettings(store.value);
const _aimUnused = new THREE.Vector3();
Loadout.muzzleToWorld = (camPoint, out) => {
  updateAim(camera, world, player.collider, camPoint, out, _aimUnused);
  return out;
};
// Voxel targets: the wall, and every live Foamer (spawn and pop keep it
// in step). Darts carve both.
const voxelTargets: VoxelTarget[] = [voxelMesh];
// Dart hits on the voxel wall carve a crater and throw foam debris.
const impacts = new DartImpacts(darts, debris, voxelTargets);
// Darts stuck to a broken-off island fall off as loose darts.
pieces.onBreak = (c, r) => darts.releaseInSphere(c, r);
// A piece that comes to rest may block a cell: re-bake its patch.
pieces.onRest = (c, r) => levelAI.pieceRested(c, r);
// Islands only form in the wall, so isolate the carve notification there.
impacts.onCarve = (target, removed) => {
  if (target !== voxelMesh) return;
  pieces.afterCarve(voxelMesh, removed);
  // The grid re-bakes only where the carve was (ENG-08 stage 3b). The
  // removed voxels are in the volume's own coordinates: convert the box's
  // two corners to the world.
  if (removed.length === 0) return;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const v of removed) {
    if (v.x < x0) x0 = v.x;
    if (v.x > x1) x1 = v.x;
    if (v.z < z0) z0 = v.z;
    if (v.z > z1) z1 = v.z;
  }
  const a = voxelMesh.voxelToWorld(_carveA.set(x0, 0, z0));
  const b = voxelMesh.voxelToWorld(_carveB.set(x1, 0, z1));
  levelAI.carveChanged(a.x, a.z, b.x, b.z);
};
// Foamer system: spawn, bonk, dart damage, pop. This is the first enemy,
// GAME-03.
const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
// ENG-08 stage 3b: one director and one nav grid for the level. The grid is
// baked over the level's bounds (the 40 m floor and the foam wall beside it)
// and re-baked where a carve or a resting piece changed the ground.
const levelAI = makeLevelAI(
  rapier, world, { minX: -20, maxX: 70, minZ: -20, maxZ: 20 }, store.value.difficulty,
);
foamers.director = levelAI.director;
foamers.navGrid = levelAI.grid;
foamers.spawnState = "alert"; // an arena spawn is already in the fight
scene.add(foamers.group);
// The bonk now costs health (UI-01 stage 1). The chain is kept: the sound
// wrapper (AUD-01) wraps this handler when it arrives, and the console log
// stays. God mode is a range-page switch; this page always takes damage.
const logBonk = foamers.onBonk;
foamers.onBonk = (f, attack) => {
  logBonk(f, attack);
  if (paused) return;
  const lost = health.damage(ATTACK_DAMAGE.get(attack) ?? 0, attack);
  if (lost <= 0) return;
  hud.onHit();
  if (health.dead) playerPopped();
};
// Scratch vectors for the aim math; allocated once (aim.ts carries its
// own).
const _muzzleCam = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _carveA = new THREE.Vector3();
const _carveB = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
const _rot = new THREE.Quaternion();

let paused = true;
/** True once the mouse has been captured: before that the title overlay is
 *  up, and the pause menu stays hidden behind it. */
let started = false;
/** UI-01: while the player has popped, only the Try again button unpauses. */
let poppedOut = false;
const popped = document.querySelector<HTMLDivElement>("#popped")!;

// UI-01 stage 2: the pause menu (Esc or gamepad Start) and the settings
// panel. The menu shows whenever the game is paused and the player has not
// popped; Settings opens from it, or from the title overlay before the
// first click. Resume or a canvas click plays on.
const pauseMenu = document.querySelector<HTMLDivElement>("#pausemenu")!;
const settingsBtn = document.querySelector<HTMLButtonElement>("#settingsBtn")!;
const settingsPanel = new SettingsPanel(
  document.querySelector<HTMLDivElement>("#settings")!,
  store,
  () => {
    settingsPanel.close();
    // Back goes to the pause menu when playing was started, otherwise the
    // title overlay is already behind the panel.
    pauseMenu.hidden = !(started && !poppedOut);
    if (!pauseMenu.hidden) settingsBtn.focus();
  },
);
document.querySelector<HTMLButtonElement>("#resumeBtn")!.addEventListener("click", () => {
  settingsPanel.close();
  if (input.locked) setPaused(false);
  else input.requestLock();
});
settingsBtn.addEventListener("click", () => settingsPanel.open());
document.querySelector<HTMLButtonElement>("#restartBtn")!.addEventListener("click", restart);
// A click on the dimmed background (not the panel) plays on, like Resume.
pauseMenu.addEventListener("pointerdown", (e) => {
  if (e.target === pauseMenu) {
    settingsPanel.close();
    if (input.locked) setPaused(false);
    else input.requestLock();
  }
});
document.querySelector<HTMLButtonElement>("#titleSettings")!.addEventListener("click", () => {
  pauseMenu.hidden = true;
  settingsPanel.open();
});

/** The pop: no gore, no red. A burst of foam blocks at the player in the
 *  foam colours, the edge glow in the foam-core colour, and a toy-like
 *  foam pop from the audio engine. */
function popBurst() {
  const at = player.eye(1, new THREE.Vector3());
  for (let i = 0; i < 10; i++) {
    const v = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 1.4 + 0.2,
      Math.random() * 2 - 1,
    ).multiplyScalar(4);
    spawnBlock(at.clone().addScaledVector(v, 0.15), v);
  }
  hud.popFlash();
  if (engine) engine.play("FX-pop");
}
function playerPopped() {
  poppedOut = true;
  setPaused(true);
  popBurst();
  popped.hidden = false;
  status.textContent = "Press Try again.";
}
document.querySelector<HTMLButtonElement>("#tryAgain")!.addEventListener("click", () => restart());
/** The Try again / Restart respawn: full health, back at the spawn, the
 *  Foamers cleared (the range keeps its own respawn rules). */
function restart(): void {
  health.reset();
  player.teleport(SPAWN);
  foamers.clear();
  hud.clearFlash();
  popped.hidden = true;
  poppedOut = false;
  settingsPanel.close();
  if (input.locked) setPaused(false);
  else input.requestLock();
}
/** While paused the scene only needs redrawing for meshes that arrive and
 *  window resizes, so it draws a few frames a second to save battery. */
const PAUSED_FRAME = renderJson.pausedFrame;
let pausedClock = PAUSED_FRAME;
function setPaused(p: boolean) {
  if (poppedOut && !p) return; // Try again clears the flag first
  paused = p;
  overlay.hidden = !p;
  hud.show(!p);
  // The pause menu stands in for "click to play" while paused (the popped
  // overlay has its own button instead). The title's Settings button hides
  // so the menu's is the only one on screen.
  pauseMenu.hidden = !(p && !poppedOut && started);
  // The title's Settings button is for before the first click; after that
  // Settings lives in the pause menu.
  document.querySelector<HTMLButtonElement>("#titleSettings")!.hidden = started;
  if (!p) settingsPanel.close();
  status.textContent = "Click to play. Esc to pause.";
  if (engine) { if (p) engine.suspend(); else engine.resume(); }
  if (p && input.locked) document.exitPointerLock();
}
input.onLockChange = (locked) => {
  if (locked) started = true;
  setPaused(!locked);
};
// The first click or key starts the audio. The context must be made inside
// that gesture: the pointer lock event comes later and is not a gesture, so
// a strict browser (Safari) would keep a context made there silent.
function startAudio() {
  if (engine || audioStarting) return;
  audioStarting = true;
  AudioEngine.create(camera)
    .then((e) => {
      engine = e;
      sounds = new GameSounds(e, loadout, player, darts, impacts, foamers);
      if (paused) e.suspend();
      applySettings(store.value); // volume and mute from storage
    })
    .catch(() => { /* no Web Audio on this host: the game stays silent */ })
    .finally(() => { audioStarting = false; });
}
window.addEventListener("pointerdown", startAudio, { capture: true });
window.addEventListener("keydown", startAudio, { capture: true });
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
    // M (the mute action in data/input.json) toggles the master mute,
    // through the store so the settings panel stays in step.
    if (input.wasPressed("mute")) store.set("muted", !store.value.muted);
    if (!paused) {
      health.update(dt);
      player.update(dt, input);
      // Foamer on a fixed step, before world.step().
      foamers.update(dt, player.eye(1, _playerPos));
      if (input.wasPressed("melee")) debugBlast();
      // Blaster: switch first (wheel down is next, up is prev), then the
      // muzzle from the active viewmodel, the aim 50 m down the view, and
      // the loadout's fixed step, then the darts.
      for (let i = 0; i < loadout.ids.length; i++) {
        const key = ["weapon1", "weapon2", "weapon3"][i];
        if (input.wasPressed(key as "weapon1")) loadout.select(i);
      }
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
      updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
      loadout.update(
        dt,
        {
          fireHeld: input.isDown("fire"),
          firePressed: input.wasPressed("fire"),
          reloadPressed: input.wasPressed("reload"),
        },
        _aimDir,
      );
      // The blaster, player and level hooks, one step per fixed step.
      if (sounds) sounds.update(dt, {
        fireHeld: input.isDown("fire"),
        firePressed: input.wasPressed("fire"),
        reloadPressed: input.wasPressed("reload"),
        sprintHeld: input.isDown("sprint"),
      });
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
    if (paused) {
      pausedClock += _dt;
      if (pausedClock < PAUSED_FRAME) return;
      pausedClock = 0;
    } else pausedClock = PAUSED_FRAME;
    // Everything that moves on the fixed step is drawn alpha of the way
    // between its last two steps, so it moves smoothly at any refresh rate.
    debris.syncRender(alpha);
    pieces.syncRender(alpha);
    foamers.syncRender(alpha);
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    // The active blaster's recoil climb tilts the view up (the player's own
    // pitch is unchanged, so releasing the trigger brings the view back up).
    const climb = loadout.active.climb;
    camera.rotation.set(player.pitch + climb, player.yaw, 0);
    // The active blaster's viewmodel animates once per render frame.
    loadout.render(_dt, input.isDown("fire"));
    hud.setAmmo(loadout.active, loadout.active.state);
    hud.setHealth(health.hp, health.max);
    for (const { mesh, body, prevT, prevQ } of blocks) {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z).sub(prevT).multiplyScalar(alpha).add(prevT);
      mesh.quaternion.copy(prevQ).slerp(_rot.set(r.x, r.y, r.z, r.w), alpha);
    }
    darts.syncRender(alpha);
    // The spatial listener follows the camera each render frame.
    if (engine) engine.updateListener();
    renderer.render(scene, camera);
  },
});

// Dev-only hook for automated checks in the browser pane.
if (import.meta.env.DEV) Object.assign(window, { __dart: { camera, player, voxels, voxelMesh, carveSphere, debris, debugBlast, mesherPool, darts, loadout, impacts, pieces, foamers, health } });
