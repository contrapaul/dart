import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { createRenderer, type SceneOptions } from "../render/scene";
import { createPhysics, type Rapier } from "../physics/world";
import { startLoop, STEP } from "../core/loop";
import { Input, settings as lookSettings } from "../core/input";
import { SettingsStore, type Settings } from "../core/settings";
import { PlayerController } from "../player/controller";
import { PlayerHealth } from "../player/health";
import { Shield } from "../player/shield";
import { DartSystem } from "../weapons/darts";
import { Loadout } from "../weapons/loadout";
import { updateAim } from "../weapons/aim";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { FoamerSystem } from "../foamers/foamers";
import { ProjectileSystem } from "../foamers/projectiles";
import { PickupSystem } from "../pickups/pickups";
import { Finisher } from "./finisher";
import inputJson from "../../data/input.json";
import { makeLevelAI, type LevelAI } from "../ai/level";
import type { NavBounds } from "../ai/nav-grid";
import { Hud } from "../ui/hud";
import type { VoxelVolume } from "../voxel/chunk";
import { DebrisSystem } from "../voxel/debris";
import { MesherPool } from "../voxel/mesher-pool";
import type { VolumeMesh } from "../voxel/volume-mesh";
import { FallingPieces } from "../voxel/pieces";
import renderJson from "../../data/render.json";
import { carveBounds } from "./shared";
import { damageOf } from "./attack";
import { createAudio, type GameAudio } from "./audio";
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
  impacts: DartImpacts;
  debris: DebrisSystem;
  pieces: FallingPieces;
  mesherPool: MesherPool;
  foamers: FoamerSystem;
  levelAI: LevelAI;
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
  hud: Hud, audio: GameAudio, shield: Shield,
): void {
  shield.toggleMode = s.shieldMode;
  lookSettings.mouseSensitivity = s.mouseSensitivity;
  lookSettings.invertY = s.invertY;
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  health.damageTaken = s.damageTaken;
  hud.reduceFlashes = s.reduceFlashes;
  audio.applyVolume(s.volume, s.muted);
}

export async function createGame<T extends BuiltGame>(hooks: GameHooks<T>): Promise<Game<T>> {
  const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
  const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
  const status = document.querySelector<HTMLParagraphElement>("#status")!;

  const { renderer, scene, camera } = createRenderer(canvas, hooks.scene);
  camera.rotation.order = "YXZ";
  scene.add(camera); // needed so children (the blaster viewmodel) render
  const input = new Input(canvas);
  const hud = new Hud(document.querySelector<HTMLDivElement>("#hud")!);
  const { rapier, world } = await createPhysics();
  const mesherPool = new MesherPool();

  const built = hooks.build({ rapier, world, scene, mesherPool });
  const { voxels, voxelMesh } = built;
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
  const loadout = await Loadout.load(camera, darts);

  const _aimUnused = new THREE.Vector3();
  Loadout.muzzleToWorld = (camPoint, out) => {
    updateAim(camera, world, player.collider, camPoint, out, _aimUnused);
    return out;
  };
  // Voxel targets: the level's mesh, and every live Foamer (spawn and pop
  // keep it in step). Darts carve both.
  const voxelTargets: VoxelTarget[] = [voxelMesh];
  // Dart hits on a voxel wall carve a crater and throw foam debris.
  const impacts = new DartImpacts(darts, debris, voxelTargets);
  // ENG-08 stage 3b: one director and one nav grid for the level, baked
  // over the level's bounds and re-baked where a carve or a resting piece
  // changed the ground.
  const levelAI = makeLevelAI(rapier, world, built.navBounds, store.value.difficulty);
  // Darts stuck to a broken-off island fall off as loose darts.
  pieces.onBreak = (c, r) => darts.releaseInSphere(c, r);
  // A piece that comes to rest may block a cell: re-bake its patch.
  pieces.onRest = (c, r) => levelAI.pieceRested(c, r);
  // Islands only form in a voxel wall, so isolate the carve notification.
  impacts.onCarve = (target, removed) => {
    if (target !== voxelMesh) return;
    pieces.afterCarve(voxelMesh, removed);
    // The grid re-bakes only where the carve was (ENG-08 stage 3b); the
    // removed voxels are in the volume's own coordinates and carveBounds
    // turns them into the world patch (src/game/shared.ts).
    const box = carveBounds(voxelMesh, removed);
    if (box) levelAI.carveChanged(box[0], box[1], box[2], box[3]);
  };
  // Foamer system: spawn, bonk, dart damage, pop. This is the first enemy,
  // GAME-03.
  const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
  // GAME-10a: the F02's foam balls. They have no physics bodies (kinematic
  // raycasts), so they need no place of their own in the physics order.
  const projectiles = new ProjectileSystem(rapier, world, debris, player.collider);
  scene.add(projectiles.group);
  foamers.projectiles = projectiles;
  // GAME-04 stage 1: the shield. Its viewmodel hangs off the camera (the
  // same way the blaster's does); the disc in flight is a scene object.
  const shield = new Shield(rapier, world, scene, camera, player, loadout, foamers, debris, voxelTargets);
  camera.add(shield.group);
  shield.onCarveAt = (p) => audio.play("DT-carve", { position: p });
  foamers.director = levelAI.director;
  foamers.navGrid = levelAI.grid;
  foamers.spawnState = "alert"; // an arena spawn is already in the fight
  scene.add(foamers.group);
  // GAME-07: the health pickups on the floor and the finisher that drops
  // them. A collected blob sounds and flashes the HUD here.
  const pickups = new PickupSystem(rapier, world, scene, health);
  const finisher = new Finisher(foamers, pickups);
  pickups.onCollected = (_kind, pos) => {
    audio.play("PU-health", { position: pos });
    hud.healFlash();
  };

  // Scratch vectors for the aim math; allocated once (aim.ts carries its
  // own).
  const _muzzleCam = new THREE.Vector3();
  const _muzzle = new THREE.Vector3();
  const _aimDir = new THREE.Vector3();
  const _playerPos = new THREE.Vector3();

  /** The bound key as a label for the finisher prompt (data-driven, the
   *  card: from the input map): F, not KeyF. */
  function meleeKey() {
    const k = (inputJson.keyboard as Record<string, string[]>).melee?.[0] ?? "KeyF";
    return k.startsWith("Key") ? k.slice(3) : k;
  }

  let ui: UIController;
  // The audio engine can arrive before the UI controller exists (a click
  // during the loadout load), so the pause flag is tracked here too.
  let paused = true;
  const audio = createAudio({
    camera, loadout, player, darts, impacts, foamers,
    paused: () => paused,
    onReady: () => applySettings(store.value, camera, health, hud, audio, shield),
  });

  /** The settings live. */
  function applyAll(): void {
    applySettings(store.value, camera, health, hud, audio, shield);
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
    const share = blocked ? shield.damageShare : 1;
    const lost = health.damage(damageOf(attack) * share, attack);
    if (lost <= 0) return;
    if (blocked) {
      shield.noteBlocked();
      audio.play("SH-block", { position: f.centre });
      return;
    }
    hud.onHit();
    if (health.dead) ui.pop();
  };

  // GAME-10a: a foam ball that reaches the player costs health like a bonk,
  // and the raised disc blocks it the same way. The arc is measured on the
  // ball's direction of travel (the point it came from), not its position.
  const _fromBall = new THREE.Vector3();
  projectiles.onHitPlayer = (b) => {
    if (ui.paused) return;
    const speed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
    _fromBall.set(
      b.pos.x - (b.vel.x / speed) * 0.5,
      b.pos.y - (b.vel.y / speed) * 0.5,
      b.pos.z - (b.vel.z / speed) * 0.5,
    );
    const blocked = shield.blocksAttackFrom(_fromBall);
    const share = blocked ? shield.damageShare : 1;
    const lost = health.damage(damageOf("throw") * share, "throw");
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
  // meeting the player or the world.
  projectiles.onSound = (kind, at) => {
    if (kind === "burst") audio.play("FB-burst", { position: at });
  };

  let pausedClock = renderJson.pausedFrame;
  function setPaused(p: boolean): void {
    ui.setPaused(p);
  }

  const game = {
    renderer, scene, camera, rapier, world, input, hud, store, health, player,
    darts, loadout, shield, pickups, finisher, impacts, debris, pieces, mesherPool, foamers, levelAI,
    voxels, voxelMesh, audio, ui: null as unknown as UIController, built,
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
      onRestart: () => { shield.reset(); h.onRestart?.(); },
      onTryAgain: () => { shield.reset(); h.onTryAgain?.(); },
      onPlayAgain: () => { shield.reset(); h.onPlayAgain?.(); },
    },
  );
  game.ui = ui;

  function fixedStep(dt: number): void {
    if (!ui.paused) {
      health.update(dt);
      // GAME-07: the finisher holds the player for its whole run; while it
      // is active the controller is not stepped at all.
      if (finisher.active) {
        // The pop step sounds FX-pop itself (FoamerSystem.pop); only the
        // squeeze sound goes with the start below.
        finisher.update(dt, player);
      } else {
        player.update(dt, input);
        // Melee: a finishable Foamer in reach and in the view is finished.
        // When none is, the key stays for the page's old behaviour (the
        // course's debug blast).
        if (input.wasPressed("melee")) {
          const eye = player.eye(1, _playerPos);
          const fwd = camera.getWorldDirection(_aimDir);
          for (const f of foamers.list) {
            if (f.state !== "stagger") continue;
            if (!finisher.attempt(f, eye, fwd, _muzzle)) continue;
            finisher.start(f, player, eye);
            input.consumePress("melee");
            // The squeeze; the pop's FX-pop comes with the pop itself.
            audio.play("FN-finisher", { position: f.centre });
            break;
          }
        }
      }
      // Foamer on a fixed step, before world.step().
      foamers.update(dt, player.eye(1, _playerPos));
      // GAME-10a: the foam balls fly on their own rays, no bodies, so they
      // step with the Foamers that throw them.
      projectiles.update(dt);
      h.step?.(dt);
      // Blaster: switch first (wheel down is next, up is prev), then the
      // muzzle from the active viewmodel, the aim 50 m down the view, and
      // the loadout's fixed step, then the darts.
      for (let i = 0; i < loadout.ids.length; i++) {
        const key = ["weapon1", "weapon2", "weapon3"][i];
        if (input.wasPressed(key as "weapon1")) loadout.select(i);
      }
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      // GAME-04: the shield first, so it can take this step's fire press as
      // the throw before the blaster sees it. Its own gate says when the
      // blaster may not fire (the disc is up, or out in the world).
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
      // No shooting while the disc is up or a finisher holds the player.
      const canFire = !shield.blocksFire && !shield.usedFirePress && !finisher.active;
      loadout.update(
        dt,
        {
          fireHeld: canFire && input.isDown("fire"),
          firePressed: canFire && input.wasPressed("fire"),
          reloadPressed: input.wasPressed("reload"),
        },
        _aimDir,
      );
      // The blaster, player and level hooks, one step per fixed step.
      audio.sounds?.update(dt, {
        fireHeld: canFire && input.isDown("fire"),
        firePressed: canFire && input.wasPressed("fire"),
        reloadPressed: input.wasPressed("reload"),
        sprintHeld: input.isDown("sprint"),
      });
      debris.update(dt);
      pieces.update(dt);
      h.afterPieces?.(dt);
      darts.update(dt);
      h.beforeWorld?.();
      world.step();
      // GAME-07: after the step, so the collect reads where physics left
      // the blob; the feet come out of the eye helper (it is the only way
      // to read the controller's position).
      pickups.update(dt, _playerPos.setY(player.feet));
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
    const climb = loadout.active.climb + shield.kick;
    camera.rotation.set(player.pitch + climb, player.yaw, 0);
    // The active blaster's viewmodel animates once per render frame.
    loadout.render(dt, input.isDown("fire"));
    hud.setAmmo(loadout.active, loadout.active.state);
    hud.setHealth(health.hp, health.max);
    // GAME-07: the prompt by the crosshair, with the bound key's label.
    {
      const eye = player.eye(ui.paused ? 1 : alpha, _playerPos);
      const fwd = camera.getWorldDirection(_aimDir);
      hud.setFinishPrompt(!ui.paused && !finisher.active && finisher.has(eye, fwd), meleeKey());
    }
    h.renderLate?.(dt, alpha);
    darts.syncRender(alpha);
    // The spatial listener follows the camera each render frame.
    audio.engine?.updateListener();
    renderer.render(scene, camera);
  }

  const loop = startLoop({
    frame(dt) {
      input.poll();
      voxelMesh.update();
      if (ui.paused) return;
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
        player: (() => {
          const p = feet(_feet);
          return [p.x, p.y, p.z].map((n) => Number(n.toFixed(3)));
        })(),
        foamers: { live: foamers.live, downed: foamers.downed.length },
        // GAME-07: the watch gets pickup counts and each Foamer's
        // finishable flag (a stagger is what the finisher acts on).
        pickups: { health: pickups.count("health") },
        finishable: foamers.list.map((f) => f.state === "stagger"),
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
      step: (n: number) => {
        for (let i = 0; i < n; i++) fixedStep(STEP);
        renderFrame(STEP, 1);
      },
    };
    Object.assign(window, { [h.watchName ?? "dartGame"]: shared });
  }

  return game;
}
