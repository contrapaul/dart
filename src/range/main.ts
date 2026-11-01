// Test range (ENG-11): a plain level with the frame-time graph, system
// switches and a test panel. Same structure as the game page without the
// voxel wall, the foam blocks, the thrown blocks and the melee debug blast.
// The frame and update steps must not allocate: every scratch vector lives
// at module scope, the stats hook reuses the loop's one records, and
// auto-strafe writes one reused object.
import * as THREE from "three";
import { createRenderer } from "../render/scene";
import { createPhysics } from "../physics/world";
import { startLoop, type FrameStats } from "../core/loop";
import { Input } from "../core/input";
import { PlayerController } from "../player/controller";
import { DartSystem } from "../weapons/darts";
import { Blaster, type BlasterSpec } from "../weapons/blaster";
import { BlasterModel } from "../weapons/blaster-model";
import { updateAim } from "../weapons/aim";
import { DartImpacts, type VoxelTarget } from "../weapons/impacts";
import { FoamerSystem } from "../foamers/foamers";
import { Hud } from "../ui/hud";
import { FrameLog, FrameGraph } from "../ui/frame-graph";
import { DebrisSystem } from "../voxel/debris";
import { MesherPool } from "../voxel/mesher-pool";
import rangeJson from "../../data/range.json";
import blasterTuning from "../../data/blasters.json";
import dartsJson from "../../data/darts.json";
import renderJson from "../../data/render.json";

const R = (rangeJson as unknown as {
  range: {
    size: number;
    playerSpawn: [number, number, number];
    cover: [number, number, number, number, number, number][];
    spawn: { count: number; points: [number, number, number][] };
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

const { renderer, scene, camera } = createRenderer(canvas);
camera.rotation.order = "YXZ";
scene.add(camera); // the blaster viewmodel is a child of the camera
const input = new Input(canvas);
const { rapier, world } = await createPhysics();
const mesherPool = new MesherPool();
const debris = new DebrisSystem(rapier, world);
scene.add(debris.mesh);

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

const player = new PlayerController(rapier, world, SPAWN_POSE);
const darts = new DartSystem(scene, world, rapier, player.collider);
const blasterSpec = blasterTuning.placeholder as unknown as BlasterSpec;
const blaster = new Blaster(blasterSpec, darts);
const blasterModel = new BlasterModel(blasterSpec, camera);
// Only the Foamers' parts are voxel targets on this page, and the system
// pushes each part in and out as Foamers spawn and go.
const voxelTargets: VoxelTarget[] = [];
// Dart hits on the Foamer parts carve craters and throw foam debris.
new DartImpacts(darts, debris, voxelTargets);
const foamers = new FoamerSystem(rapier, world, mesherPool, debris, darts, voxelTargets);
foamers.spawnCount = R.spawn.count;
foamers.spawnPoints = R.spawn.points.map((p) => [p[0], p[1], p[2]]);
scene.add(foamers.group);
foamers.onBonk = () => {};

// Switches, each listed in the report.
const switches = {
  foamers: true, shadows: true, pixelRatio: true, snap: true,
  strafe: false, infiniteAmmo: false,
};
// Infinite ammo refills the magazine after every shot; the model's recoil
// stays on the same hook.
blaster.onShot = () => {
  blasterModel.kick();
  if (switches.infiniteAmmo) blaster.mag = blasterSpec.magSize;
};
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
      renderer.setPixelRatio(on ? Math.min(window.devicePixelRatio, 2) : 1);
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
  }
}
document.querySelectorAll<HTMLButtonElement>("button[data-switch]").forEach((b) =>
  b.addEventListener("click", () =>
    setSwitch(b.dataset.switch! as keyof typeof switches, b.dataset.on === "1")));
for (const k of Object.keys(switches) as (keyof typeof switches)[])
  document.querySelectorAll<HTMLButtonElement>(`button[data-switch="${k}"]`).forEach((b) =>
    b.classList.toggle("on", b.dataset.on === "1" ? !!switches[k] : !switches[k]));

// One dart type button per entry in data/darts.json.
const dartRow = document.querySelector<HTMLDivElement>("#dartTypes")!;
for (const t of Object.keys((dartsJson as { types: object }).types)) {
  const b = document.createElement("button");
  b.textContent = t;
  b.addEventListener("click", () => {
    blaster.dartType = t as Blaster["dartType"];
    dartRow.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  if (t === blaster.dartType) b.classList.add("on");
  dartRow.appendChild(b);
}
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
// Spawn a Foamer at set metres ahead of the player, on the floor.
const _fwd = new THREE.Vector3();
const _fwdxz = new THREE.Vector3();
const _feet = new THREE.Vector3();
function spawnAhead(m: number) {
  camera.getWorldDirection(_fwd);
  player.eye(1, _fwdxz);
  _feet.set(_fwdxz.x + _fwd.x * m, 0, _fwdxz.z + _fwd.z * m);
  foamers.spawn(_feet, camera.position);
}
for (const [id, m] of [["#spawn5", 5], ["#spawn10", 10], ["#spawn20", 20], ["#spawn30", 30]] as const)
  document.querySelector<HTMLButtonElement>(id)!.addEventListener("click", () => spawnAhead(m));
document.querySelector<HTMLButtonElement>("#clearFoamers")!.addEventListener("click", () =>
  foamers.clear());

// Report and copy.
const reportEl = document.querySelector<HTMLPreElement>("#report")!;
function reportText(): string {
  const extra: Record<string, string | number> = {
    foamers: switches.foamers ? "on" : "off",
    shadows: switches.shadows ? "on" : "off",
    pixelRatio: switches.pixelRatio ? "device" : "1",
    snap: switches.snap ? "on" : "off",
    autoStrafe: switches.strafe ? "on" : "off",
    infiniteAmmo: switches.infiniteAmmo ? "on" : "off",
    keepAlive: foamers.spawnCount,
    dartType: blaster.dartType,
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
  if (p && input.locked) document.exitPointerLock();
}
input.onLockChange = (locked) => setPaused(!locked);
document.querySelector<HTMLButtonElement>("#play")!.addEventListener("click", () => input.requestLock());
setPaused(true);

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
});

// Push every frame into the log. performance.memory is Chrome-only (Firefox
// has none), so the heap is NaN there and the graph skips its heap lines.
const MEM = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
function pushStats(s: FrameStats) {
  log.push(s, MEM ? MEM.usedJSHeapSize / 1048576 : NaN, paused);
  graph.draw(s.dt);
}

// Scratch vectors, all reused so the steps and render allocate nothing.
const _muzzle = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _eye = new THREE.Vector3();
const eye = new THREE.Vector3();

const PAUSED_FRAME_MS = renderJson.pausedFrame * 1000;
let pausedClock = PAUSED_FRAME_MS;

loopCtl = startLoop({
  frame(dt) {
    input.poll();
    if (paused) return;
    if (switches.strafe) strafeStep(dt);
    const look = input.takeLook(dt);
    player.yaw -= look.yaw;
    player.pitch = THREE.MathUtils.clamp(player.pitch + look.pitch, -1.5, 1.5);
  },
  update(dt) {
    if (input.wasPressed("pause")) setPaused(!paused);
    if (!paused) {
      player.update(dt, input);
      if (switches.foamers) foamers.update(dt, player.eye(1, _eye));
      updateAim(camera, world, player.collider, blasterSpec.muzzle, _muzzle, _aimDir);
      blaster.update(
        dt,
        { firePressed: input.wasPressed("fire"), reloadPressed: input.wasPressed("reload") },
        _muzzle,
        _aimDir,
      );
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
    debris.syncRender(alpha);
    if (switches.foamers) foamers.syncRender(alpha);
    darts.syncRender(alpha);
    camera.position.copy(player.eye(paused ? 1 : alpha, eye));
    camera.rotation.set(player.pitch, player.yaw, 0);
    blasterModel.update(dt, blaster);
    hud.setAmmo(blaster.mag, blaster.reserve, blaster.state);
    renderer.render(scene, camera);
  },
  stats: pushStats,
});

// Dev-only hook for automated checks in the browser.
if (import.meta.env.DEV) Object.assign(window, { __range: { log, foamers, darts, blaster, player, camera, loop: loopCtl } });
