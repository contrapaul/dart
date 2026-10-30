# ENG-06: Island detection and falling pieces

```
ID:          ENG-06
Title:       After a carve, voxels no longer connected to an anchor break
             off and fall as physics bodies
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-05, GAME-02 (both done)
Branch:      eng-06, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (rules for this repo; every rule applies to you)
2. `PLAN.md` section 7.3 (voxel destruction), point 4 "Structural break-off"
3. `HANDOFF.md` (current state, especially the ENG-04, ENG-05 and GAME-02
   entries)
4. `src/voxel/chunk.ts`, `src/voxel/carve.ts`, `src/voxel/volume-mesh.ts`,
   `src/voxel/mesher.ts`, `src/voxel/debris.ts`, `src/weapons/impacts.ts`,
   `src/main.ts` (the code you connect to)

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
write one file, run `npx tsc --noEmit` and the tests, then the next file.
Never write more than about 200 lines in one tool call. Suggested order:
`islands.ts`, its tests, `chunk.ts` and `volume-mesh.ts` changes,
`pieces.ts`, its tests, then `impacts.ts` and `main.ts`.

## Goal

Today, when a carve cuts a piece of foam loose, the piece floats in the air.
After this task it breaks off and falls: a new dynamic rigid body with its
own small voxel mesh, which lands, tumbles and comes to rest. Tiny loose
bits become foam debris instead. Darts can hit falling pieces, and suction
darts stick to them and ride along.

**Anchors:** a voxel is anchored if it is connected (through face
neighbours, 6-connectivity) to an indestructible voxel (`bedrock` in
`data/materials.json`). The test wall already has a bedrock row at y = 0.
A volume with no bedrock never breaks apart, because of the search budget
below. Keep it that way; do not add other anchor rules.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-eng-06 -b eng-06
cd ../dart-eng-06
npm install
```

Run the dev server with `npm run dev -- --port 5174` so it does not clash
with port 5173.

## Files

You own these (create them):

| File | Purpose |
|---|---|
| `src/voxel/islands.ts` | Pure functions: `findIslands` and `boxCover` |
| `src/voxel/pieces.ts` | `FallingPieces`: turns islands into falling bodies with meshes |
| `tests/voxel/islands.test.ts` | Tests 1 to 5 |
| `tests/voxel/pieces.test.ts` | Tests 6 to 8 |

You may make these changes and nothing else:

| File | Allowed change |
|---|---|
| `src/voxel/chunk.ts` | Add `get dirtyCount(): number` to `VoxelVolume` (the size of the private `dirty` set). |
| `src/voxel/volume-mesh.ts` | Add `get busy(): boolean`: true while `volume.dirtyCount > 0` or any remesh job sent by `update()` has not come back yet. Count jobs with a private counter: increment when a job is sent, decrement when its promise resolves, whether or not the result is stale. |
| `data/destruction.json` | Add the `"islands"` block below. Mention it in `_note`. |
| `src/weapons/impacts.ts` | Add `onCarve: (target: VoxelTarget, removed: RemovedVoxel[]) => void = () => {};` to `DartImpacts`, called at the end of `handleHit` after `releaseInSphere`, only when voxels were removed. |
| `src/main.ts` | Wiring and the test tower, described under "Wiring". Nothing else. |
| `HANDOFF.md` | Your log entry at the top of the log, and the status section |

Do **not** edit anything in `src/core/`, `src/render/`, `src/physics/`,
`src/player/`, `src/ui/`, any other file in `src/weapons/` or `src/voxel/`,
any other `data/` file, `PLAN.md` or `CLAUDE.md`.

## Data: `data/destruction.json`

Add this block next to `"carve"` and `"debris"`:

```json
"islands": {
  "maxSearchVoxels": 6000,
  "minPieceVoxels": 8,
  "maxPieces": 16,
  "maxCollidersPerPiece": 48,
  "colliderInset": 0.02,
  "maxHoldTime": 0.5,
  "fadeTime": 0.4,
  "density": 0.3,
  "friction": 0.8,
  "restitution": 0.1
}
```

- `maxSearchVoxels`: a flood fill that visits this many voxels without
  finding an anchor stops and treats its component as anchored. This caps
  the cost per carve and is why a volume without bedrock never falls apart.
- `minPieceVoxels`: islands smaller than this become foam debris.
- `maxPieces`: hard cap on live falling pieces. A new piece over the cap
  starts the oldest one fading.
- `maxCollidersPerPiece`: above this many boxes, use one convex hull.
- `colliderInset`: voxels trimmed from each side of every collider box, so
  a new piece never starts touching the voxels it broke away from.
- `maxHoldTime`: longest a new piece waits (seconds) before it is released,
  see "Hold, then release".
- `fadeTime`: seconds a piece takes to shrink away when removed.
- `density`, `friction`, `restitution`: the piece colliders.

## Public API (implement exactly this)

### `src/voxel/islands.ts`

```ts
import type { VoxelVolume } from "./chunk";
import type { RemovedVoxel } from "./carve";

export interface Island {
  /** Every voxel of the island with its material. */
  voxels: RemovedVoxel[];
  /** Inclusive bounds in the volume's voxel coordinates. */
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Find voxel groups cut loose by a carve. `removed` is what carveSphere
 * returned. Does not change the volume.
 */
export function findIslands(volume: VoxelVolume, removed: { x: number; y: number; z: number }[], maxSearch: number): Island[];

/** An inclusive box of voxel coordinates. */
export interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

/** Cover exactly these voxels with non-overlapping boxes, few of them. */
export function boxCover(voxels: { x: number; y: number; z: number }[]): Box[];
```

### `src/voxel/pieces.ts`

```ts
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../physics/world";
import type { VoxelVolume } from "./chunk";
import type { RemovedVoxel } from "./carve";
import type { MeshData } from "./mesher";
import type { DebrisSystem } from "./debris";

/** The volume a carve happened in. A VolumeMesh matches this directly. */
export interface PieceSource {
  volume: VoxelVolume;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** True while the source still has remesh work outstanding. */
  readonly busy: boolean;
}

/** What FallingPieces needs from a MesherPool; tests pass a fake. */
export interface Mesher {
  mesh(padded: Uint8Array): Promise<MeshData>;
}

export class FallingPieces {
  /** Add to the scene once. Every piece's meshes live under it. */
  readonly group: THREE.Group;
  /** Called once per island removed from a source, with a world-space
   *  bounding sphere (main uses it to drop darts stuck there). */
  onBreak: (centre: THREE.Vector3, radius: number) => void;
  readonly stats: { islands: number; pieces: number; toDebris: number; searchMs: number };

  constructor(rapier: Rapier, world: RAPIER.World, mesher: Mesher, debris: DebrisSystem);

  /** Call after every carve. Returns how many islands broke off. */
  afterCarve(source: PieceSource, removed: RemovedVoxel[]): number;
  /** Fixed step: hold and release, fading, removal. */
  update(dt: number): void;
  /** Render frame: copy body transforms to the piece meshes. */
  syncRender(): void;
  /** Pieces that exist, including fading ones. */
  get live(): number;
}
```

`stats.searchMs` is the time `findIslands` took in the most recent
`afterCarve` (use `performance.now()`).

## Behaviour

### `findIslands`

1. Seeds: the six face neighbours of every removed voxel that are not
   empty.
2. Keep one `visited` set for the whole call. Pack a voxel into one number
   key; coordinates fit in -2048 to 2047 on each axis.
3. For each seed not yet visited, flood fill through non-empty face
   neighbours with an explicit stack (no recursion). Push the -y neighbour
   last so it is popped first: the search heads down toward the bedrock
   and usually finds an anchor in a few dozen steps.
4. Stop the fill as soon as it reaches an indestructible voxel (anchored),
   or when it has visited `maxSearch` voxels (treated as anchored). Every
   voxel the fill touched stays in `visited`, so later seeds in the same
   component are skipped.
5. A fill that ends because the stack is empty, with no anchor found, is
   an island. Record its voxels with materials and its bounds.

### `boxCover`

Greedy box merging: take the voxels in y, then z, then x order. For each
voxel not yet covered, grow a box along +x while voxels exist and are not
covered, then along +z while the whole row exists, then along +y while the
whole slab exists. Mark the box covered and emit it. A solid box of voxels
must come out as exactly one box.

### `afterCarve`

1. `findIslands(source.volume, removed, maxSearchVoxels)`; time it into
   `stats.searchMs`. Add the count to `stats.islands`.
2. For each island:
   - Set every island voxel to empty in the source volume.
   - Call `onBreak(centre, radius)`. The centre is the world position of
     the bounds' middle, and the radius is half the bounds' diagonal in
     metres plus one voxel.
   - If it has fewer than `minPieceVoxels` voxels, pass it to
     `debris.spawn(island.voxels, centre, voxelSize, toWorld)` exactly as
     `impacts.ts` does, add 1 to `stats.toDebris`, and stop there.
   - Otherwise make a piece (below) and add 1 to `stats.pieces`. If that
     makes more than `maxPieces` non-fading pieces, start the oldest
     non-fading one fading.
3. Return the island count.

### Making a piece

- Copy the island into a new `VoxelVolume` with the same `voxelSize`,
  shifted so the island's `min` corner is voxel (0, 0, 0).
- Body origin: `source.voxelToWorld(min)`, the world position of that
  corner. Create it as `kinematicPositionBased` at that origin (it is held
  still at first, see below).
- Colliders, in the body's frame (metres): one cuboid per `boxCover` box,
  each side trimmed by `colliderInset` voxels, using `density`, `friction`
  and `restitution`. Rapier then works out the mass and centre of mass.
  If there are more than `maxCollidersPerPiece` boxes, use one
  `ColliderDesc.convexHull` of all box corners instead. If that returns
  null, use one cuboid of the island's bounds. Default collision groups,
  so the player, darts and debris all touch pieces.
- Meshes: a `THREE.Group` per piece, added to `this.group`. For each chunk
  of the piece volume, send `buildPadded(...)` to `mesher.mesh()` and build
  a mesh from the result the same way `VolumeMesh.apply` does (same shared
  material settings, chunk offset, `scale.setScalar(voxelSize)`), but with
  no collider. The piece group starts hidden.

### Hold, then release

The source volume's old trimesh colliders still contain the island until
its remesh comes back. A dynamic body inside them would be thrown out at
high speed. So a new piece stays kinematic and hidden until both:

- `source.busy` is false, and
- all of the piece's own mesh jobs have come back,

or until it has been held for `maxHoldTime` seconds. Then switch it with
`body.setBodyType(rapier.RigidBodyType.Dynamic, true)` and show its group.
Check this in `update(dt)`.

### Fading and removal

- A fading piece: remove its body at the start of the fade (suction darts
  stuck to it then fall, which `DartSystem` already handles). Shrink its
  group's scale from 1 to 0 over `fadeTime` around the piece's centre,
  then dispose its geometries and remove the group.
- A piece whose body falls below y = -20 is removed at once.
- Pieces do not expire on a timer. They stay until the cap pushes them out.

### `syncRender`

For each released piece with a body, copy the body's translation and
rotation to its group. A fading piece keeps its last transform while it
shrinks.

## Wiring (`src/main.ts`)

- After `debris` is created: create `pieces = new FallingPieces(rapier,
  world, mesherPool, debris)` and `scene.add(pieces.group)`.
- After `darts` is created: `pieces.onBreak = (c, r) =>
  darts.releaseInSphere(c, r);`
- After `impacts` is created: `impacts.onCarve = (_target, removed) =>
  pieces.afterCarve(voxelMesh, removed);` with a comment that there is one
  voxel volume for now.
- In `debugBlast`, after `debris.spawn(...)`: `pieces.afterCarve(voxelMesh,
  removed);`
- In `update`, next to `debris.update(dt)`: `pieces.update(dt);`
- In `render`, next to `debris.syncRender()`: `pieces.syncRender();`
- Add `pieces` to the `window.__dart` dev hook.
- A test tower in the same `voxels` volume, after the existing wall and
  before `new VolumeMesh(...)`: a T shape you can shoot apart.

  ```ts
  // Test tower for ENG-06: shoot through the pillar and the top falls;
  // cut an arm at the joint and the arm falls.
  voxels.fillBox(52, 0, 0, 55, 19, 3, materialId("foam-lime"));
  voxels.fillBox(52, 0, 0, 55, 0, 3, materialId("bedrock"));
  voxels.fillBox(44, 20, 0, 63, 23, 3, materialId("foam-pink"));
  ```

## Tests

Use a real `VoxelVolume` and real Rapier, as the existing tests do. Use
`materialId("foam-orange")` and `materialId("bedrock")` for materials.

`tests/voxel/islands.test.ts`:

1. A 4 x 20 x 4 pillar (x 0 to 3, y 0 to 19, z 0 to 3) with a bedrock
   bottom row at y = 0. Empty the whole layer
   y = 10 and pass those voxels as `removed`. Exactly one island, holding
   exactly the 4 x 9 x 4 voxels above (y 11 to 19), with matching bounds.
   The volume still contains those voxels afterwards.
2. The same pillar, but leave one voxel of the y = 10 layer in place. No
   islands.
3. A T: pillar at x 8 to 11, y 0 to 19, z 0 to 3 (bedrock row at
   y = 0), and a crossbar at x 0 to 19, y 20 to 23, z 0 to 3. Empty the
   crossbar voxels at x 4 to 7 and at x 12 to 15. Exactly two islands,
   x 0 to 3 and x 16 to 19 of the crossbar, 64 voxels each.
4. A floating 20 x 20 x 20 block with no bedrock. Empty one corner voxel,
   pass it as `removed`, with `maxSearch` 1000. No islands.
5. `boxCover`: a solid 4 x 5 x 6 block gives exactly 1 box. An L of two
   boxes gives at most 3. For both, the boxes cover every input voxel
   exactly once and nothing else.

`tests/voxel/pieces.test.ts` (Node has no Worker: pass a fake `Mesher`
whose `mesh(padded)` returns `Promise.resolve(greedyMesh(padded,
linearColorTable()))`. After `afterCarve`, let the promises run with
`await new Promise((r) => setTimeout(r, 0))` before stepping):

6. A source volume (a pillar as in test 1, with a fake `PieceSource` whose
   `voxelToWorld` scales by the voxel size 0.1, and whose `busy` is a plain
   field) above a fixed floor cuboid with its top at y = 0. Empty the
   y = 10 layer and call `afterCarve`. It returns 1, `live` is 1, and the
   source volume no longer contains any voxel above y = 10. With `busy`
   false, step `update` and `world.step()` 180 times at 1/60 s: the piece
   body has fallen more than 0.5 m and its translation y is at least -0.05
   (it landed on the floor and did not fall through).
7. Hold: as test 6, but `busy` is true. After 10 steps (under
   `maxHoldTime`) the body has not moved and is kinematic. Set `busy`
   false: within 5 more steps it is dynamic. Separately, with `busy` left
   true, it becomes dynamic once `maxHoldTime` has passed.
8. Debris and the cap: an island of 3 voxels goes to debris (`debris.live`
   goes up, `live` stays 0, `stats.toDebris` is 1). Then make
   `maxPieces + 3` separate pieces and step past `fadeTime`: `live` equals
   `maxPieces`.

## Done when

- [ ] `npm test` passes: the existing 41 tests and your 8 new ones.
- [ ] `npm run build` passes.
- [ ] In the browser (dev server on 5174), using the melee debug blast
      (F) and the blaster:
  - Blasting through the tower's pillar drops the top. It lands, tumbles
    and comes to rest on the floor, and it is not thrown violently.
  - Cutting one crossbar arm at the joint drops just that arm.
  - Cutting a loose corner off the wall drops it.
  - A tiny loose bit becomes debris, not a piece.
  - Darts bounce off fallen pieces, and suction darts stick to them.
  - You can stand on a fallen piece.
- [ ] Knocking down 20 or more pieces stays at or above 60 fps, and
      `live` never goes over `maxPieces`. Report the largest
      `stats.searchMs` you saw from rapid fire at the wall (target: under
      1 ms).
- [ ] No em dash or en dash characters anywhere you wrote, including the
      commit message. macOS grep has no `-P`; check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`.
- [ ] Nothing fetched from another host.
- [ ] A dated `HANDOFF.md` log entry (date with `date +%F`): what was
      built, decisions and why, what is unverified. Update the status
      section: loose foam now falls, and the test tower exists.
- [ ] Committed on branch `eng-06` with a message starting `ENG-06:` and
      ending with `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`.
      **Do not merge into main and do not push.**

## Known limits (do not fix in this task)

- Falling pieces cannot be carved. That needs `DartImpacts` to support
  moving volumes, a later task.
- Darts stuck near, but not on, a broken-off island also fall, because the
  release uses a bounding sphere.
- Convex hull pieces (over `maxCollidersPerPiece` boxes) can rest on
  slightly more air than their visible shape.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
