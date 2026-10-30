# GAME-02: Placeholder pump blaster, end to end

```
ID:          GAME-02
Title:       One placeholder pump-action blaster: ammo, priming, reload,
             viewmodel, HUD, and dart hits that carve voxels
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-01, ENG-05 (both done)
Branch:      game-02, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (rules for this repo; every rule applies to you)
2. `PLAN.md` sections 3.3 (darts), 5 (blaster card template) and 7.3
   (voxel destruction)
3. `HANDOFF.md` (current state, especially the GAME-01 and ENG-05 entries)
4. `src/main.ts`, `src/weapons/darts.ts`, `src/voxel/carve.ts`,
   `src/voxel/debris.ts`, `src/voxel/volume-mesh.ts` (the code you connect to)

## How to work (important)

Your last task stopped once because one reply spent the whole output limit
on thinking. Keep each reply's thinking short and act through tools. Build
in stages: write one file, run `npx tsc --noEmit` and the tests, then the
next file. Never write more than about 200 lines in one tool call.

## Goal

Replace the GAME-01 auto-fire test with one real (placeholder) blaster:
press fire, a spread of darts leaves the blaster's muzzle, the blaster has to
be primed before the next shot, and it runs out and reloads. Darts that hit
the voxel wall carve small craters and throw foam debris. A simple
first-person blaster model, a crosshair and an ammo counter show on screen.

This is a **placeholder**. Paul designs the real blasters (PLAN.md section
5). Do not name it, do not base it on a real blaster, and keep every number
in `data/blasters.json` so his card can replace them.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-game-02 -b game-02
cd ../dart-game-02
npm install
```

Run the dev server with `npm run dev -- --port 5174` so it does not clash
with port 5173.

## Files

You own these (create them):

| File | Purpose |
|---|---|
| `data/blasters.json` | The placeholder blaster's numbers (below) |
| `src/weapons/blaster.ts` | `Blaster`: ammo, priming, reload, spread, firing through `DartSystem` |
| `src/weapons/blaster-model.ts` | First-person blaster model built in code, with recoil and pump animation |
| `src/weapons/impacts.ts` | `DartImpacts`: turns dart hits on voxel volumes into carving and debris |
| `src/ui/hud.ts` | Crosshair and ammo counter (DOM, not WebGL) |
| `tests/weapons/blaster.test.ts` | Tests 1 to 4 |
| `tests/weapons/impacts.test.ts` | Tests 5 to 8 |

You may make these changes and nothing else:

| File | Allowed change |
|---|---|
| `src/weapons/darts.ts` | (a) In `stick()`, when the hit body is **fixed** (`rb.isFixed()`), leave `s.body` and `s.coll` null, so the dart stays put when its chunk is remeshed. (b) Add `releaseInSphere(centre: THREE.Vector3, radius: number): number`: every stuck dart whose position is within `radius` metres of `centre` becomes a falling non-sticking dart (the same path as the collider-removed case in `stepStuck`); returns how many. |
| `data/darts.json` | Add `"carveRadius"` (metres) to each dart type: `standard` 0.12, `suction` 0.08. Mention it in `_note`. |
| `src/main.ts` | Remove the auto-fire block, `fireCd` and the aim scratch vectors that only it used. Create the `Blaster`, `BlasterModel`, `DartImpacts` and `Hud` and wire them as described below. `KeyT` keeps toggling the dart type, now by setting `blaster.dartType`. Add `blaster` and `impacts` to the `window.__dart` dev hook. Leave everything else alone, including the melee `debugBlast`. |
| `index.html` | Add `<div id="hud" hidden><div id="crosshair"></div><div id="ammo"></div></div>` after `#overlay`. |
| `src/style.css` | Styles for `#hud`, `#crosshair`, `#ammo`, and `#hud[hidden]{display:none}`. |
| `HANDOFF.md` | Your log entry at the top of the log, and the status section |

Do **not** edit anything in `src/core/`, `src/render/`, `src/voxel/`,
`src/physics/`, `src/player/`, `data/input.json`, `data/player.json`,
`data/destruction.json`, `PLAN.md` or `CLAUDE.md`.

## Data: `data/blasters.json`

```json
{
  "_note": "Placeholder until Paul's first blaster card (PLAN.md section 5). Units: metres, seconds, degrees.",
  "placeholder": {
    "dartType": "standard",
    "dartsPerShot": 3,
    "spreadDeg": 2.5,
    "magSize": 8,
    "reserveMax": 40,
    "reserveStart": 40,
    "primeTime": 0.45,
    "reloadTime": 1.4,
    "autoReload": true,
    "muzzle": [0.16, -0.13, -0.42],
    "recoilKick": 0.05,
    "recoilReturn": 12,
    "bodyColor": "#ff7a1a",
    "accentColor": "#2ec4ff",
    "trimColor": "#fff6e8"
  }
}
```

`muzzle` is the muzzle position in camera space (x right, y up, z forward is
negative). `dartsPerShot` counts as **one** round from the magazine: a shot
of 3 darts uses 1 round. `recoilKick` is metres the model moves back per
shot; `recoilReturn` is how fast it springs back (per second, exponential).

## Public API (implement exactly this)

```ts
// src/weapons/blaster.ts
export interface BlasterSpec { /* the fields of data/blasters.json "placeholder" */ }
export type BlasterState = "ready" | "priming" | "reloading";
export interface BlasterControls { firePressed: boolean; reloadPressed: boolean }

export class Blaster {
  constructor(spec: BlasterSpec, darts: DartSystem, rng?: () => number); // rng defaults to Math.random
  dartType: DartTypeName;          // starts as spec.dartType
  mag: number;                      // starts full
  reserve: number;                  // starts at spec.reserveStart
  readonly state: BlasterState;
  /** 0 to 1 progress through the current priming or reload; 1 when ready. */
  readonly progress: number;
  /** Called once per shot (not per dart), for the model's recoil. */
  onShot: () => void;
  /**
   * Fixed step. origin is the muzzle in world space; aimDir is the unit
   * direction from the muzzle to the aim point.
   */
  update(dt: number, controls: BlasterControls, origin: THREE.Vector3, aimDir: THREE.Vector3): void;
}

// src/weapons/impacts.ts
export interface VoxelTarget {
  volume: VoxelVolume;
  owns(collider: RAPIER.Collider): boolean;
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;   // in place
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;   // in place
}
export class DartImpacts {
  constructor(darts: DartSystem, debris: DebrisSystem, targets: VoxelTarget[]);
  /** Counters for the dev hook and tests. */
  readonly stats: { hits: number; carves: number; voxelsRemoved: number };
}

// src/weapons/blaster-model.ts
export class BlasterModel {
  constructor(spec: BlasterSpec, camera: THREE.Camera);
  /** Render frame: recoil spring and pump animation from the blaster's state. */
  update(dt: number, blaster: Blaster): void;
  kick(): void; // start a recoil
}

// src/ui/hud.ts
export class Hud {
  constructor(root: HTMLElement);
  show(visible: boolean): void;
  setAmmo(mag: number, reserve: number, state: BlasterState): void; // only touches the DOM when a value changed
}
```

`VolumeMesh` already matches `VoxelTarget`; pass `voxelMesh` directly.

## Behaviour

1. **Firing.** On `firePressed` while `ready` and `mag > 0`: fire
   `dartsPerShot` darts from `origin`. Each dart's direction is `aimDir`
   rotated by a random angle within a cone of `spreadDeg` (uniform over the
   cone's disc is fine). `mag -= 1`, call `onShot()`, state becomes
   `priming` for `primeTime`, then `ready`. Presses during priming or reload
   are ignored (no buffering).
2. **Empty.** On `firePressed` with `mag === 0`: no darts. If `autoReload`
   and `reserve > 0`, start reloading.
3. **Reload.** On `reloadPressed` while `ready`, `mag < magSize` and
   `reserve > 0`: state `reloading` for `reloadTime`, then move
   `min(magSize - mag, reserve)` rounds from reserve to mag. Also start a
   reload automatically when a shot empties the mag (after its priming) if
   `autoReload` and `reserve > 0`.
4. **Impacts.** `DartImpacts` subscribes to `darts.onHit` (keep any
   existing handler by calling it too). For each hit, find the target whose
   `owns(hit.collider)` is true; if none, only count the hit. Otherwise
   carve with centre `hit.point + hit.direction * (voxelSize * 0.5)`
   converted to voxel space, and radius
   `carveRadius * clamp(hit.speed / typeSpeed, 0.3, 1)` metres converted
   to voxels (`/ volume.voxelSize`). Spawn debris for the removed voxels
   (same call as `debugBlast` in main.ts). If anything was removed, call
   `darts.releaseInSphere(hit.point, radiusMetres + volume.voxelSize)` so
   darts stuck to carved-away foam fall.
5. **Viewmodel.** `BlasterModel` builds a toy-looking blaster from boxes and
   cylinders in code (body, barrel, a pump grip under the barrel, a
   magazine, a sight): `bodyColor` main, `accentColor` pump grip and
   magazine, `trimColor` details. Original shapes only, nothing copied from
   a real blaster. About 0.45 m long. It is a child of the camera, so main.ts
   must `scene.add(camera)` (the camera is not in the scene yet). Recoil:
   `kick()` moves the model back by `recoilKick` and tilts it up about 4
   degrees, and it springs back at `recoilReturn`. The pump grip slides
   back and forward once over each priming (use `blaster.progress`); during
   reload the model dips down and returns. No per-frame allocation.
6. **HUD.** A small crosshair dot at screen centre and an ammo counter
   bottom right, `mag / reserve`, with `RELOAD` shown while reloading. Shown
   only while playing (follow the pause overlay). Use the colours already
   in `style.css`. No web fonts.
7. **main.ts wiring.** Each fixed step, while not paused: compute the
   muzzle by transforming `spec.muzzle` from camera space to world space,
   aim at the point 50 m along the camera's view direction, then call
   `blaster.update(dt, { firePressed: input.wasPressed("fire"),
   reloadPressed: input.wasPressed("reload") }, muzzle, aimDir)` before
   `darts.update(dt)`. Each render frame: `model.update(dt, blaster)` and
   `hud.setAmmo(...)`. `blaster.onShot = () => model.kick()`.

## Tests

Use a real Rapier world (`await RAPIER.init()` in `beforeAll`) and a plain
`new THREE.Scene()`. For the blaster, pass a seeded rng.

`tests/weapons/blaster.test.ts`:

1. With a full mag, one `firePressed` step fires exactly `dartsPerShot`
   darts (`darts.stats().flying`), `mag` drops by 1 and state is
   `priming`; another press during priming fires nothing; after
   `primeTime` the next press fires again.
2. Every dart direction of 50 shots is within `spreadDeg` of `aimDir`
   (wrap `darts.fire` in the test to record the directions).
3. Emptying the mag with `autoReload` starts a reload after the last
   priming; after `reloadTime` the mag is full and reserve dropped by
   `magSize`. With reserve 3, a reload fills only 3.
4. `reloadPressed` does nothing when the mag is full, when reserve is 0,
   or while priming.

`tests/weapons/impacts.test.ts` (build a `VoxelTarget` from a real
`VoxelVolume` filled with `fillBox`, with a fixed cuboid collider covering
it, and `owns = c => c === thatCollider`; use a real `DebrisSystem`):

5. A standard dart fired at foam removes voxels near the hit point, every
   removed voxel's centre within `carveRadius + 2 * voxelSize` of it, and `stats.carves` is 1.
6. A dart fired at a concrete block removes nothing (it only scuffs).
7. A suction dart stuck to the block is released (no longer `stuck`) when
   a standard dart carves within its radius, and a stuck dart 1 m away is
   not.
8. A suction dart stuck to a fixed collider stays stuck after that
   collider is removed and a new one is created in its place (a remesh).

## Done when

- [ ] `npm test` passes: the existing 32 tests and your 8 new ones.
- [ ] `npm run build` passes.
- [ ] In the browser (dev server on 5174): the blaster model shows at
      bottom right, one click fires 3 darts in a tight spread, the pump
      grip slides while priming, darts carve small craters in the foam
      wall with foam debris, concrete only scuffs, the counter counts
      down and reloads, R reloads, T switches to suction darts.
- [ ] Firing as fast as priming allows for 20 s at the wall stays at or
      above 60 fps and debris stays within its cap.
- [ ] No em dash or en dash characters anywhere you wrote, including the
      commit message. macOS grep has no `-P`; check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`.
- [ ] Nothing fetched from another host.
- [ ] A dated `HANDOFF.md` log entry (date with `date +%F`): what was
      built, decisions and why, what is unverified. Update the status
      section: left mouse now fires the placeholder blaster.
- [ ] Committed on branch `game-02` with a message starting `GAME-02:` and
      ending with `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`.
      **Do not merge into main and do not push.**

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
