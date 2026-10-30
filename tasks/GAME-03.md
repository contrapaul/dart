# GAME-03: Test Foamer that walks at you and pops

```
ID:          GAME-03
Title:       One voxel test Foamer: walks at the player, bonks, takes dart
             damage you can see, and pops into foam chunks
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-05, ENG-06, GAME-02 (all done)
Branch:      game-03, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (rules for this repo; every rule applies to you)
2. `PLAN.md` sections 2 (content rules), 4 (Foamers: 4.1 damage model,
   4.3 AI) and 7.3 point 6 (Foamer bodies)
3. `HANDOFF.md` (current state, especially GAME-01, GAME-02, ENG-05 and
   ENG-06)
4. `src/main.ts`, `src/voxel/volume-mesh.ts`, `src/voxel/pieces.ts` (the
   `Mesher` interface), `src/weapons/impacts.ts`, `src/weapons/darts.ts`,
   `src/voxel/debris.ts`, `src/player/controller.ts` (how it uses Rapier's
   character controller)

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
write one file, run `npx tsc --noEmit` and the tests, then the next file.
Never write more than about 200 lines in one tool call. Suggested order:
`data/foamers.json` and the materials, `foamer-model.ts` and test 1, the
`volume-mesh.ts` and `darts.ts` changes, `foamer.ts`, `foamers.ts`, the
other tests, then `main.ts`.

## Goal

The first enemy, for testing only. A Foamer made of voxels walks at the
player, winds up and bonks them when it gets close, and takes damage from
darts: each hit carves a visible chunk out of it and lowers its health.
At zero health it pops into a burst of foam chunks. A new one walks in a
few seconds later.

This is a **test Foamer**. Paul designs the real Foamers (PLAN.md 4.2).
Do not give it a name. Its look is a plain placeholder (a rounded blob
with two big friendly eyes), and every number lives in `data/foamers.json`.
It must not look scary (PLAN.md section 2).

Out of scope: player health, stagger and finishers (GAME-07), navigation
around obstacles (ENG-08: the Foamer walks straight at you and may get
stuck on a box, that is fine), smoothed meshing (ENG-09), parts breaking
off a Foamer.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-game-03 -b game-03
cd ../dart-game-03
npm install
```

Run the dev server with `npm run dev -- --port 5174` so it does not clash
with port 5173.

## Files

You own these (create them):

| File | Purpose |
|---|---|
| `data/foamers.json` | The test Foamer's numbers and the spawner (below) |
| `src/foamers/foamer-model.ts` | `buildTestFoamer`: fills a voxel volume with the placeholder look |
| `src/foamers/foamer.ts` | `Foamer`: one Foamer's body, voxels, mesh, movement and state |
| `src/foamers/foamers.ts` | `FoamerSystem`: spawning, dart damage, popping, the spawner |
| `tests/foamers/foamers.test.ts` | Tests 1 to 8 |

You may make these changes and nothing else:

| File | Allowed change |
|---|---|
| `data/materials.json` | Add `{ "id": 7, "name": "foam-white", "color": "#fff6e8", "hardness": 1 }` and `{ "id": 8, "name": "foam-ink", "color": "#2a2340", "hardness": 1 }` after `foam-purple`. Placeholder eye colours. |
| `src/voxel/volume-mesh.ts` | (a) An optional last constructor parameter `body?: RAPIER.RigidBody`: when given, use it instead of creating a fixed body. (b) Type the pool parameter as `Mesher` (import the type from `./pieces`) so tests can pass a fake. (c) Add `dispose()`: remove every chunk mesh (dispose geometries) and collider, and ignore any remesh result that arrives afterwards. It does not remove the body. |
| `src/weapons/darts.ts` | (a) In `stick()`, when the hit body is **kinematic** (`rb.isKinematic()`), keep `s.body = rb` but leave `s.coll` null, so the dart survives the body's chunks being remeshed. (b) In `stepStuck`, if `s.body` is no longer in the world (`this.world.getRigidBody(s.body.handle)` is falsy), release the dart exactly like the collider-removed case. Update the comments to match. |
| `src/main.ts` | Wiring, described under "Wiring". Nothing else. |
| `HANDOFF.md` | Your log entry at the top of the log, and the status section |

Do **not** edit anything in `src/core/`, `src/render/`, `src/physics/`,
`src/player/`, `src/ui/`, any other file in `src/weapons/` or `src/voxel/`,
any other `data/` file, `PLAN.md` or `CLAUDE.md`.

## Data: `data/foamers.json`

```json
{
  "_note": "Test Foamer (GAME-03), a placeholder until Paul's Foamer cards (PLAN.md 4.2). Distances in metres, times in seconds, sizes in voxels.",
  "test": {
    "voxelSize": 0.05,
    "size": [12, 26, 12],
    "health": 6,
    "damage": { "standard": 1, "suction": 0.5 },
    "minDamageSpeed": 8,
    "speed": 2.2,
    "turnRate": 6,
    "gravity": 22,
    "capsuleRadius": 0.2,
    "attackRange": 1.3,
    "windup": 0.6,
    "recover": 0.8,
    "popChunkScale": 2.5,
    "popBursts": 4
  },
  "spawner": {
    "count": 1,
    "max": 12,
    "respawnDelay": 3,
    "points": [[-8, 0, 8], [8, 0, 8], [0, 0, 6]]
  }
}
```

- `size`: the model's bounding box in voxels (x, y, z), 0.6 x 1.3 x 0.6 m
  at 0.05 m voxels. It must fit inside one 32-voxel chunk.
- `health`, `damage`: health points, and how much one dart of each type
  takes off. A full 3-dart standard shot is 3, so two shots pop it.
- `minDamageSpeed`: dart hits slower than this (m/s) do no damage, so a
  bounced dart rolling against it does not count.
- `speed`, `turnRate`, `gravity`: walking speed (m/s), turn speed (rad/s),
  fall acceleration (m/s^2).
- `capsuleRadius`: the inner movement capsule, see "Bodies".
- `attackRange`, `windup`, `recover`: bonk distance (horizontal, metres),
  the wind-up before a bonk, and the pause after it.
- `popChunkScale`, `popBursts`: pop debris chunk size multiplier and the
  number of `debris.spawn` calls in a pop, see "Popping".
- `spawner.count`: how many Foamers the spawner keeps alive. `max` is the
  hard cap on live Foamers, including ones spawned by hand.

## Public API (implement exactly this)

### `src/foamers/foamer-model.ts`

```ts
import type { VoxelVolume } from "../voxel/chunk";

/** Fill voxels 0..size-1 on each axis with the placeholder test Foamer.
 *  It faces +z. */
export function buildTestFoamer(volume: VoxelVolume, size: [number, number, number]): void;
```

### `src/foamers/foamer.ts`

```ts
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import { VoxelVolume } from "../voxel/chunk";
import { VolumeMesh } from "../voxel/volume-mesh";
import type { Mesher } from "../voxel/pieces";
import type { VoxelTarget } from "../weapons/impacts";
import foamerData from "../../data/foamers.json";

export type FoamerState = "approach" | "windup" | "recover";
export type FoamerSpec = typeof foamerData.test;

export class Foamer implements VoxelTarget {
  readonly volume: VoxelVolume;
  readonly body: RAPIER.RigidBody;
  /** The movement capsule (also on `body`). */
  readonly capsule: RAPIER.Collider;
  readonly mesh: VolumeMesh;
  /** Feet centre in world space. */
  readonly centre: THREE.Vector3;
  yaw: number;
  health: number;
  state: FoamerState;
  /** Seconds spent in the current state. */
  stateTime: number;

  constructor(rapier: Rapier, world: RAPIER.World, mesher: Mesher, spec: FoamerSpec, feet: THREE.Vector3);

  owns(collider: RAPIER.Collider): boolean;
  /** Full transform including yaw, in place. */
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** Remove the mesh, colliders and body. */
  dispose(world: RAPIER.World): void;
}
```

### `src/foamers/foamers.ts`

```ts
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { Mesher } from "../voxel/pieces";
import type { DebrisSystem } from "../voxel/debris";
import type { DartSystem } from "../weapons/darts";
import type { VoxelTarget } from "../weapons/impacts";
import { Foamer } from "./foamer";

export class FoamerSystem {
  /** Add to the scene once. Every Foamer's mesh group lives under it. */
  readonly group: THREE.Group;
  readonly list: Foamer[];
  /** Called once per bonk that connects. Player health does not exist yet. */
  onBonk: (foamer: Foamer) => void;
  readonly stats: { spawned: number; popped: number; hits: number; bonks: number };

  /** `targets` is the same array passed to DartImpacts: live Foamers are
   *  added to it and removed when they pop, so darts carve them. */
  constructor(
    rapier: Rapier, world: RAPIER.World, mesher: Mesher,
    debris: DebrisSystem, darts: DartSystem, targets: VoxelTarget[],
  );

  /** Spawn at a feet position. Returns null at the `max` cap. */
  spawn(feet: THREE.Vector3): Foamer | null;
  /** Fixed step, before world.step(). `player` is the player's position;
   *  only x and z are used for steering. */
  update(dt: number, player: THREE.Vector3): void;
  /** Render frame: copy transforms to the mesh groups. */
  syncRender(): void;
  get live(): number;
}
```

## Behaviour

### The placeholder look (`buildTestFoamer`)

A rounded blob filling the `size` box: an ellipsoid centred in the box with
radii of half the size on each axis, in `foam-lime`, with a flattened
bottom (fill the bottom two layers inside the ellipse's footprint at that
height, so it stands). Two big round eyes on the +z face, about two thirds
of the way up, symmetric about the centre in x: a disc of `foam-white`
about 4 voxels across, with a 2 x 2 `foam-ink` pupil, set one voxel into
the surface so they are flush. Mirror-symmetric in x. Nothing else: no
mouth, no teeth, no spikes.

### Bodies

- One `kinematicPositionBased` rigid body per Foamer.
- The body's origin is the voxel volume's (0, 0, 0) corner, so the
  `VolumeMesh` for the Foamer (created with this body, via the new
  optional parameter) builds its trimesh colliders in the right frame.
- The Foamer turns about its centre, not that corner. Keep `centre` (feet
  centre, world) and `yaw` as the real state, and each step set the body to
  `centre + rotateY(yaw) * (-size.x/2 * voxelSize, 0, -size.z/2 * voxelSize)`
  with rotation `yaw` about +y, through `setNextKinematicTranslation` and
  `setNextKinematicRotation`. Call `setTranslation` and `setRotation` once
  at spawn.
- The movement capsule: `capsuleRadius`, standing on the feet, full model
  height, attached to the same body at the box's centre in x and z (body
  frame). It is smaller than the blob, so darts usually hit the voxel
  trimesh first; a dart that hits the capsule through a hole still counts
  as a hit on this Foamer.
- `owns(collider)`: the collider's parent is this body.
- `worldToVoxel` and `voxelToWorld` use the body's current translation and
  rotation and divide or multiply by `voxelSize`.

### Movement and states (`FoamerSystem.update`)

For each Foamer, per step:

1. Turn toward the player's x, z at up to `turnRate` rad/s. Facing is +z,
   so the wanted yaw is `atan2(dx, dz)`.
2. State `approach`: walk forward at `speed` while the horizontal distance
   is over `attackRange`. Within range, switch to `windup`.
3. State `windup`: stand still for `windup` seconds. Then, if the player is
   still within `attackRange + 0.3` m horizontally and under 2 m apart
   vertically, call `onBonk` and add 1 to `stats.bonks`. Either way, switch
   to `recover`.
4. State `recover`: stand still for `recover` seconds, then `approach`.
5. Gravity: keep a vertical speed per Foamer, add `-gravity * dt`, reset to
   0 when grounded.
6. Move with **one shared** Rapier character controller (made once, offset
   0.02, autostep 0.3 m, snap to ground 0.3 m): call
   `computeColliderMovement(foamer.capsule, desired, undefined, undefined,
   (c) => c.parent()?.handle !== foamer.body.handle)` so a Foamer never
   collides with its own trimesh. Add `computedMovement()` to `centre`,
   then set the body pose as above. Other Foamers, the player and the
   world all block it.
7. Call `foamer.mesh.update()` so carved chunks are remeshed.

While winding up, squash the mesh group a little in `syncRender` (scale y
`1 - 0.12 * sin(pi * stateTime / windup)`, scale x and z the inverse
square root) so the bonk is telegraphed. Visual only.

### Dart damage

In the constructor, chain `darts.onHit` the same way `DartImpacts` does
(keep and call the previous handler first). On a hit whose collider a
live Foamer owns, and whose `speed` is at least `minDamageSpeed`, subtract
`damage[hit.type]` from its health and add 1 to `stats.hits`. If health is
now 0 or less, pop it. `DartImpacts` does the carving, because the Foamer
is in its `targets` array; do not carve here.

### Popping

1. Collect every remaining voxel of the Foamer (with materials).
2. Split them into `popBursts` equal slices. For each slice call
   `debris.spawn(slice, centreInVoxels, voxelSize * popChunkScale, (v) =>
   foamer.voxelToWorld(v))`, where `centreInVoxels` is the middle of the
   size box, so chunks fly outward from the middle. The debris cap still
   holds; that is fine.
3. Remove the Foamer from `list` and from `targets`, then `dispose` it:
   `mesh.dispose()`, remove its group, `world.removeRigidBody(body)`. Darts
   stuck to it then fall (the `darts.ts` change). Add 1 to `stats.popped`.

### Spawner

In `update`: while `live < spawner.count`, count a respawn timer up; when
it reaches `respawnDelay`, spawn at the spawn point farthest from the
player and reset the timer. Start the timer at `respawnDelay`, so the first
Foamer appears straight away. `spawn()` returns null and does nothing when
`live` is already `spawner.max`.

## Wiring (`src/main.ts`)

- Create `const voxelTargets: VoxelTarget[] = [voxelMesh];` and pass it to
  `new DartImpacts(darts, debris, voxelTargets)` instead of `[voxelMesh]`.
- Islands only for the wall: `impacts.onCarve = (target, removed) => {
  if (target === voxelMesh) pieces.afterCarve(voxelMesh, removed); };`
  with the comment updated.
- After `impacts`: `const foamers = new FoamerSystem(rapier, world,
  mesherPool, debris, darts, voxelTargets); scene.add(foamers.group);` and
  `foamers.onBonk = () => console.info("Bonk");` with a comment that player
  health comes later.
- In `update`, after `player.update(dt, input)`: `foamers.update(dt,
  player.eye(1, _playerPos));` with a new scratch vector `_playerPos`.
- In `render`, next to `pieces.syncRender()`: `foamers.syncRender();`
- Add `foamers` to the `window.__dart` dev hook.

## Tests

`tests/foamers/foamers.test.ts`. Real Rapier and a real `VoxelVolume`.
Node has no Worker: pass a fake `Mesher` whose `mesh(padded)` returns
`Promise.resolve(greedyMesh(padded, linearColorTable()))`, and after
anything that remeshes let the promises run with
`await new Promise((r) => setTimeout(r, 0))` and then step once more so the
colliders exist. A fixed floor cuboid with its top at y = 0 in every test
that moves a Foamer.

1. `buildTestFoamer` with the data `size`: every voxel is inside 0..size-1,
   the volume has exactly one chunk, the model is mirror-symmetric in x
   (voxel and material), there are `foam-white` and `foam-ink` voxels, and
   all of them have z above the middle (front half).
2. `spawn` at (0, 0, 0): `live` is 1, `targets` contains it, `stats.spawned`
   is 1. After meshing, its body has the capsule plus at least one trimesh
   collider. `spawn` beyond `spawner.max` returns null.
3. Walks at the player: spawn at (0, 0, 0), player at (0, 1.6, 10). After
   120 steps of `update` and `world.step()` at 1/60 s, `centre.z` is over
   3, `centre.y` is within 0.05 of 0, and its facing (+z rotated by yaw)
   points at the player within 0.1 rad.
4. Blocked: as test 3 with a fixed 4 x 2 x 0.5 m box centred at
   (0, 1, 3). After 240 steps, `centre.z` is under 3 (it did not pass
   through).
5. Bonk: player at (0, 1.6, 1) from the start. `onBonk` is called exactly
   once by `windup + 0.1` s, and not again before `windup + recover +
   windup` s have passed since the first.
6. Damage and carving: a Foamer at (0, 0, 0) with a real `DartSystem` (its
   ignore collider well away) and `DartImpacts` on the shared targets
   array, and `foamers.update` called each step with the player at
   (0, 1.6, 5). Fire one standard dart from (0, 0.8, 5) toward -z. After it
   hits, health is `health - damage.standard`, `stats.hits` is 1, and the
   Foamer's voxel count went down.
7. Pop: fire standard darts until health reaches 0 (one at a time, waiting
   for each hit). Then `live` is 0, `targets` no longer contains it, its
   body is gone from the world (`world.getRigidBody(handle)` is falsy),
   `debris.live` is over 0 and at most the debris cap, and `stats.popped`
   is 1. Letting pending mesh promises run afterwards does not throw.
8. Ride and fall: a suction dart stuck to a Foamer that then walks 60 steps
   moves with it (its position changes by about the Foamer's displacement,
   within 0.05 m). After the Foamer pops, that dart is no longer stuck.
   Read dart positions through the instanced mesh, as the darts tests do.

## Done when

- [ ] `npm test` passes: the existing 52 tests and your 8 new ones.
- [ ] `npm run build` passes.
- [ ] In the browser (dev server on 5174): a test Foamer appears, turns and
      walks at you, squashes, then "Bonk" is logged when it reaches you.
      Darts knock visible chunks out of it, suction darts stick and ride,
      two full standard shots pop it into a burst of lime, white and ink
      chunks, and a new one walks in about 3 s later. The wall and its
      falling pieces still work as before.
- [ ] Ten Foamers spawned by hand (`__dart.foamers.spawn(...)`) chasing
      you while you fire stay at or above 60 fps. Report the average and
      worst frame times.
- [ ] No em dash or en dash characters anywhere you wrote, including the
      commit message. macOS grep has no `-P`; check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`.
- [ ] Nothing fetched from another host.
- [ ] A dated `HANDOFF.md` log entry (date with `date +%F`): what was
      built, decisions and why, what is unverified. Update the status
      section: a test Foamer walks at you.
- [ ] Committed on branch `game-03` with a message starting `GAME-03:` and
      ending with `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`.
      **Do not merge into main and do not push.**

## Known limits (do not fix in this task)

- Foamers walk straight at you and can get stuck on obstacles (ENG-08).
- Carving a Foamer never breaks a part off (no island search on Foamers).
- The bonk only logs; there is no player health yet.
- Foamers are blocky (greedy meshed) until ENG-09.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
