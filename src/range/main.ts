// Test range (ENG-11): a plain level with the frame-time graph, system
// switches and a test panel. Same structure as the game page without the
// voxel wall, the foam blocks, the thrown blocks and the melee debug blast.
// The frame and update steps must not allocate: every scratch vector lives
// at module scope, the stats hook reuses the loop's one records, and
// auto-strafe writes one reused object.
// First import on purpose: a boot that fails says so on the overlay.
import "../core/boot-errors";
import * as THREE from "three";
import { createRenderer } from "../render/scene";
import { QUALITY } from "../render/quality";
import { BlastFx } from "../render/blast-fx";
import { createPhysics } from "../physics/world";
import { startLoop, STEP, type FrameStats, loopDiagLine } from "../core/loop";
import { Input } from "../core/input";
import { PlayerController } from "../player/controller";
import { PlayerHealth } from "../player/health";
import { Shield } from "../player/shield";
import { DartSystem } from "../weapons/darts";
import { Loadout, modIds } from "../weapons/loadout";
import { updateAim } from "../weapons/aim";
import type { VoxelTarget } from "../weapons/impacts";
import type { Foamer } from "../foamers/foamer";
import { BALL_MATERIAL } from "../foamers/projectiles";
import { shockwaveOf } from "../foamers/leap";
import { makeLevelAI } from "../ai/level";
import { SettingsStore, DIFFICULTIES } from "../core/settings";
import type { PathPoints } from "../ai/nav-grid";
import { Hud } from "../ui/hud";
import { FrameLog, FrameGraph } from "../ui/frame-graph";
import { createRangeSystems, createLineup, createPierceRow, respawnLineup, fillReserves } from "./setup";
import { Barrels } from "../level/barrels";
import { LineupLabels } from "./labels";
import { TtkTracker, TtkPanel } from "./ttk";
import { RangeMenu, RangeMenuPanel } from "./menu";
import { foamerLabel } from "./labels";
import { MesherPool } from "../voxel/mesher-pool";
import { firstFrame, pageBoot } from "../core/boot-report";
import { AudioEngine } from "../audio/audio";
import { GameSounds } from "../audio/game-sounds";
import rangeJson from "../../data/range.json";
import { damageOf } from "../game/attack";
import { decideMeleeParry } from "../foamers/combo";
import dartsJson from "../../data/darts.json";
import soundsJson from "../../data/sounds.json";
import renderJson from "../../data/render.json";
import foamerData from "../../data/foamers.json";
import { timeToImpact, playerCapsuleCentre } from "../foamers/ball-time";

const R = (rangeJson as unknown as {
  range: {
    size: number;
    playerSpawn: [number, number, number];
    cover: [number, number, number, number, number, number][];
    spawn: { count: number; points: [number, number, number][] };
    lineup: {
      distanceMetres: number;
      spacingMetres: number;
      pierceRow: { type: string; distanceMetres: number; spacingMetres: number; count: number };
    };
    barrels: { positions: [number, number, number][] };
  };
  bench: { seconds: number; strafePeriod: number };
}).range;
const BENCH = (rangeJson as { bench: { seconds: number; strafePeriod: number } }).bench;
const SPAWN_POSE = new THREE.Vector3(...R.playerSpawn);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const overlay = document.querySelector<HTMLDivElement>("#overlay")!;
const hud = new Hud(document.querySelector<HTMLDivElement>("#hud")!);
const log = new FrameLog();
const graph = new FrameGraph(
  document.querySelector<HTMLCanvasElement>("#graphCanvas")!,
  document.querySelector<HTMLDivElement>("#graphbox")!,
  document.querySelector<HTMLElement>("#graphText")!,
  log,
);

const { renderer, scene, camera } = createRenderer(canvas, {}, QUALITY.preset);
camera.rotation.order = "YXZ";
scene.add(camera); // the blaster viewmodel is a child of the camera
const input = new Input(canvas);
const boot = pageBoot();
boot.progress("Loading physics");
const { rapier, world } = await createPhysics();
boot.step("Rapier ready");
const mesherPool = new MesherPool();

// The level: a flat floor, 4 m outer walls, the cover boxes from the data
// file and thin markers every 5 m down the long axis (no collider).
const FLOOR = 0x3d2f6b, WALL = 0x5a4890, COVER = 0x6b58a8, MARK = 0x7a68c0;
function addBox(
  x: number, y: number, z: number, w: number, h: number, d: number,
  color: number, collider = true,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = collider;
  scene.add(mesh);
  if (collider)
    world.createCollider(
      rapier.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
    );
}
addBox(0, -0.5, 0, R.size, 1, R.size, FLOOR);
const half = R.size / 2;
addBox(0, 2, -half, R.size, 4, 1, WALL);
addBox(0, 2, half, R.size, 4, 1, WALL);
addBox(-half, 2, 0, 1, 4, R.size, WALL);
addBox(half, 2, 0, 1, 4, R.size, WALL);
for (const c of R.cover) addBox(c[0], c[1], c[2], c[3], c[4], c[5], COVER);
for (let m = 5; m <= 30; m += 5)
  addBox(0, 0.01, R.playerSpawn[2] - m, 0.5, 0.02, 2, MARK, false);
boot.step("Range built");

const player = new PlayerController(rapier, world, SPAWN_POSE);
// UI-01 stage 1: health on the range too, with a God mode switch. The
// attack damage comes from data/foamers.json (attacks[].damage).
const health = new PlayerHealth();
const darts = new DartSystem(scene, world, rapier, player.collider);
// Sound (AUD-01 stage 2): the engine opens on the first click (the range Play
// button, or the canvas), and GameSounds gets it as its sink. The panel's
// Sound section is built when the engine arrives; the report's voice
// count reads the engine's pool.
let engine: AudioEngine | null = null;
let sounds: GameSounds | null = null;
let audioStarting = false;
function startAudio() {
  if (engine || audioStarting) return;
  audioStarting = true;
  AudioEngine.create(camera)
    .then((e) => {
      engine = e;
      sounds = new GameSounds(e, loadout, player, darts, impacts, foamers);
      buildSoundPanel();
    })
    .catch(() => { /* no Web Audio on this host: the range goes on silent */ })
    .finally(() => { audioStarting = false; });
}
// The loadout loads all three blasters and their GLTF viewmodels before the
// start overlay can resolve. The panel's blaster and mod rows drive this;
// the dart type buttons set the active blaster's dart type.
boot.progress("Loading blasters");
const loadout = await Loadout.load(camera, darts, (_id, done, total) =>
  boot.progress("Loading blasters", done, total));
boot.step("Loadout ready");
// Darts leave from the active muzzle's world point, pulled out of walls.
const _aimUnused = new THREE.Vector3();
Loadout.muzzleToWorld = (camPoint, out) => {
  updateAim(camera, world, player.collider, camPoint, out, _aimUnused);
  return out;
};
// Only the Foamers' parts are voxel targets on this page, and the system
// pushes each part in and out as Foamers spawn and go.
const voxelTargets: VoxelTarget[] = [];
// Dart hits on the Foamer parts carve craters and throw foam debris. The
// debris system, the shared explosion, the impacts, the Foamer system and the
// foam balls are built by the range's own factory, the way src/game/game.ts
// wires them: the impacts get an ExplosionSystem, so B07's rounds, B05's
// explosive mod and B06's every fifth shot explode here as they do in the
// game. The range has no voxel wall, so the blast has no volume to carve.
const { debris, explosion, impacts, foamers, projectiles } = createRangeSystems(
  rapier, world, darts, mesherPool, player.collider, voxelTargets,
);
const blastFx = new BlastFx(scene);
// ENV-05 (E15): the leaking foam barrels, two of them, placed from
// data/range.json. Their blast reaches the Foamers' system through the
// shared explosion (a blast on the range never hurts the player), and each
// blast that reaches another barrel sets it off a chainDelay later, so the
// page's own blast hook drives the ripple. A dart hit chains after the
// impacts and the Foamer system, so those have seen the hit first.
const barrels = new Barrels(rapier, world, scene, debris, explosion, R.barrels.positions.map((pos) => ({ pos })));
const barrelsHit = darts.onHit;
darts.onHit = (hit) => {
  barrelsHit(hit);
  barrels.hit(hit);
};
// ENV-05: a dart stuck in a barrel rides a fixed collider, so left alone it
// would hang in the air once the barrel went. The barrels say when one has
// gone and the darts inside it come loose, as a carve does with foam.
barrels.onGone = (centre, radius) => darts.releaseInSphere(centre, radius);
explosion.onExplode = (p, radius) => {
  blastFx.spawn(p, radius);
  barrels.onBlast(p, radius);
};
// PT-01 stage 3: the time-to-kill readout. It wraps the dart system's fire
// (to know which blaster and which mods fired each shot) and subscribes to
// hits last, after the Foamer system has said which Foamer was hit.
const ttk = new TtkTracker();
ttk.track(darts, loadout, foamers);
new TtkPanel(
  document.querySelector<HTMLDivElement>("#ttk")!, ttk, foamerLabel,
);
scene.add(debris.mesh);
scene.add(projectiles.group);
projectiles.onSound = (kind, at) => {
  if (!engine) return;
  if (kind === "burst") engine.play("FB-burst", { position: at });
  else if (kind === "parryHit") engine.play("SH-parry-hit", { position: at });
  // GAME-10c: a small blob off the wall (placeholder ID, design/SOUNDS.md).
  else if (kind === "blobBounce") engine.play("F06-blobBounce", { position: at });
};
// GAME-04 stage 1: the shield on the range too, so its panel and watch
// can drive it. Same class and data as the game pages; the wiring here is
// this page's own loop, not a copy of game logic.
const shield = new Shield(rapier, world, scene, camera, player, loadout, foamers, debris, voxelTargets);
camera.add(shield.group);
foamers.spawnCount = R.spawn.count;
foamers.spawnPoints = R.spawn.points.map((p) => [p[0], p[1], p[2]]);
// ENG-08 stage 3b: one director (its difficulty from the settings preset's
// director key) and one nav grid, baked over the range floor at load.
const store = new SettingsStore();
// GAME-04 stage 2: the parry window's difficulty multiplier, like every other
// preset value on this page.
shield.parryWindowScale = DIFFICULTIES[store.value.difficulty]?.parryWindow ?? 1;
const levelAI = makeLevelAI(
  rapier, world, { minX: -half, maxX: half, minZ: -half, maxZ: half }, store.value.difficulty,
);
foamers.director = levelAI.director;
foamers.navGrid = levelAI.grid;
foamers.spawnState = "idle"; // range spawns start idle, so the sight test works
scene.add(foamers.group);
// PT-01 stage 2: the lineup. One of every Foamer type in the data, in a line
// across the range at the data's distance and spacing, facing the player, and
// held so each stands still: no brain, no walk, no attack, no projectile, no
// heal, no hover. They still take damage, lose parts, go down, pop and
// dissolve, which is what the time-to-kill test needs. The labels are one
// plain div each above the line (its type, its name, its health now).
const TYPES = Object.keys(foamerData.types);
let lineup = createLineup(foamers, SPAWN_POSE, TYPES, R.lineup.distanceMetres, R.lineup.spacingMetres);
// PT-03 stage 3: the punch test's row, straight ahead and nearer than the
// arc, three F01s one behind another. Respawning puts it back with the line.
createPierceRow(
  foamers, SPAWN_POSE, R.lineup.pierceRow.type, R.lineup.pierceRow.distanceMetres,
  R.lineup.pierceRow.spacingMetres, R.lineup.pierceRow.count,
);
const labels = new LineupLabels(
  document.querySelector<HTMLDivElement>("#hud")!, camera, foamers, lineup,
);
// Respawn (the menu's button, and key T: R is reload) puts the whole line
// back, fresh. The spawner's own keep-alive count is 0 on this page, so
// nothing else repopulates it.
function respawnLineupHere(): void {
  lineup = respawnLineup(
    foamers, SPAWN_POSE, TYPES, R.lineup.distanceMetres, R.lineup.spacingMetres,
    R.lineup.pierceRow,
  );
  labels.retarget(lineup);
  ttk.reset(); // the line that is going is not being watched any more
  barrels.reset(); // ENV-05: the barrels come back with the line
}
foamers.onBonk = (_f, attack) => {
  if (switches.godMode || paused) return;
  // GAME-04: an attack from the front arc behind the raised disc costs
  // only its data share; a blocked hit is not a hit, so no HUD flash.
  const blocked = shield.blocksAttackFrom(_f.centre);
  // GAME-10k: the melee parry on the range too, same as the game page:
  // an attack marked parryable met inside the parry window is turned
  // whole, the Foamer staggers and its tell part counts the parry.
  if (blocked && decideMeleeParry(_f.spec, attack, true, shield.canParry()) === "parry") {
    shield.noteParry();
    foamers.parryAttack(_f);
    if (engine) engine.play("SH-parry", { position: _f.centre });
    return;
  }
  const lost = health.damage(damageOf(attack, _f.spec) * (blocked ? shield.damageShare : 1), attack);
  if (lost <= 0) return;
  if (blocked) {
    shield.noteBlocked();
    if (engine) engine.play("SH-block", { position: _f.centre });
    return;
  }
  hud.onHit();
};
// GAME-10f: the Brawler's shockwave on the range too. A ring the player is
// outside of when it passes costs the shockwave's own damage once; in the
// air (a jump) or in a dash they are not on the floor for it.
foamers.playerVulnerable = () => player.grounded && !player.dashing;
foamers.onShockwaveHit = (f) => {
  if (switches.godMode || paused) return;
  const sw = shockwaveOf(f.spec);
  if (!sw) return;
  const lost = health.damage(sw.damage, "shockwave");
  if (lost <= 0) return;
  hud.onHit();
};

// GAME-10a: a foam ball that reaches the player costs health like a bonk,
// the disc blocking its direction of travel (the point it came from).
const _fromBall = new THREE.Vector3();
projectiles.onHitPlayer = (b) => {
  if (switches.godMode || paused) return;
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
    // The parry: the ball flies back to its thrower; the player takes no
    // damage for it, and the page's feedback is the same set as on the
    // game page (sound, flash, kick, the tiny hit-stop below).
    shield.noteParry();
    projectiles.bounce(b);
    if (engine) engine.play("SH-parry");
    return;
  }
  // GAME-10c: a Floater's blob costs what its own attack says (spit 3,
  // big blob 10); a Roamer's ball keeps the throw damage.
  const lost = health.damage(damageOf(b.attack, b.thrower.spec) * (blocked ? shield.damageShare : 1), "throw");
  if (lost <= 0) return;
  if (blocked) {
    shield.noteBlocked();
    if (engine) engine.play("SH-block", { position: b.pos });
    return;
  }
  if (engine) engine.play("FB-hit", { position: b.pos });
  hud.onHit();
};

// Blaster and mod panel rows, built after the loadout resolves. The mod
// row is rebuilt whenever the active blaster changes or a mod is toggled.
const blasterRow = document.querySelector<HTMLDivElement>("#blasterSelect")!;
const modRow = document.querySelector<HTMLDivElement>("#modToggles")!;
function renderBlasterRow() {
  blasterRow.textContent = "";
  loadout.ids.forEach((id, i) => {
    const b = document.createElement("button");
    b.textContent = id;
    b.addEventListener("click", () => {
      loadout.select(i);
      renderBlasterRow();
      renderModRow();
    });
    if (i === loadout.activeIndex) b.classList.add("on");
    blasterRow.appendChild(b);
  });
}
function renderModRow() {
  modRow.textContent = "";
  const i = loadout.activeIndex;
  for (const mod of modIds(loadout.ids[i])) {
    const b = document.createElement("button");
    b.textContent = mod;
    const on = loadout.modsOf(i).includes(mod);
    if (on) b.classList.add("on");
    b.addEventListener("click", () => {
      loadout.setMod(i, mod, !on);
      applyInfiniteAmmoHooks();
      renderModRow();
    });
    modRow.appendChild(b);
  }
}
renderBlasterRow();
renderModRow();

// PT-01 stage 3: the menu the card asks for. On the default page the panel
// shows only the active blaster's name, one button per mod of it (lit when
// on), and Respawn. Esc frees the pointer and shows it, as before; the Play
// button or a click on the canvas goes back to shooting. The old switches,
// spawn buttons, type picker, sound rows, report and graph live in the panel
// behind range.html?bench.
const menu = new RangeMenu(loadout);
const menuPanel = new RangeMenuPanel(
  menu,
  document.querySelector<HTMLParagraphElement>("#menuBlaster")!,
  document.querySelector<HTMLDivElement>("#menuMods")!,
  document.querySelector<HTMLButtonElement>("#menuRespawn")!,
  () => respawnLineupHere(),
);
// The bench tools stay on the page for performance work, hidden until
// range.html?bench asks for them.
document.querySelector<HTMLDivElement>("#benchTools")!.hidden =
  !new URLSearchParams(location.search).has("bench");
// The frame graph is a bench tool too (Backquote still shows it).
if (!new URLSearchParams(location.search).has("bench") && graph.shown) graph.toggle();

// Switches, each listed in the report.
const switches = {
  foamers: true, shadows: QUALITY.preset.shadows, pixelRatio: true, snap: true,
  strafe: false, infiniteAmmo: false, godMode: false, nav: false,
};
// Infinite ammo refills the active blaster's magazine after every shot.
function applyInfiniteAmmoHooks() {
  for (const b of loadout.blasters) {
    b.onShot = (muzzleIndex: number) => {
      // Call the viewmodel's original hook first.
      loadout.viewmodels[loadout.blasters.indexOf(b)]
        .onShot(muzzleIndex);
      if (switches.infiniteAmmo) b.refill();
    };
  }
}
applyInfiniteAmmoHooks();
// Auto-strafe: a sideways walk that turns around every BENCH.strafePeriod
// seconds, written into one reused object the Input reads instead of the
// keys.
const strafeMove = { x: 1, y: 0 };
let strafeTimer = 0;
let strafeDir = 1;
function strafeStep(dt: number) {
  strafeTimer -= dt;
  if (strafeTimer <= 0) {
    strafeTimer += BENCH.strafePeriod;
    strafeDir = -strafeDir;
  }
  strafeMove.x = strafeDir;
}

let loopCtl: ReturnType<typeof startLoop>;
function setSwitch(name: keyof typeof switches, on: boolean) {
  if (switches[name] === on) return;
  switches[name] = on;
  document.querySelectorAll<HTMLButtonElement>(`button[data-switch="${name}"]`).forEach((b) =>
    b.classList.toggle("on", b.dataset.on === "1" ? on : !on));
  switch (name) {
    case "foamers":
      if (!on) foamers.clear(); // the spawner is off with it
      break;
    case "shadows":
      renderer.shadowMap.enabled = on;
      scene.traverse((o) => {
        if (o instanceof THREE.DirectionalLight) o.castShadow = on;
        else if (o instanceof THREE.Mesh) {
          const m = Array.isArray(o.material) ? o.material : [o.material];
          for (const mm of m) mm.needsUpdate = true;
        }
      });
      break;
    case "pixelRatio":
      renderer.setPixelRatio(on ? Math.min(window.devicePixelRatio, QUALITY.preset.pixelRatioMax) : 1);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      break;
    case "snap":
      loopCtl.setSnap(on);
      break;
    case "strafe":
      input.moveOverride = on ? strafeMove : null;
      break;
    case "infiniteAmmo":
      break;
    case "nav":
      // Built the first time it is switched on, from the grid's own cells.
      showNavGrid(on);
      break;
    case "godMode":
      if (on) {
        health.reset();
        hud.clearFlash();
      }
      break;
  }
}
document.querySelectorAll<HTMLButtonElement>("button[data-switch]").forEach((b) =>
  b.addEventListener("click", () =>
    setSwitch(b.dataset.switch! as keyof typeof switches, b.dataset.on === "1")));
for (const k of Object.keys(switches) as (keyof typeof switches)[])
  document.querySelectorAll<HTMLButtonElement>(`button[data-switch="${k}"]`).forEach((b) =>
    b.classList.toggle("on", b.dataset.on === "1" ? !!switches[k] : !switches[k]));

// One dart type button per entry in data/darts.json, for the active blaster.
const dartRow = document.querySelector<HTMLDivElement>("#dartTypes")!;
function renderDartRow() {
  dartRow.textContent = "";
  const activeType = loadout.active.dartType;
  for (const t of Object.keys((dartsJson as { types: object }).types)) {
    const b = document.createElement("button");
    b.textContent = t;
    b.addEventListener("click", () => {
      loadout.setDartType(loadout.activeIndex, t as typeof activeType);
      renderDartRow();
    });
    if (t === activeType) b.classList.add("on");
    dartRow.appendChild(b);
  }
}
renderDartRow();
// Keep alive: 0, 1, 4 or 10 steady.
const keepRow = document.querySelector<HTMLDivElement>("#keepAlive")!;
for (const k of [0, 1, 4, 10]) {
  const b = document.createElement("button");
  b.textContent = String(k);
  b.addEventListener("click", () => {
    foamers.spawnCount = k;
    keepRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  keepRow.appendChild(b);
}
// GAME-10a: which type the spawn buttons and the keep-alive spawner make.
const typeRow = document.querySelector<HTMLDivElement>("#foamerType")!;
let foamerType = "F01";
for (const t of Object.keys(foamerData.types)) {
  const b = document.createElement("button");
  b.textContent = t;
  b.addEventListener("click", () => {
    foamerType = t;
    foamers.spawnType = t;
    typeRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  if (t === foamerType) b.classList.add("on");
  typeRow.appendChild(b);
}
// GAME-09b: spawn Foamers already finishable, so a chunk can be tried on an
// F01 with B03 (its tier is Fodder, so at full health the rule refuses).
const weakenRow = document.querySelector<HTMLDivElement>("#weaken")!;
let weakenSpawn = false;
for (const [label, on] of [["yes", true], ["no", false]] as const) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", () => {
    weakenSpawn = on;
    weakenRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  if (on === weakenSpawn) b.classList.add("on");
  weakenRow.appendChild(b);
}
/** Put a fresh Foamer into the finishable band, with no stagger: the card
 *  only needs the weakened flag and health under finisher.weakenShare. */
function weaken(f: Foamer | null) {
  if (!f || !weakenSpawn) return;
  f.health = Math.min(f.health, f.spec.finisher.weakenShare * f.maxHealth * 0.5);
  f.finishWeakened = true;
}
// Spawn a Foamer at set metres ahead of the player, on the floor.
const _fwd = new THREE.Vector3();
const _fwdxz = new THREE.Vector3();
const _feet = new THREE.Vector3();
function spawnAhead(m: number) {
  camera.getWorldDirection(_fwd);
  player.eye(1, _fwdxz);
  _feet.set(_fwdxz.x + _fwd.x * m, 0, _fwdxz.z + _fwd.z * m);
  // GAME-10d: the Swarmer comes as its whole pack, so one button press
  // shows the ring the card describes; the others still spawn singly.
  if (foamerType === "F03") {
    for (const p of foamers.spawnPack(_feet, camera.position)) weaken(p);
  } else if (foamerType === "F04") {
    // GAME-10e: a Blocker comes as its line, the shield wall the card
    // describes, so one press shows it (and it can then close up).
    for (const p of foamers.spawnLine(_feet, camera.position)) weaken(p);
  } else weaken(foamers.spawn(_feet, camera.position, foamerType));
}
for (const [id, m] of [["#spawn5", 5], ["#spawn10", 10], ["#spawn20", 20], ["#spawn30", 30]] as const)
  document.querySelector<HTMLButtonElement>(id)!.addEventListener("click", () => spawnAhead(m));
document.querySelector<HTMLButtonElement>("#respawn")!.addEventListener("click", respawnLineupHere);
document.querySelector<HTMLButtonElement>("#clearFoamers")!.addEventListener("click", () =>
  foamers.clear());
// GAME-11: break the nearest living Foamer's left leg, to watch a fall.
document.querySelector<HTMLButtonElement>("#breakLeg")!.addEventListener("click", () =>
  foamers.breakLegForTest());

// The Nav grid overlay (ENG-08 stage 3b): one InstancedMesh of thin tiles on
// every walkable cell, built when the switch is first turned on, and one
// line per living Foamer showing the path it is following. Both are redrawn
// each step while the switch is on; nothing is built while it is off.
let navMesh: THREE.InstancedMesh | null = null;
const navPathLines = new THREE.Group();
scene.add(navPathLines);
const navCellGeo = new THREE.BoxGeometry(1, 1, 1);
const navCellMat = new THREE.MeshBasicMaterial({
  color: 0x7ef0c0, transparent: true, opacity: 0.22, depthWrite: false,
});
const _navM = new THREE.Matrix4();
const _navC = new THREE.Color();

function buildNavMesh() {
  const g = levelAI.grid;
  let n = 0;
  for (let i = 0; i < g.walkable.length; i++) if (g.walkable[i] === 1) n++;
  const mesh = new THREE.InstancedMesh(navCellGeo, navCellMat, Math.max(1, n));
  mesh.count = n;
  mesh.frustumCulled = false;
  let k = 0;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c;
      if (g.walkable[i] !== 1) continue;
      const y = g.ground[i]!;
      _navM.makeScale(g.cell * 0.94, 0.02, g.cell * 0.94);
      _navM.setPosition(g.minX + (c + 0.5) * g.cell, y + 0.02, g.minZ + (r + 0.5) * g.cell);
      mesh.setMatrixAt(k, _navM);
      _navC.setHSL(0.42, 0.6, 0.4 + 0.25 * Math.min(1, Math.max(0, y / 4)));
      mesh.setColorAt(k, _navC);
      k++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** The path line for one Foamer, as a BufferGeometry rewritten in place. */
interface NavLine {
  line: THREE.Line;
  pos: Float32Array;
}
const navLines = new Map<number, NavLine>();
const NAV_LINE_POINTS = 256;

function navLineFor(f: number): NavLine {
  let l = navLines.get(f);
  if (l) return l;
  const pos = new Float32Array(NAV_LINE_POINTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd166 }));
  line.frustumCulled = false;
  navPathLines.add(line);
  l = { line, pos };
  navLines.set(f, l);
  return l;
}

function showNavGrid(on: boolean) {
  if (!on) {
    if (navMesh) navMesh.visible = false;
    navPathLines.visible = false;
    return;
  }
  // Rebuilt on every switch-on (cheap, and the grid may have re-baked): one
  // InstancedMesh, not one mesh per cell.
  if (!navMesh) {
    navMesh = buildNavMesh();
    scene.add(navMesh);
  } else {
    scene.remove(navMesh);
    navMesh.geometry.dispose();
    (navMesh.material as THREE.Material).dispose();
    navMesh = buildNavMesh();
    scene.add(navMesh);
  }
  navMesh.visible = true;
  navPathLines.visible = true;
}

/** Redraw every Foamer's path line, while the switch is on. */
function updateNavPaths() {
  if (!switches.nav) return;
  const seen = new Set<number>();
  foamers.list.forEach((f, i) => {
    seen.add(i);
    const l = navLineFor(i);
    const path: PathPoints | undefined = f.agent?.path;
    const n = path ? Math.min(path.count, NAV_LINE_POINTS) : 0;
    for (let k = 0; k < n; k++) {
      l.pos[k * 3] = path!.xs[k]!;
      l.pos[k * 3 + 1] = (levelAI.grid.groundAt(path!.xs[k]!, path!.zs[k]!) || 0) + 0.12;
      l.pos[k * 3 + 2] = path!.zs[k]!;
    }
    l.line.geometry.setDrawRange(0, n);
    (l.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    l.line.geometry.computeBoundingSphere();
  });
  for (const [k, l] of navLines) {
    if (seen.has(k)) continue;
    l.line.removeFromParent();
    l.line.geometry.dispose();
    navLines.delete(k);
  }
}

// The director's token state, for the report (ENG-08 stage 3b).
function directorReport(): string {
  const st = levelAI.director.stats();
  return `melee ${st.melee.inUse}/${st.melee.cap} ranged ${st.ranged.inUse}/${st.ranged.cap} waiting ${st.waiting}`;
}

// Report and copy.
const reportEl = document.querySelector<HTMLPreElement>("#report")!;
function reportText(): string {
  const mods = loadout.modsOf(loadout.activeIndex);
  const extra: Record<string, string | number> = {
    foamers: switches.foamers ? "on" : "off",
    shadows: switches.shadows ? "on" : "off",
    pixelRatio: switches.pixelRatio ? "device" : "1",
    snap: switches.snap ? "on" : "off",
    autoStrafe: switches.strafe ? "on" : "off",
    infiniteAmmo: switches.infiniteAmmo ? "on" : "off",
    keepAlive: foamers.spawnCount,
    director: directorReport(),
    blaster: loadout.activeId(),
    dartType: loadout.active.dartType,
    voices: engine ? engine.playingCount : 0,
    mods: mods.length ? mods.join(",") : "none",
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    screen: window.screen.width + "x" + window.screen.height,
  };
  return log.report(extra);
}
function showReport() { reportEl.textContent = reportText(); }
document.querySelector<HTMLButtonElement>("#reportBtn")!.addEventListener("click", showReport);
document.querySelector<HTMLButtonElement>("#copyBtn")!.addEventListener("click", () =>
  navigator.clipboard.writeText(reportText()).catch(() => {}));
document.querySelector<HTMLButtonElement>("#clearLog")!.addEventListener("click", () => {
  log.reset();
  reportEl.textContent = "";
});

// Pausing plays like the game page: Esc releases the lock and shows this
// panel, the Play button captures the mouse again.
let paused = true;
function setPaused(p: boolean) {
  paused = p;
  overlay.hidden = !p;
  hud.show(!p);
  if (engine) { if (p) engine.suspend(); else engine.resume(); }
  if (p && input.locked) document.exitPointerLock();
}
input.onLockChange = (locked) => setPaused(!locked);
// The first click or key starts the audio, inside that gesture (the pointer
// lock event is not a gesture, and Safari keeps a context made there silent).
window.addEventListener("pointerdown", startAudio, { capture: true });
window.addEventListener("keydown", startAudio, { capture: true });
document.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", () => input.requestLock());
// PT-01: the card asks for a click on the canvas to play again. The overlay
// covers it while paused, so the click that is not on a button does this.
canvas.addEventListener("click", () => { if (!input.locked) input.requestLock(); });
setPaused(true);
// QA watch (task QA-watch): range.html?watch starts unpaused without
// pointer lock, for the reviewer's automated browser, which cannot take
// it. The panel stays hidden, the HUD shows, and the sim steps as when
// playing. Absent ?watch this page behaves exactly as before.
const watch = new URLSearchParams(location.search).has("watch");
if (watch) setPaused(false);

// The Sound section of the panel (AUD-01): the master volume, a mute for
// this page only, and one row per sound ID with a Play button and a
// show of whether it has a recording and how many takes, or a skin.
const soundPanel = document.querySelector<HTMLDivElement>("#soundPanel")!;
function buildSoundPanel() {
  const e = engine!;
  const table = (soundsJson as { sounds: Record<string, { files: string[] }> }).sounds;
  soundPanel.innerHTML = "";
  const vol = document.createElement("label");
  vol.className = "ctl";
  vol.textContent = "Volume";
  const slider = document.createElement("input");
  slider.type = "range"; slider.min = "0"; slider.max = "1"; slider.step = "0.05";
  slider.value = String(Math.round(e.volume * 100) / 100);
  slider.addEventListener("input", () => { engine && (engine.volume = Number(slider.value)); });
  vol.appendChild(slider);
  soundPanel.appendChild(vol);
  const mute = document.createElement("label");
  mute.className = "ctl";
  const muteLbl = document.createTextNode("Mute");
  const mb = document.createElement("button");
  function syncMute() { mb.textContent = engine?.muted ? "on" : "off"; mb.classList.toggle("on", !!engine?.muted); }
  mb.addEventListener("click", () => { engine && (engine.muted = !engine.muted); syncMute(); });
  mute.appendChild(muteLbl); mute.appendChild(mb);
  soundPanel.appendChild(mute);
  const list = document.createElement("div");
  list.className = "soundList";
  for (const id of Object.keys(table)) {
    const takes = engine!.takeCount(id);
    const row = document.createElement("div");
    row.className = "soundRow";
    const sid = document.createElement("span");
    sid.className = "sid"; sid.textContent = id;
    const state = document.createElement("span");
    state.className = "sstate";
    state.textContent = takes ? `recording (${takes})` : "placeholder";
    const pb = document.createElement("button");
    pb.textContent = "Play";
    // The panel shows while paused, when the engine is suspended.
    pb.addEventListener("click", () => { e.resume(); e.play(id); });
    row.appendChild(sid); row.appendChild(state); row.appendChild(pb);
    list.appendChild(row);
  }
  soundPanel.appendChild(list);
}

// Benchmark: clear the log, run BENCH.seconds unpaused with auto-strafe on
// (it locks the mouse, as does the Play button), keep the other switches,
// then unlock so the panel shows and write the report.
document.querySelector<HTMLButtonElement>("#benchmark")!.addEventListener("click", () => {
  const wasStrafe = switches.strafe;
  if (!switches.strafe) setSwitch("strafe", true);
  log.reset();
  input.requestLock();
  setTimeout(() => {
    if (!wasStrafe) setSwitch("strafe", false);
    showReport();
    if (input.locked) document.exitPointerLock();
  }, BENCH.seconds * 1000 + 100);
});

// Backquote shows or hides the frame graph; a plain keydown listener like
// the game's KeyT, so it also works while paused.
window.addEventListener("keydown", (e) => {
  if (e.code === "Backquote" && !e.repeat) graph.toggle();
  // PT-01: T respawns the lineup (R is reload).
  if (e.code === "KeyT" && !e.repeat) respawnLineupHere();
});

// Push every frame into the log. performance.memory is Chrome-only (Firefox
// has none), so the heap is NaN there and the graph skips its heap lines.
const MEM = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
function pushStats(s: FrameStats) {
  log.push(s, MEM ? MEM.usedJSHeapSize / 1048576 : NaN, paused);
  graph.draw(s.dt);
}

// Scratch vectors, all reused so the steps and render allocate nothing.
const _muzzleCam = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _eye = new THREE.Vector3();
let lastMenuBlaster = loadout.activeIndex;
const eye = new THREE.Vector3();
// BUG-02: the parry watch's scratch (the range's parryNext mirrors the
// game page's, but it cannot run the loop's step: it holds a countdown
// the loop spends, and the hold lands at the lead's time of wait).
// BUG-04: parryBall is the walk's own ball: on the face of its thrower
// the disc gets raised, and once it has been parried, blocked or hit the
// loop lowers the disc again (the caller does not have to).
const _rangeCentre = new THREE.Vector3();
let parryWaitSec = 0;
let parryBall: import("../foamers/projectiles").LiveBall | null = null;

/** Seconds until the nearest incoming (not bounced) ball is within a hit
 *  of the player's capsule (the shared flight math, ball-time.ts), and
 *  that ball. 1e9 when there is none. */
function parryNextWait(dt: number): { t: number; ball: import("../foamers/projectiles").LiveBall | null } {
  playerCapsuleCentre(player.eye(1, eye), _rangeCentre);
  let best = 1e9;
  let ball: import("../foamers/projectiles").LiveBall | null = null;
  for (const b of projectiles.list) {
    if (b.bounced) continue;
    const s = timeToImpact(b.pos, b.vel, dt, _rangeCentre);
    if (s < best) { best = s; ball = b; }
  }
  return { t: best, ball };
}
const WEAPON_KEYS = ["weapon1", "weapon2", "weapon3", "weapon4", "weapon5", "weapon6", "weapon7", "weapon8"] as const;

const PAUSED_FRAME_MS = renderJson.pausedFrame * 1000;
let pausedClock = PAUSED_FRAME_MS;

/** The status line's text once the range runs (PT-10). */
const READY_TEXT = "Click to play. Esc shows the panel.";
/** True once the first frame has been drawn (PT-10). */
let bootDone = false;
/** True once every Foamer in the line has been meshed (PT-10). */
let foamersDone = false;
/** The Foamers' mesh count the boot report last wrote, so a frame that did
 *  not change it writes nothing. */
let meshedDone = -1;
let meshedTotal = -1;
/** PT-10: the lineup's meshes arrive a part at a time, so the boot report
 *  shows them as a count. Read once per frame until the line is done. */
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

loopCtl = startLoop({
  frame(dt) {
    input.poll();
    // PT-10: the Foamers mesh a part at a time, and the loop runs while
    // they land, so count them until the whole line is done.
    if (!foamersDone) reportFoamerMeshes();
    if (paused) {
      // Review fix: the line meshes behind the menu, so it is ready when
      // the player clicks Play (it waited for the first unpaused step).
      // The pose is solved too, or the line is drawn in a heap at the
      // origin until the first step (the PT-01 lesson).
      if (!foamersDone) {
        for (const f of foamers.list) {
          f.applyPose();
          f.poseParts(0, false, false);
          for (const part of f.parts.values()) part.mesh.update();
        }
      }
      return;
    }
    if (switches.strafe) strafeStep(dt);
    const look = input.takeLook(dt);
    player.yaw -= look.yaw;
    player.pitch = THREE.MathUtils.clamp(player.pitch + look.pitch, -1.5, 1.5);
  },
  update(dt) {
    if (input.wasPressed("pause")) setPaused(!paused);
    if (!paused) {
      // BUG-02: parryNext's hold lands on the lead's time of wait (the
      // game page's helper runs its own steps; the range's cannot, so the
      // loop spends the watch wanted's countdown here).
      // BUG-04: once the timed ball has been parried, blocked or hit the
      // hold is let go again (it leaves the list or is flying back).
      if (parryWaitSec > 0) {
        parryWaitSec -= dt;
        if (parryWaitSec <= 0) shield.forcedHold = true;
      }
      if (parryBall && (parryBall.bounced || !projectiles.list.includes(parryBall))) {
        parryBall = null;
        shield.forcedHold = false;
      }
      player.update(dt, input);
      // GAME-04 stage 2: the tiny parry hit-stop slows the movables, like on the
      // game page (the shield counts the true dt and hands back the rate).
      const wdt = shield.slowed(dt);
      if (switches.foamers) {
        foamers.update(wdt, player.eye(1, _eye));
        // PT-01: the time-to-kill clock, and the check for any watched Foamer
        // that has gone down or popped this step.
        ttk.update(wdt, foamers, player.eye(1, _eye));
        // GAME-10a: the foam balls fly on their own rays, no bodies.
        projectiles.update(wdt);
        updateNavPaths();
      }
      // Switch: wheel down is next, up is prev; keys 1 to 3 select directly.
      for (let i = 0; i < WEAPON_KEYS.length; i++)
        if (input.wasPressed(WEAPON_KEYS[i])) loadout.select(i);
      if (input.wasPressed("weaponNext")) loadout.next();
      if (input.wasPressed("weaponPrev")) loadout.prev();
      // PT-01: keys and the wheel change the blaster without the menu's
      // buttons, so the menu follows the loadout each step (cheap: it writes
      // the name only when it changed and rebuilds the mod row only on a
      // blaster change).
      if (lastMenuBlaster !== loadout.activeIndex) {
        lastMenuBlaster = loadout.activeIndex;
        menuPanel.render();
      }
      // Muzzle from the active viewmodel, then aim through the world,
      // then the loadout's fixed step, then the darts.
      loadout.activeViewmodel.muzzleCameraPoint(0, _muzzleCam);
      updateAim(camera, world, player.collider, _muzzleCam, _muzzle, _aimDir);
      // GAME-04: the shield first, so it can take this step's fire press
      // as the throw before the blaster sees it (as on the game pages).
      shield.toggleMode = store.value.shieldMode;
      const se = shield.update(dt, {
        fireHeld: input.isDown("fire"),
        firePressed: input.wasPressed("fire"),
        shieldHeld: input.isDown("shield"),
        shieldPressed: input.wasPressed("shield"),
        reloadPressed: input.wasPressed("reload"),
      });
      if (engine) {
        if (se.raised) engine.play("SH-raise");
        if (se.thrown) engine.play("SH-throw", { position: shield.discPosition });
        for (const p of se.hits) engine.play("SH-ricochet", { position: p });
        if (se.caught) engine.play("SH-catch");
      }
      shield.onCarveAt = (p) => { if (engine) engine.play("DT-carve", { position: p }); };
      const canFire = !shield.blocksFire && !shield.usedFirePress;
      loadout.update(
        dt,
        {
          fireHeld: canFire && input.isDown("fire"),
          firePressed: canFire && input.wasPressed("fire"),
          reloadPressed: input.wasPressed("reload"),
        },
        _aimDir,
      );
      // PT-01: on the range the reserve never runs out, so a time to kill
      // measures the blaster and its reloads, not the ammo. The magazine is
      // left alone: it still empties and a reload still takes its time.
      fillReserves(loadout);
      if (sounds) sounds.update(dt, {
        fireHeld: canFire && input.isDown("fire"),
        firePressed: canFire && input.wasPressed("fire"),
        reloadPressed: input.wasPressed("reload"),
        sprintHeld: input.isDown("sprint"),
      });
      // ENV-05: the barrels' chains, fuses and leaks, before the step so
      // this step's spray is in the world for it.
      barrels.update(dt);
      debris.update(dt);
      darts.update(dt);
      if (player.feet < -20) player.teleport(SPAWN_POSE);
      world.step();
    }
    input.endStep();
  },
  render(dt, alpha) {
    // While paused only redraw a few frames a second (arriving meshes,
    // window resizes), like the game page.
    if (paused) {
      pausedClock += dt * 1000;
      if (pausedClock < PAUSED_FRAME_MS) return;
      pausedClock = 0;
    } else pausedClock = PAUSED_FRAME_MS;
    if (!paused) blastFx.update(dt);
    debris.syncRender(alpha);
    if (switches.foamers) foamers.syncRender(alpha);
    labels.update();
    darts.syncRender(alpha);
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    // The active blaster's recoil climb tilts the view up (the player's own
    // pitch is unchanged, so releasing the trigger brings the view back).
    const climb = loadout.active.climb + shield.kick + shield.parryKick;
    camera.rotation.set(player.pitch + climb, player.yaw, 0);
    // The active blaster's viewmodel animates once per render frame.
    loadout.render(dt, input.isDown("fire"));
    hud.setAmmo(loadout.active, loadout.active.state);
    hud.setHealth(health.hp, health.max);
    if (engine) engine.updateListener();
    renderer.render(scene, camera);
    // PT-10: the first drawn frame is when the range counts as running: the
    // boot report gets its last step, and only now may a click take the
    // mouse. Before that the cursor stays and the status line says it is
    // loading, as the card asks.
    if (!bootDone) {
      bootDone = true;
      firstFrame(boot, READY_TEXT, mesherPool, () => `${input.diagLine()}\n${loopDiagLine()}`);
      input.setReady();
    }
  },
  stats: pushStats,
});

// Dev-only hook for automated checks in the browser.
if (import.meta.env.DEV) Object.assign(window, { __range: { log, foamers, darts, loadout, player, camera, explosion, blastFx, barrels, loop: loopCtl } });

// In watch mode only: window.dartRange, plain functions the reviewer calls
// from the console. They reuse the panel's own handlers (spawnAhead,
// breakLegForTest, setPaused, the player's pose), so the automation sees
// exactly what the buttons do.
if (watch) {
  const _moveTo = new THREE.Vector3();
  Object.assign(window, {
    dartRange: {
      spawn: (distanceMetres: number) => spawnAhead(distanceMetres),
      breakLeg: () => foamers.breakLegForTest() ?? null,
      look: (yawRadians: number, pitchRadians: number) => {
        player.yaw = yawRadians;
        player.pitch = THREE.MathUtils.clamp(pitchRadians, -1.5, 1.5);
      },
      moveTo: (x: number, z: number) => player.teleport(_moveTo.set(x, 0, z)),
      pause: (on: boolean) => setPaused(on),
      /** GAME-04: hold the disc up (or drop it), and throw it. */
      block: (on: boolean) => {
        shield.forcedHold = on;
      },
      throwShield: () => {
        shield.forcedHold = true;
        // Rise first (block.raiseTime), then the press is the throw.
        for (let i = 0; i < 30 && (shield.state !== "raised" || shield.raise < 1); i++)
          shield.update(1 / 60, {
            fireHeld: false, firePressed: false, shieldHeld: true, shieldPressed: false,
            reloadPressed: false,
          });
        const e = shield.update(1 / 60, {
          fireHeld: true, firePressed: true, shieldHeld: true, shieldPressed: false,
          reloadPressed: false,
        });
        return e.thrown;
      },
      shieldState: () => shield.state,
      /** GAME-04 stage 2 (BUG-02), fixed by BUG-04: raise the disc with
       *  its hands-on lead, timed by the ball's real flight (ball-time.ts,
       *  the game page's helper's math). Before the wait it faces the timed
       *  ball's thrower (several Foamers can throw at once, and the disc's
       *  arc is judged on the view), and once the timed ball has been parried, blocked or hit the loop
       *  lowers the disc again (the caller does not have to). true when a
       *  ball was found to aim at. */
      parryNext: () => {
        if (paused) return false;
        const { t, ball } = parryNextWait(STEP);
        if (ball === null) return false;
        parryBall = ball;
        // Face the timed ball's thrower: the disc's arc is judged on the
        // view (as the watch's look turns it).
        const at = ball.thrower.centre;
        const e = player.eye(1, _eye);
        const dx = at.x - e.x, dy = at.y + 1.2 - e.y, dz = at.z - e.z;
        player.yaw = Math.atan2(-dx, -dz);
        player.pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.5, 1.5);
        parryWaitSec = Math.max(0, t - shield.parryLead);
        return true;
      },
      state: () => ({
        parries: shield.parries,
        foamers: foamers.list.map((f) => ({
          type: f.spec.rig,
          // GAME-10b: the Darter's own states (telegraph, charge, wallStun)
          // and its brain's, for the watch.
          state: f.state,
          brain: f.agent?.state ?? null,
          health: f.health,
          position: [f.centre.x, f.centre.y, f.centre.z].map((n) => Number(n.toFixed(3))) as [number, number, number],
          parts: [...f.parts.keys()],
        })),
        balls: projectiles.list.length,
      }),
    },
  });
}
