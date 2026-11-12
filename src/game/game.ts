import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { createRenderer, type SceneOptions } from "../render/scene";
import { createFoamMaterial } from "../render/foam-material";
import { createPhysics, type Rapier } from "../physics/world";
import { startLoop, STEP, loopDiagLine } from "../core/loop";
import { firstFrame, pageBoot } from "../core/boot-report";
import { Input, settings as lookSettings } from "../core/input";
import { Zoom } from "./zoom";
import { SettingsStore, type Settings, DIFFICULTIES } from "../core/settings";
import { PlayerController } from "../player/controller";
import { PlayerHealth } from "../player/health";
import { Shield } from "../player/shield";
import { DartSystem } from "../weapons/darts";
import { Loadout } from "../weapons/loadout";
import { updateAim } from "../weapons/aim";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { ExplosionSystem } from "../weapons/explosion";
import { FoamerSystem } from "../foamers/foamers";
import type { Foamer } from "../foamers/foamer";
import { chargeOf } from "../foamers/charge";
import { shockwaveOf } from "../foamers/leap";
import { materialId } from "../voxel/materials";
import { ProjectileSystem, BALL_MATERIAL, type LiveBall } from "../foamers/projectiles";
import { timeToImpact, playerCapsuleCentre } from "../foamers/ball-time";
import { PickupSystem } from "../pickups/pickups";
import { Finisher } from "./finisher";
import { Vacuum } from "./vacuum";
import vacuumData from "../../data/vacuum.json";
const VacData = vacuumData;
import { Melee } from "./melee";
import { MeleeView } from "./meleeView";
import inputJson from "../../data/input.json";
import { makeLevelAI, type LevelAI } from "../ai/level";
import type { NavBounds } from "../ai/nav-grid";
import { Hud } from "../ui/hud";
import type { VoxelVolume } from "../voxel/chunk";
import { DebrisSystem } from "../voxel/debris";
import { MesherPool } from "../voxel/mesher-pool";
import type { VolumeMesh } from "../voxel/volume-mesh";
import { FallingPieces } from "../voxel/pieces";
import { Crates, burstCrate } from "../voxel/crates";
import type { RemovedVoxel } from "../voxel/carve";
import renderJson from "../../data/render.json";
import { carveBounds } from "./shared";
import { damageOf } from "./attack";
import { decideMeleeParry } from "../foamers/combo";
import { createAudio, type GameAudio } from "./audio";
import type { LoopHandle } from "../audio/sink";
import { createUI, type UIController } from "./ui";

// The game both playable pages share (ENG-13): renderer, physics, input,
// player, health, settings, HUD, menus, loadout, darts, carving, debris,
// falling pieces, Foamers on the level AI, sound, the fixed step, the loop
// and watch mode. A page supplies its geometry, its spawn rules and hooks
// for what only it does; nothing here knows which level is loaded.
//
// The step order is the pages' old one and must not change: health, player,
// Foamers, the page's step hook, blaster and aim, sounds, debris, pieces,
// darts, the page's beforeWorld hook, world.step, then afterWorld. Render
// order: debris, pieces, Foamers, the page's render hook, camera and
// viewmodel, HUD, darts, the listener, then the draw.

export interface BuildInput {
  rapier: Rapier;
  world: RAPIER.World;
  scene: THREE.Scene;
  mesherPool: MesherPool;
}

/** What a page's build hands back: its voxel volume, the bounds the nav
 *  grid covers, and where the player starts. */
export interface BuiltGame {
  voxels: VoxelVolume;
  voxelMesh: VolumeMesh;
  /** ENV-01 stage 3: the level's crates, or none (see `src/voxel/crates.ts`). */
  crates?: Crates;
  navBounds: NavBounds;
  spawn: THREE.Vector3;
  yaw?: number;
}

/** The hooks. The first block is called by the loop; the second is the
 *  menu's wiring. Everything except build may be returned from
 *  configure() instead, which is where a page has the game object. */
export interface GameHooks<T extends BuiltGame = BuiltGame> {
  /** The page builds its geometry here, after physics and the mesher pool
   *  exist and before the rest of the game is wired. */
  build(input: BuildInput): T;
  /** After the Foamers' step and before the blaster (the arena's runner). */
  step?(dt: number): void;
  /** After pieces.update and before the darts (the course's fall rule and
   *  its thrown block). */
  afterPieces?(dt: number): void;
  /** After darts.update and before world.step() (the course's block pose). */
  beforeWorld?(): void;
  /** After world.step() (the arena's fall rule, exit pad and banner). */
  afterWorld?(dt: number): void;
  /** Once per render frame, after the Foamers and before the camera (the
   *  arena's rift glow). */
  render?(dt: number, alpha: number): void;
  /** Once per render frame, after the HUD and before the darts (the
   *  course's thrown block poses). */
  renderLate?(dt: number, alpha: number): void;
  /** The pop's own effect: sounds, the HUD flash, the course's foam burst. */
  popEffect?(): void;
  /** ENV-03: the mod station the view is on (the page's `Stations.prompt`):
   *  the use prompt's word when no finisher or vacuum target takes the
   *  key first; null or absent leaves the other tools' prompts as before. */
  stationPrompt?(eye: THREE.Vector3, forward: THREE.Vector3): string | null;
  /** The scene knobs: the arena needs a bigger fog and shadow box. */
  scene?: SceneOptions;
  /** Wire the page's own spawns and return its late hooks. */
  configure?(game: Game<T>): Partial<GameHooks<T>> | void;
  /** The level-complete panel is up: only Play again unpauses (arena). */
  completeOpen?(): boolean;
  /** The title overlay draws when paused and this is true (the arena
   *  hides it behind the level-complete panel). */
  overlayAllowed?(): boolean;
  /** The Restart button. */
  onRestart?(): void;
  /** The Try again button (the arena's checkpoint rules). */
  onTryAgain?(): void;
  /** Play again on the level-complete panel (the arena only). */
  onPlayAgain?(): void;
  /** The watch global's name and the page's own state fields there. */
  watchName?: string;
  watchState?(): Record<string, unknown>;
}

export interface Game<T extends BuiltGame = BuiltGame> {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rapier: Rapier;
  world: RAPIER.World;
  input: Input;
  hud: Hud;
  store: SettingsStore;
  health: PlayerHealth;
  player: PlayerController;
  darts: DartSystem;
  loadout: Loadout;
  shield: Shield;
  pickups: PickupSystem;
  finisher: Finisher;
  melee: Melee;
  impacts: DartImpacts;
  debris: DebrisSystem;
  pieces: FallingPieces;
  mesherPool: MesherPool;
  foamers: FoamerSystem;
  levelAI: LevelAI;
  /** GAME-08: the vacuum; the arena page reads it in its step hook to keep
   *  the mod stations (`src/arena/stations.ts`) off the use key while a
   *  tool has a target. */
  vacuum: Vacuum;
  voxels: VoxelVolume;
  voxelMesh: VolumeMesh;
  audio: GameAudio;
  ui: UIController;
  /** The page's own built level, for its hooks and dev hook. */
  built: T;
  loop: ReturnType<typeof startLoop>;
}

/** The settings live: look, FOV, volume, damage taken, flashes. */
function applySettings(
  s: Settings, camera: THREE.PerspectiveCamera, health: PlayerHealth,
  hud: Hud, audio: GameAudio, shield: Shield, zoom: Zoom,
): void {
  shield.toggleMode = s.shieldMode;
  // GAME-09e: the look settings and the field of view go through the zoom,
  // which holds the player's own values and narrows them while zoomed.
  zoom.baseSensitivity = s.mouseSensitivity;
  zoom.baseFov = s.fov;
  lookSettings.invertY = s.invertY;
  camera.fov = zoom.fov;
  camera.updateProjectionMatrix();
  health.damageTaken = s.damageTaken;
  // GAME-04 stage 2: the parry window scales with the preset's multiplier (PLAN
  // 10); "custom" and unknown keys keep the data's own window.
  shield.parryWindowScale = DIFFICULTIES[s.difficulty]?.parryWindow ?? 1;
  hud.reduceFlashes = s.reduceFlashes;
  audio.applyVolume(s.volume, s.muted);
}

/** The status line's text once the game runs: the same line the pause menu
 *  writes (src/game/ui.ts), so the handover from boot to playing is invisible. */
const READY_TEXT = "Click to play. Esc to pause.";

export async function createGame<T extends BuiltGame>(hooks: GameHooks<T>): Promise<Game<T>> {
  const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
  const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
  const status = document.querySelector<HTMLParagraphElement>("#status")!;

  const { renderer, scene, camera } = createRenderer(canvas, hooks.scene);
  camera.rotation.order = "YXZ";
  scene.add(camera); // needed so children (the blaster viewmodel) render
  const input = new Input(canvas);
  const boot = pageBoot();
  const hud = new Hud(document.querySelector<HTMLDivElement>("#hud")!);
  boot.progress("Loading physics");
  const { rapier, world } = await createPhysics();
  boot.step("Rapier ready");
  const mesherPool = new MesherPool();

  boot.progress("Building level");
  const built = hooks.build({ rapier, world, scene, mesherPool });
  boot.step("Level built");
  const { voxels, voxelMesh, crates } = built;
  const voxelSize = voxels.voxelSize;
  const debris = new DebrisSystem(rapier, world);
  scene.add(debris.mesh);
  // Loose islands cut by a carve break off and fall as their own bodies.
  const pieces = new FallingPieces(rapier, world, mesherPool, debris);
  scene.add(pieces.group);

  const player = new PlayerController(rapier, world, built.spawn);
  if (built.yaw !== undefined) player.yaw = built.yaw;
  const eye = new THREE.Vector3();

  // UI-01 stage 1: the player's health. The damage of each Foamer attack
  // comes from data/foamers.json (attacks[].damage), looked up by id.
  const health = new PlayerHealth();
  // UI-01 stage 2: one settings store (localStorage, defaults on failure).
  const store = new SettingsStore();
  const darts = new DartSystem(scene, world, rapier, player.collider);
  // The loadout loads before the start overlay can resolve, so by the time
  // the player can act every viewmodel is on screen.
  boot.progress("Loading blasters");
  const loadout = await Loadout.load(camera, darts, (_id, i, n) =>
    boot.progress("Loading blasters", i, n));
  boot.step("Loadout ready");

  // GAME-09e: the zoom. It holds the player's own field of view and look
  // sensitivity, and narrows both while the `zoom` action is held with a
  // blaster whose data has a zoom block (B05). Driven in frame().
  const zoom = new Zoom();

  const _aimUnused = new THREE.Vector3();
  Loadout.muzzleToWorld = (camPoint, out) => {
    updateAim(camera, world, player.collider, camPoint, out, _aimUnused);
    return out;
  };
  // Voxel targets: the level's mesh, and every live Foamer (spawn and pop
  // keep it in step). Darts carve both.
  const voxelTargets: VoxelTarget[] = [voxelMesh];
  // GAME-09d: the shared explosion (B06's explosive mod today; B05 and B07
  // later). It carves the level's volume through the same carve and island
  // path a dart carve uses (not the Foamer parts: their volumes remesh on
  // the dart path only). The Foamer system is set below, where it exists.
  const explosion = new ExplosionSystem(world, debris, [voxelMesh]);
  explosion.ignore(player.collider); // never pushed, never hurt
  // Dart hits on a voxel wall carve a crater and throw foam debris.
  const impacts = new DartImpacts(darts, debris, voxelTargets, explosion);
  // ENG-08 stage 3b: one director and one nav grid for the level, baked
  // over the level's bounds and re-baked where a carve or a resting piece
  // changed the ground.
  const levelAI = makeLevelAI(
    rapier, world, built.navBounds, store.value.difficulty, built.voxels, built.voxelMesh.group.position,
  );
  // BUG-03: the level's voxel pieces are meshed off the main thread, so the
  // load-time bake of the grid meets only their surfaces. When the mesher
  // backlog clears their chunks are solid in the volume: re-bake the level
  // once through its solid test, so the first Foamer to path already sees
  // every block as an obstacle. A level with no pieces is never busy, so
  // this fires on the page's first step, harmlessly.
  let piecesReady = false;
  // Darts stuck to a broken-off island fall off as loose darts.
  pieces.onBreak = (c, r) => darts.releaseInSphere(c, r);
  // A piece that comes to rest may block a cell: re-bake its patch.
  pieces.onRest = (c, r) => levelAI.pieceRested(c, r);
  impacts.onCarve = (target, removed) => {
    if (target !== voxelMesh) return;
    carveReport(removed);
  };
  // GAME-09d: an explosion's carve drops its islands the same way.
  explosion.onCarve = (target, removed) => {
    if (target !== voxelMesh) return;
    carveReport(removed);
  };
  // ENV-01 stage 3: one carve path for everything that reports a carve
  // (darts through impacts.onCarve, melee through `carved` below). A crate
  // worn past its share goes whole here, and the island search runs on all
  // of it, so the crate above falls as it does when a crate is shot out.
  const carveReport = (removed: RemovedVoxel[]) => {
    let gone = removed;
    if (crates) {
      const res = crates.take(removed);
      for (const b of res.breaks)
        burstCrate(debris, b.voxels, voxelSize, (v) => voxelMesh.voxelToWorld(v));
      gone = res.removed;
    }
    pieces.afterCarve(voxelMesh, gone);
    // The grid re-bakes only where the carve was (ENG-08 stage 3b); the
    // removed voxels are in the volume's own coordinates and carveBounds
    // turns them into the world patch (src/game/shared.ts).
    const box = carveBounds(voxelMesh, gone);
    if (box) levelAI.carveChanged(box[0], box[1], box[2], box[3]);
  };
  // Foamer system: spawn, bonk, dart damage, pop. This is the first enemy,
  // GAME-03.
  const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
  // GAME-09d: a blast damages Foamers through the non-dart path (see
  // Foamers.blastDamage), and plays FX-explode at the point.
  explosion.foamers = foamers;
  explosion.onExplode = (p) => audio.play("FX-explode", { position: p });
  // GAME-10a: the F02's foam balls. They have no physics bodies (kinematic
  // raycasts), so they need no place of their own in the physics order.
  const projectiles = new ProjectileSystem(rapier, world, debris, player.collider, foamers);
  scene.add(projectiles.group);
  foamers.projectiles = projectiles;
  // GAME-04 stage 1: the shield. Its viewmodel hangs off the camera (the
  // same way the blaster's does); the disc in flight is a scene object.
  const shield = new Shield(rapier, world, scene, camera, player, loadout, foamers, debris, voxelTargets);
  camera.add(shield.group);
  // GAME-08: the vacuum's placeholder viewmodel, a code-built toy (no art
  // files): a foam-orange tube and a plastic wide nozzle at the end the
  // Foamer is drawn toward. It hangs off the camera like the shield's
  // viewmodel does, sits in the lower right of the view while the lock
  // runs, and is gone the moment it ends.
  const vacuumModel = new THREE.Group();
  {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.04, 0.5, 12),
      createFoamMaterial({ cellsPerUnit: 5, wrapCells: 0, color: "#ff7a1a" }),
    );
    tube.position.y = 0.1;
    const nozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.12, 12, 1, true),
      createFoamMaterial({ cellsPerUnit: 5, wrapCells: 0, color: "#e8e4f0" }),
    );
    nozzle.position.y = -0.08;
    nozzle.rotation.x = Math.PI; // open base to the top, the wide end
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a2340, roughness: 0.5 }),
    );
    collar.position.y = -0.02;
    vacuumModel.add(tube, nozzle, collar);
    vacuumModel.visible = false;
    // Aim the tool at the view: the nozzle leans down-left toward where
    // the Foamer is held by the lock, in the lower right.
    vacuumModel.rotation.set(0.5, -0.6, 0.15);
    camera.add(vacuumModel);
  }
  shield.onCarveAt = (p) => audio.play("DT-carve", { position: p });
  foamers.director = levelAI.director;
  foamers.navGrid = levelAI.grid;
  foamers.spawnState = "alert"; // an arena spawn is already in the fight
  scene.add(foamers.group);
  // GAME-07: the health pickups on the floor and the finisher that drops
  // them. A collected blob sounds and flashes the HUD here. LVL-02a: an
  // ammo box plays its own short sound and a small (not green) flash.
  const pickups = new PickupSystem(rapier, world, scene, health);
  const finisher = new Finisher(foamers, pickups);
  // GAME-06: melee weapon 1 and its charges. It reads the shield's public
  // state only (raised, charging, parries): GAME-04c owns that module.
  const melee = new Melee(rapier, world, foamers, debris, voxelTargets, player.collider);
  // The placeholder baton's sweep, and the blaster dip that goes with it.
  const meleeView = new MeleeView(camera);
  /** What the last watch swing() press did (null: nothing swung). */
  let lastSwing: number | null = null;
  pickups.onCollected = (kind, pos) => {
    if (kind === "ammo") {
      audio.play("PU-ammo", { position: pos });
      hud.ammoFlash();
      return;
    }
    audio.play("PU-health", { position: pos });
    hud.healFlash();
  };

  // Scratch vectors for the aim math; allocated once (aim.ts carries its
  // own).
  const _muzzleCam = new THREE.Vector3();
  const _muzzle = new THREE.Vector3();
  const _aimDir = new THREE.Vector3();
  const _playerPos = new THREE.Vector3();
  // BUG-02: the parry watch's scratch.
  const _playerCentre = new THREE.Vector3();

  /** The seconds until the nearest incoming (not bounced) ball is within
   *  a hit of the player's capsule (the sim's own ray), by the shared
   *  flight math (ball-time.ts), and that ball. 1e9 when there is none. */
  function parryNextWait(dt: number): { t: number; ball: LiveBall | null } {
    playerCapsuleCentre(player.eye(1, _playerPos), _playerCentre);
    let best = 1e9;
    let ball: LiveBall | null = null;
    for (const b of projectiles.list) {
      if (b.bounced) continue;
      const s = timeToImpact(b.pos, b.vel, dt, _playerCentre);
      if (s < best) { best = s; ball = b; }
    }
    return { t: best, ball };
  }

  /** The bound key as a label for the finisher prompt (data-driven, the
   *  card: from the input map): F, not KeyF. */
  function meleeKey() {
    const k = (inputJson.keyboard as Record<string, string[]>).melee?.[0] ?? "KeyF";
    return k.startsWith("Key") ? k.slice(3) : k;
  }

  /** The bound key as a label for the vacuum prompt (data-driven, the
   *  card: from the input map): E, not KeyE. */
  function useKey() {
    const k = (inputJson.keyboard as Record<string, string[]>).use?.[0] ?? "KeyE";
    return k.startsWith("Key") ? k.slice(3) : k;
  }

  let ui: UIController;
  // The audio engine can arrive before the UI controller exists (a click
  // during the loadout load), so the pause flag is tracked here too.
  let paused = true;
  const audio = createAudio({
    camera, loadout, player, darts, impacts, foamers,
    paused: () => paused,
    onReady: () => applySettings(store.value, camera, health, hud, audio, shield, zoom),
  });
  // GAME-08: the foam vacuum, E on a weakened stagger: the lock, the
  // suck, and the blasters' reserves credited with the type's shares.
  // After the audio: its loops and one-shots ride on the engine's sink.
  const vacuum = new Vacuum(foamers, loadout, debris, audio);

  /** GAME-04c: the foam saw's grind loop, while a thrown disc grinds. */
  let sawLoop: LoopHandle | null = null;

  /** The settings live. */
  function applyAll(): void {
    applySettings(store.value, camera, health, hud, audio, shield, zoom);
  }
  store.onChange(applyAll);
  // The defaults from storage go onto the camera, look and health now; the
  // engine gets volume and mute when it arrives (see audio.onReady).
  applyAll();

  // The bonk costs health (UI-01 stage 1). The chain is kept: the sound
  // wrapper (AUD-01) wraps this handler, and the console log stays.
  const logBonk = foamers.onBonk;
  foamers.onBonk = (f, attack) => {
    logBonk(f, attack);
    if (ui.paused) return;
    // GAME-04: an attack from the front arc behind the raised disc costs
    // only its data share. A blocked hit is not a hit: no HUD flash, and
    // the disc's own sound plays instead of the hurt one.
    const blocked = shield.blocksAttackFrom(f.centre);
    // GAME-10k: the melee parry (CONTENT-PLAN F11). An attack marked
    // parryable in the type's data (the Seawall's finisher) that meets the
    // raised disc inside the parry window is turned whole: the player
    // takes nothing, the disc gets its parry feedback and the Seawall
    // staggers and counts the parry on its shield. The decide is shared
    // (src/foamers/combo.ts) so any later type may mark an attack too.
    if (blocked && decideMeleeParry(f.spec, attack, true, shield.canParry()) === "parry") {
      shield.noteParry();
      foamers.parryAttack(f);
      audio.play("SH-parry", { position: f.centre });
      return;
    }
    const share = blocked ? shield.damageShare : 1;
    const lost = health.damage(damageOf(attack, f.spec) * share, attack);
    if (lost <= 0) return;
    if (blocked) {
      shield.noteBlocked();
      audio.play("SH-block", { position: f.centre });
      return;
    }
    hud.onHit();
    if (health.dead) ui.pop();
  };

  // GAME-10b: a Darter's charge that runs into the player stuns it for the
  // charge's own time (the controller stops moving, the look still works).
  // The hit itself comes through the bonk handler above, like any other.
  foamers.onChargeHit = (_f, seconds) => {
    if (ui.paused) return;
    player.stunTime = Math.max(player.stunTime, seconds);
    audio.play("F05-stun");
  };

  // GAME-10b: the scrape and the wall hit throw the data's dust chunks at the
  // Darter's feet and at the wall, and the wall hit gets its own sound.
  const chargeDust = (f: Foamer, point: THREE.Vector3) => {
    const charge = chargeOf(f.spec);
    if (!charge) return;
    debris.burst(point, charge.dustCount, charge.dustSize, materialId("foam-orange"));
  };
  foamers.onScrape = chargeDust;
  foamers.onWallHit = (_f, point) => {
    if (ui.paused) return;
    audio.play("F05-impact", { position: point });
  };

  // GAME-10f: the Brawler's shockwave. A ring the player is outside of when
  // it passes costs the shockwave's own damage once; a player in the air (a
  // jump) or in a dash is not on the floor for it and takes nothing.
  foamers.playerVulnerable = () => player.grounded && !player.dashing;
  foamers.onShockwaveHit = (f) => {
    if (ui.paused) return;
    const sw = shockwaveOf(f.spec);
    if (!sw) return;
    const lost = health.damage(sw.damage, "shockwave");
    if (lost <= 0) return;
    // The landing's own boom came through the Foamer sounds ("land"); this
    // is the player's hurt line, the same one a bonk plays.
    audio.play("PL-hurt");
    hud.onHit();
    if (health.dead) ui.pop();
  };

  // GAME-10a: a foam ball that reaches the player costs health like a bonk,
  // and the raised disc blocks it the same way. The arc is measured on the
  // ball's direction of travel (the point it came from), not its position.
  const _fromBall = new THREE.Vector3();
  projectiles.onHitPlayer = (b) => {
    if (ui.paused) return;
    // GAME-04 stage 2: a ball the player did not make (a F02's, from the pack) can
    // be parried back: it is one made with the shared BALL_MATERIAL.
    const parryable = b.mesh.material === BALL_MATERIAL;
    const speed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
    _fromBall.set(
      b.pos.x - (b.vel.x / speed) * 0.5,
      b.pos.y - (b.vel.y / speed) * 0.5,
      b.pos.z - (b.vel.z / speed) * 0.5,
    );
    const blocked = shield.blocksAttackFrom(_fromBall);
    if (blocked && parryable && shield.canParry()) {
      // GAME-04 stage 2: the parry: the ball flies back to its thrower. The
      // player takes no damage for it; the feedback is the sound, the
      // disc flash, the view kick and the tiny hit-stop (the sim
      // slows down from `shield.slowed` while it plays).
      shield.noteParry();
      projectiles.bounce(b);
      audio.play("SH-parry");
      return;
    }
    const share = blocked ? shield.damageShare : 1;
    // GAME-10c: a Floater's blob costs what its own attack says (spit 3,
    // big blob 10); a Roamer's ball keeps the throw damage.
    const lost = health.damage(damageOf(b.attack, b.thrower.spec) * share, "throw");
    if (lost <= 0) return;
    if (blocked) {
      shield.noteBlocked();
      // The burst's own sound already played at the hit point; this is the
      // disc's ring over it.
      audio.play("SH-block", { position: b.pos });
      return;
    }
    audio.play("FB-hit", { position: b.pos });
    hud.onHit();
    if (health.dead) ui.pop();
  };
  // The ball's sounds (placeholder IDs, GAME-10a): the throw itself comes
  // through the Foamer sounds wrapper (a "throw" event); these are the ball
  // meeting the player or the world, and (GAME-04 stage 2) the bounced ball
  // meeting a Foamer.
  projectiles.onSound = (kind, at) => {
    if (kind === "burst") audio.play("FB-burst", { position: at });
    else if (kind === "parryHit") audio.play("SH-parry-hit", { position: at });
    // GAME-10c: a small blob off the wall (placeholder ID, design/SOUNDS.md).
    else if (kind === "blobBounce") audio.play("F06-blobBounce", { position: at });
  };

  let pausedClock = renderJson.pausedFrame;
  function setPaused(p: boolean): void {
    ui.setPaused(p);
  }

  const game = {
    renderer, scene, camera, rapier, world, input, hud, store, health, player,
    darts, loadout, shield, pickups, finisher, melee, impacts, debris, pieces, mesherPool, foamers, levelAI, vacuum,
    voxels, voxelMesh, audio, ui: null as unknown as UIController, built,
    // The watch menu's prompt readout (ENV-03): what is on the
    // #finishprompt element this frame; updates every render, like
    // the vacuum's state field above it.
    prompt: { kind: "", shown: false } as { kind: string; shown: boolean },
    loop: null as unknown as ReturnType<typeof startLoop>,
  };

  // The page's own wiring, and the hooks that needed the game object.
  const late: Partial<GameHooks<T>> = hooks.configure?.(game) ?? {};
  const h = { ...hooks, ...late };

  ui = createUI(
    {
      input, hud, store, overlay, status,
      popEffect: () => h.popEffect?.(),
      onPause: (p) => {
        paused = p;
        audio.setPaused(p);
      },
    },
    {
      completeOpen: h.completeOpen,
      overlayAllowed: h.overlayAllowed,
      onRestart: () => { shield.reset(); vacuum.reset(); melee.reset(); meleeView.reset(); sawLoop?.stop(); sawLoop = null; h.onRestart?.(); },
      onTryAgain: () => { shield.reset(); vacuum.reset(); melee.reset(); meleeView.reset(); sawLoop?.stop(); sawLoop = null; h.onTryAgain?.(); },
      onPlayAgain: () => { shield.reset(); vacuum.reset(); melee.reset(); meleeView.reset(); sawLoop?.stop(); sawLoop = null; h.onPlayAgain?.(); },
    },
  );
  game.ui = ui;

  function fixedStep(dt: number): void {
    if (!ui.paused) {
      health.update(dt);
      // GAME-04 stage 2: the tiny parry hit-stop: while it runs the movables step
      // at parry.slow of the normal rate, for parry.hitStop seconds (the
      // shield counts the true dt, so the slow lasts that long).
      const w = shield.slowed(dt);
      // GAME-07: the finisher holds the player for its whole run; while it
      // is active the controller is not stepped at all. GAME-08: the
      // vacuum holds the player exactly as the finisher does (whatever
      // that is on main: the controller, the melee and the flash's use
      // block are all off while it sucks). The charge counts up either
      // way: it fills in rechargeSeconds, lock or no lock.
      vacuum.stepCharge(dt);
      if (finisher.active) {
        // The pop step sounds FX-pop itself (FoamerSystem.pop); only the
        // squeeze sound goes with the start below.
        finisher.update(dt, player);
      } else if (vacuum.active) {
        vacuum.update(dt, player);
      } else {
        // GAME-05: the dash goes to the shield first. The disc is up and
        // a target is locked, so it is the charge instead of the normal
        // dash: the shield takes the press and spends it here, before the
        // player's own step gets to start a dash with it. A charge that
        // starts here drives the player to the target itself (see the
        // shield's step); during it the player's own step and the melee
        // are suspended (a finisher cannot start mid-charge).
        if (input.wasPressed("dash") && shield.tryCharge()) {
          input.consumePress("dash");
          // The lock's blip; the rush's whoosh plays with the charge's
          // first step (se.chargeStart below), so holding the disc on a
          // locked Foamer stays quiet until the dash.
          audio.play("SH-lock");
        }
        if (!shield.charging) {
          player.update(dt, input);
          // Melee: a finishable Foamer in reach and in the view is
          // finished. GAME-06: with none finishable the press is the
          // weapon's (the card's key order); the course's debug blast has
          // its own binding now.
          if (input.wasPressed("melee")) {
            const eye = player.eye(1, _playerPos);
            const fwd = camera.getWorldDirection(_aimDir);
            let taken = false;
            for (const f of foamers.list) {
              // GAME-09b: a dying Foamer's kill is already decided.
              if (f.state !== "stagger" || f.dyingHit) continue;
              if (!finisher.attempt(f, eye, fwd, _muzzle)) continue;
              finisher.start(f, player, eye);
              input.consumePress("melee");
              // The squeeze; the pop's FX-pop comes with the pop itself.
              audio.play("FN-finisher", { position: f.centre });
              taken = true;
              break;
            }
            // GAME-06: the card's key order: the finisher saw the press
            // first; with none finishable it is the weapon's. The press is
            // spent either way (the bash is never nothing).
            if (!taken) {
              input.consumePress("melee");
              const me = melee.press(eye, fwd, shield);
              lastSwing = me.swung;
              if (me.swung !== null) audio.play(me.swung < 0 ? "ML-bash" : "ML-swing");
              if (me.swung !== null && me.swung >= 0) meleeView.swing(me.swung);
              if (me.empty) audio.play("ML-empty");
              for (const f of me.hits) audio.play("ML-hit", { position: f.centre });
              for (const p of me.carved) audio.play("DT-carve", { position: p });
              // ENV-01 stage 3: a melee carve counts against a crate too,
              // through the same path the darts use.
              for (const c of me.carves)
                if (c.target === voxelMesh) carveReport(c.removed);
              if (me.refills > 0) hud.meleePips(melee.charges, melee.maxCharges, true);
            }
          }
          // GAME-08: the foam vacuum's use key. With a target and a
          // charge the vacuum takes the press (consumePress, as the
          // finisher does with melee) and begins the lock. With a target
          // but no charge it plays the empty sound and still takes the
          // press: the page's old use (the course's block throw) must not
          // run behind the tool. With no target at all the press stays
          // for the page's old use.
          if (input.wasPressed("use")) {
            const r = vacuum.press(player.eye(1, _playerPos), camera.getWorldDirection(_aimDir), player);
            if (r !== null) input.consumePress("use");
          }
        }
      }
      // Foamer on a fixed step, before world.step().
      foamers.update(w, player.eye(1, _playerPos));
      // GAME-10a: the foam balls fly on their own rays, no bodies, so they
      // step with the Foamers that throw them. GAME-04 stage 2: a bounced ball is
      // just another ball on the same rays.
      projectiles.update(w);
      h.step?.(w);
      // Blaster: switch first (wheel down is next, up is prev), then the
      // muzzle from the active viewmodel, the aim 50 m down the view, and
      // the loadout's fixed step, then the darts.
      for (let i = 0; i < loadout.ids.length; i++) {
        const key = ["weapon1", "weapon2", "weapon3", "weapon4", "weapon5", "weapon6", "weapon7", "weapon8"][i];
        if (input.wasPressed(key as "weapon1")) loadout.select(i);
      }
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      // GAME-06: the melee's timers (the swing, the bash's cooldown, the
      // parry and timer refills) with the shield's own read handed over.
      const me = melee.update(dt, shield);
      if (me.refills > 0) {
        audio.play("ML-charge");
        // The pip's pulse when a parry (or the timer) refills a charge.
        hud.meleePips(melee.charges, melee.maxCharges, true);
      }
      // GAME-04: the shield after the player, so it can take this step's
      // fire press as the throw before the blaster sees it. Its own gate
      // says when the blaster may not fire (the disc is up, or out in the
      // world). A running charge drives the player in here instead (the
      // step above skipped it).
      loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
      updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
      const se = shield.update(dt, {
        fireHeld: input.isDown("fire"),
        firePressed: input.wasPressed("fire"),
        shieldHeld: input.isDown("shield"),
        shieldPressed: input.wasPressed("shield"),
        reloadPressed: input.wasPressed("reload"),
      });
      if (se.raised) audio.play("SH-raise");
      if (se.thrown) audio.play("SH-throw", { position: shield.discPosition });
      for (const p of se.hits) audio.play("SH-ricochet", { position: p });
      if (se.caught) audio.play("SH-catch");
      // GAME-04c: the foam saw. A loop while the disc grinds, pitched by
      // the fast spin, stopped when the grind ends (or the disc comes
      // home: catchDisc ends it too, so the stop is checked here).
      if (se.sawStart && !sawLoop) sawLoop = audio.loop("SH-saw");
      if (sawLoop) {
        const g = shield.grinding;
        if (g) {
          sawLoop.set(1, 0.85 + 0.3 * Math.min(1, g.seconds));
          sawLoop.setPosition(shield.discPosition);
        } else {
          sawLoop.stop();
          sawLoop = null;
        }
      }
      if (se.sawEnd) audio.play("SH-sawEnd", { position: shield.discPosition });
      // GAME-05: the charge's sounds: the whoosh on the first step, the
      // thud where it meets the Foamer.
      if (se.chargeStart) audio.play("SH-charge");
      if (se.chargeVictim) audio.play("SH-charge-hit", { position: se.chargeVictim.centre });
      // GAME-10b: the Darter's front plates stop a charge. A plate clang
      // where they met, and no hit sound.
      if (se.chargeBlocked) audio.play("F05-impact", { position: shield.discPosition });
      // No shooting while the disc is up, a finisher holds the player, or
      // a swing is running (GAME-06: the blaster cannot fire during a swing),
      // or the vacuum locks it (GAME-08).
      const canFire = !shield.blocksFire && !shield.usedFirePress && !finisher.active && !melee.swinging && !vacuum.active;
      loadout.update(
        dt,
        {
          fireHeld: canFire && input.isDown("fire"),
          firePressed: canFire && input.wasPressed("fire"),
          reloadPressed: input.wasPressed("reload"),
        },
        _aimDir,
      );
      // GAME-09g: B08's movement slow: while the active blaster is firing
      // (trigger held, wheels up to speed) the player moves at its
      // fireMoveShare. fireMoveScale multiplies in beside the shield's
      // speedScale; the switch never fires, so it clears then too.
      player.fireMoveScale =
        loadout.switching ? 1 : loadout.active.firing ? loadout.active.spec.fireMoveShare : 1;
      // The blaster, player and level hooks, one step per fixed step.
      audio.sounds?.update(dt, {
        fireHeld: canFire && input.isDown("fire"),
        firePressed: canFire && input.wasPressed("fire"),
        reloadPressed: input.wasPressed("reload"),
        sprintHeld: input.isDown("sprint"),
      });
      debris.update(dt);
      pieces.update(dt);
      h.afterPieces?.(w);
      darts.update(w);
      h.beforeWorld?.();
      world.step();
      // GAME-07: after the step, so the collect reads where physics left
      // the blob; the feet come out of the eye helper (it is the only way
      // to read the controller's position).
      pickups.update(w, _playerPos.setY(player.feet));
      h.afterWorld?.(dt);
    }
    input.endStep();
  }

  function renderFrame(dt: number, alpha: number): void {
    if (ui.paused) {
      pausedClock += dt;
      if (pausedClock < renderJson.pausedFrame) return;
      pausedClock = 0;
    } else pausedClock = renderJson.pausedFrame;
    // Everything that moves on the fixed step is drawn alpha of the way
    // between its last two steps, so it moves smoothly at any refresh rate.
    debris.syncRender(alpha);
    pieces.syncRender(alpha);
    foamers.syncRender(alpha);
    pickups.syncRender(alpha);
    h.render?.(dt, alpha);
    camera.position.copy(player.eye(ui.paused ? 1 : alpha, eye));
    // The active blaster's recoil climb tilts the view up (the player's own
    // pitch is unchanged, so releasing the trigger brings the view back up).
    // The parry's kick rides the same tilt as the blaster's climb and the
    // block's (GAME-04 stage 2).
    const climb = loadout.active.climb + shield.kick + shield.parryKick + melee.kick;
    camera.rotation.set(player.pitch + climb, player.yaw, 0);
    // The active blaster's viewmodel animates once per render frame.
    // GAME-08: lowered while the vacuum runs (added to the switch's dip).
    loadout.lowered = vacuum.active ? VacData.vacuum.blasterDip : 0;
    loadout.render(dt, input.isDown("fire"));
    // GAME-06: the baton's sweep, and the blaster dipped out of its way.
    // Applied after loadout.render, whose own dip only runs during a
    // blaster switch (a swing cannot fire, so the two rarely overlap).
    meleeView.render(dt);
    if (meleeView.dip !== 0) {
      // Same shape as Loadout.render's own dip call (setDip is not on the
      // LoadoutViewmodel interface).
      const vm = loadout.activeViewmodel as Partial<typeof loadout.activeViewmodel> & { setDip?(y: number): void };
      vm.setDip?.(meleeView.dip);
    }
    hud.setAmmo(loadout.active, loadout.active.state);
    hud.setHealth(health.hp, health.max);
    // GAME-07: the prompt by the crosshair, with the bound key's label.
    // GAME-08: the vacuum's prompt rides the same element: a vacuum
    // target and a finisher target are the same stagger on the same
    // gate, so at most one reads at a time, and the key names the tool
    // that would take it (the vacuum, E, then the finisher, F).
    {
      const eye = player.eye(ui.paused ? 1 : alpha, _playerPos);
      const fwd = camera.getWorldDirection(_aimDir);
      const done = !ui.paused && !finisher.active && !vacuum.active && finisher.has(eye, fwd);
      const vac = !ui.paused && !vacuum.active && !done && vacuum.hasTarget(eye, fwd) != null;
      // ENV-03: the mod station's prompt rides the same element, behind
      // the vacuum and the finisher: a level without stations returns
      // null, so those prompts are unchanged.
      const sta = !ui.paused && !finisher.active && !vacuum.active && !done && !vac ? h.stationPrompt?.(eye, fwd) : null;
      const staText = sta ? sta + " " + useKey() : null;
      hud.setFinishPrompt(done || vac || staText != null, done ? meleeKey() : staText ?? useKey());
      // The watch's readout of the same element.
      game.prompt.kind = done ? "melee" : staText != null ? "station" : vac ? "use" : "";
      game.prompt.shown = done || vac || staText != null;
      // GAME-08: the charge's one pip, filling as it recharges.
      hud.setVacCharge(vacuum.chargeFrac);
      // GAME-05: the lock marker at the crosshair, on while a charge
      // target is locked (the lock only lives while the disc is up).
      hud.setChargeLock(!ui.paused && shield.lockedTarget != null);
      // GAME-06: the charge pips beside the shield area.
      hud.meleePips(melee.charges, melee.maxCharges, false);
      // GAME-08: while the vacuum locks the player the blaster dips and
      // the placeholder vacuum (a toy tube and a wide nozzle, code-built,
      // no art files) rises in the lower right of the view.
      vacuumModel.visible = vacuum.active;
      if (vacuum.active) {
        // The rise: from off the bottom edge up into the lower right
        // corner over the first tenths of the lock, then it stays.
        const u = THREE.MathUtils.clamp(vacuum.lockT / (VacData.vacuum.turnTime + 0.1), 0, 1);
        vacuumModel.position.set(0.42, -0.34 + 0.05 * u, -1.0);
      }
    }
    h.renderLate?.(dt, alpha);
    darts.syncRender(alpha);
    // The spatial listener follows the camera each render frame.
    audio.engine?.updateListener();
    renderer.render(scene, camera);
    // PT-10: the first drawn frame is when the game counts as running: the
    // boot report gets its last step, and only now may a click take the
    // mouse (before that the cursor stays and the status line says it is
    // loading).
    if (!bootDone) {
      bootDone = true;
      firstFrame(boot, READY_TEXT, mesherPool, () => `${input.diagLine()}\n${loopDiagLine()}`);
      input.setReady();
    }
  }

  // PT-10: the Foamers' meshes arrive from the mesher pool a part at a time,
  // so the boot report shows them as a count. The counter is read only while
  // the boot is running, and the status line is written only when it moved.
  let bootDone = false;
  let foamersDone = false;
  let meshedDone = -1;
  let meshedTotal = -1;
  function reportFoamerMeshes(): void {
    let done = 0;
    for (const f of foamers.list) {
      let ready = true;
      for (const part of f.parts.values()) if (part.mesh.busy) { ready = false; break; }
      if (ready) done++;
    }
    if (done === meshedDone && foamers.list.length === meshedTotal) return;
    meshedDone = done;
    meshedTotal = foamers.list.length;
    boot.progress("Building Foamers", done, meshedTotal);
    if (meshedTotal > 0 && done === meshedTotal) {
      foamersDone = true;
      boot.step("Foamers meshed");
    }
  }

  const loop = startLoop({
    frame(dt) {
      input.poll();
      voxelMesh.update();
      // PT-10: the Foamer meshes are the slow part of a Firefox boot, and
      // the loop itself starts before they land, so keep counting them after
      // the first frame too (the report logs a late step; the ready line
      // stays).
      if (!foamersDone) reportFoamerMeshes();
      if (!piecesReady && !voxelMesh.busy) {
        piecesReady = true;
        levelAI.piecesReady();
      }
      if (ui.paused) return;
      // GAME-09e: the zoom before the look is read, so a zoomed aim is
      // finer in the same frame. A switch (a new active id) or a reload
      // drops the zoom; the key must be pressed again to get it back.
      zoom.setBlaster(loadout.activeId());
      if (loadout.active.state === "reloading") zoom.cancel();
      zoom.update(dt, input.isDown("zoom"));
      lookSettings.mouseSensitivity = zoom.sensitivity;
      const fov = zoom.fov;
      if (fov !== camera.fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const look = input.takeLook(dt);
      player.yaw -= look.yaw;
      player.pitch = THREE.MathUtils.clamp(player.pitch + look.pitch, -1.5, 1.5);
    },
    update(dt) {
      // Gamepad start toggles pause; with a mouse, Esc releases the lock.
      if (input.wasPressed("pause")) setPaused(!ui.paused);
      // M (the mute action in data/input.json) toggles the master mute,
      // through the store so the settings panel stays in step.
      if (input.wasPressed("mute")) store.set("muted", !store.value.muted);
      fixedStep(dt);
    },
    render: renderFrame,
  });
  game.loop = loop;

  // The first click or key starts the audio. The context must be made inside
  // that gesture: the pointer lock event comes later and is not a gesture, so
  // a strict browser (Safari) would keep a context made there silent.
  window.addEventListener("pointerdown", () => audio.start(), { capture: true });
  window.addEventListener("keydown", () => audio.start(), { capture: true });
  setPaused(true);

  // QA watch (the range's habit): ?watch starts unpaused without pointer
  // lock and the console drives the page for a hidden browser pane with no
  // animation frames.
  if (new URLSearchParams(location.search).has("watch")) {
    setPaused(false);
    const _move = new THREE.Vector3();
    const _feet = new THREE.Vector3();
    /** The player's feet as a vector: the eye helper is the only way to
     *  read x and z, and the controller exposes the height as a number. */
    const feet = (out: THREE.Vector3) => player.eye(1, out).setY(player.feet);
    const shared = {
      state: () => ({
        ...h.watchState?.(),
        paused: ui.paused,
        popped: ui.poppedOut,
        health: health.hp,
        shield: shield.state,
        // GAME-04 stage 2: parries landed, for the watch's helpers.
        parries: shield.parries,
        // GAME-04c: the foam saw: the target's rig and the grind's
        // seconds left, null when the disc is not grinding.
        grinding: shield.grinding,
        // GAME-05: the charge state for the watch: which Foamer it is
        // locked on and which one the running charge is driving at (they
        // agree while it runs).
        charge: {
          locked: shield.lockedTarget ? shield.lockedTarget.centre.toArray() : null,
          target: shield.chargeTarget ? shield.chargeTarget.centre.toArray() : null,
          running: shield.charging,
        },
        player: (() => {
          const p = feet(_feet);
          return [p.x, p.y, p.z].map((n) => Number(n.toFixed(3)));
        })(),
        foamers: { live: foamers.live, downed: foamers.downed.length,
          // GAME-10a: each Foamer's type (its rig id), and the live balls.
          types: foamers.list.map((f) => f.spec.rig),
          // GAME-10b: each Foamer's own state, so a check can see a Darter's
          // telegraph, charge and wallStun.
          states: foamers.list.map((f) => f.state),
          brains: foamers.list.map((f) => f.agent?.state ?? null),
          balls: projectiles.list.length },
        // GAME-07: the watch gets pickup counts and each Foamer's
        // finishable flag (a stagger is what the finisher acts on).
        pickups: { health: pickups.count("health") },
        finishable: foamers.list.map((f) => f.state === "stagger"),
        // GAME-06: the melee's charges, the combo step it is on, and the
        // seconds left of the running swing.
        melee: {
          charges: melee.charges, max: melee.maxCharges, step: melee.comboStep,
          swing: Number(melee.swingLeft.toFixed(3)), bash: Number(melee.bashLeft.toFixed(3)),
          swinging: melee.swinging,
        },
        // GAME-08: the vacuum's charge and recharge, and each Foamer's
        // vacuumable flag (a weakened stagger of an allowed type).
        vacuum: {
          charge: Number(vacuum.chargeFrac.toFixed(3)),
          ready: vacuum.ready,
        },
        vacuumable: foamers.list.map((f) =>
          f.state === "stagger" && f.finishWeakened && vacuum.canVacuum(f)),
      }),
      moveTo: (x: number, y: number, z: number) => player.teleport(_move.set(x, y, z)),
      look: (yaw: number, pitch: number) => {
        player.yaw = yaw;
        player.pitch = THREE.MathUtils.clamp(pitch, -1.5, 1.5);
      },
      /** Point the view at the body of the nearest Foamer still standing. */
      aimNearest: () => {
        const at = player.eye(1, _move);
        let best: THREE.Vector3 | null = null;
        for (const f of foamers.list) {
          if (foamers.downed.includes(f)) continue;
          if (!best || f.centre.distanceToSquared(at) < best.distanceToSquared(at)) best = f.centre;
        }
        if (!best) return false;
        const dx = best.x - at.x, dy = best.y + 1.2 - at.y, dz = best.z - at.z; // centre is the feet
        player.yaw = Math.atan2(-dx, -dz);
        player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        return [best.x, best.y, best.z].map((n) => Number(n.toFixed(2)));
      },
      pause: (on: boolean) => setPaused(on),
      fire: () => {
        loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
        updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
        loadout.update(STEP, { fireHeld: false, firePressed: true, reloadPressed: false }, _aimDir);
        darts.update(STEP);
        world.step();
      },
      /** GAME-04: hold the disc up (or drop it), and throw it. The throw
       *  presses fire once while the disc is up, as a player would. */
      block: (on: boolean) => {
        shield.forcedHold = on;
      },
      throwShield: () => {
        shield.forcedHold = true;
        // The disc rises over a few steps (block.raiseTime); run them, then
        // the press below is the throw, as it is for a player who waits.
        for (let i = 0; i < 30 && (shield.state !== "raised" || shield.raise < 1); i++)
          fixedStep(STEP);
        loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
        updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
        // One fire press, one step: the shield turns it into the throw.
        const e = shield.update(STEP, {
          fireHeld: true, firePressed: true, shieldHeld: true, shieldPressed: false,
          reloadPressed: false,
        });
        return e.thrown;
      },
      /** GAME-07: press the melee key against the view: a finishable
       *  Foamer in reach and in the view is finished, or the key is left
       *  (the page's debug blast gets it). */
      finish: () => {
        input.simulatePress("melee");
        fixedStep(STEP);
      },
      /** GAME-06: the watch helper. One step of the melee press: with a
       *  finishable Foamer in the view the finisher takes it, else the
       *  weapon swings (or bashes). The state's melee fields say what ran. */
      swing: () => {
        lastSwing = null;
        input.simulatePress("melee");
        fixedStep(STEP);
        return { charges: melee.charges, swung: lastSwing };
      },
      /** GAME-08: press the use key for one step: a vacuum target in
       *  reach and in the view is sucked (the lock runs out over the
       *  step's the fixed steps), or the key is left for the page's old
       *  use. */
      vacuum: () => {
        input.simulatePress("use");
        fixedStep(STEP);
      },
      /** GAME-05: press the dash once. With the disc up and a target
       *  locked it is a charge; otherwise it is the normal dash (the
       *  state's charge fields say which one ran). */
      charge: () => {
        input.simulatePress("dash");
        fixedStep(STEP);
      },
      /** GAME-04 stage 2 (BUG-02), fixed by BUG-04: the watch helper. It
       *  times the earliest incoming (not bounced) ball by its real flight
       *  (ball-time.ts) and, before the wait, turns the view to the ball's
       *  thrower (the Pit has several throwing on the same swing: facing
       *  the nearest one judged the arc on the wrong one), then steps
       *  without the disc until the ball is the shield's lead time away,
       *  holds the disc, and lowers it again once that ball has been
       *  parried, blocked or hit (the caller does not have to). */
      parryNext: () => {
        if (ui.paused) return false;
        const { t, ball } = parryNextWait(STEP);
        if (ball === null) return false;
        // Face the thrower of the timed ball (the view the disc's arc
        // judges on; the walk's steps keep it). Steps the ball's aim.
        const at = ball.thrower.centre;
        const dx = at.x - _playerPos.x, dy = at.y + 1.2 - _playerPos.y, dz = at.z - _playerPos.z;
        player.yaw = Math.atan2(-dx, -dz);
        player.pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.5, 1.5);
        // Wait without the shield: the ball keeps coming, and the raise
        // lands when it is the lead time away.
        const n = Math.round(Math.max(0, t - shield.parryLead) / STEP);
        for (let i = 0; i < n; i++) fixedStep(STEP);
        shield.forcedHold = true;
        // Then the page's own run: the timed ball lands, the page's
        // onHitPlayer decides (parry, block or hurt), and the disc is
        // lowered again so the caller does not have to (BUG-04).
        for (let i = 0; i < 60 * 5; i++) {
          fixedStep(STEP);
          if (!projectiles.list.includes(ball)) break;
          if (ball.bounced) break;
        }
        shield.forcedHold = false;
        return true;
      },
      step: (n: number) => {
        for (let i = 0; i < n; i++) fixedStep(STEP);
        renderFrame(STEP, 1);
      },
    };
    Object.assign(window, { [h.watchName ?? "dartGame"]: shared });
  }

  return game;
}
