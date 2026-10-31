# ENG-10: Foamer parts, damage zones and handicaps

> **On hold (2026-10-31):** Paul is reviewing Foamer shapes and movement in
> the sandbox (`sandbox.html`, ENG-10a) first. The rig and pose code from
> the sandbox (`src/foamers/rig.ts`, `rig-motion.ts`) replaces the part
> layout below; this card is updated after the review, before Pi starts.

```
ID:          ENG-10
Title:       Foamers built from parts (body, head, arms, legs) that take
             their own damage, break off, and handicap the Foamer
Owner:       Pi (Qwen 3.8-27b), unless Paul assigns Claude
Reviewer:    Claude Opus 5.5
Depends on:  GAME-03, ENG-09 (done)
Branch:      eng-10, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `PLAN.md` sections 2, 4.1 (damage zones, decided 2026-10-31) and 7.3
   point 6 (Foamer bodies are parts on a skeleton)
3. `design/CONTENT-PLAN.md` section 3.1 (what breaking each part does)
4. `HANDOFF.md`, especially GAME-03, ENG-09 and the two stutter fixes
   (render interpolation: every moving thing keeps a pose from before the
   last step and is drawn `alpha` of the way to the current one)
5. `src/foamers/*.ts`, `src/voxel/volume-mesh.ts`, `src/voxel/pieces.ts`,
   `src/weapons/impacts.ts`, `src/weapons/darts.ts`, `src/voxel/debris.ts`,
   `tests/foamers/foamers.test.ts`

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
one file, then `npx tsc --noEmit` and the tests, then the next. Never write
more than about 200 lines in one tool call. Suggested order: data, the
part model builder and its test, `FoamerPart`, the Foamer rewrite with
poses (tests 2 and 3), damage and breaking (tests 4 to 9), handicaps and
attacks (tests 5 to 8), stagger, pop, then `main.ts`.

## Goal

Today a Foamer is one voxel volume on one body: darts carve it, but where
you hit it does not matter. After this task a Foamer is a small rig of
parts, each its own smoothed voxel volume on its own kinematic body,
posed every step from the Foamer's root. Each part has health. Shooting a
part carves it and wears its health down; when it breaks it drops off as a
foam piece and the Foamer loses what the part did:

- one leg gone: limps at half speed; both legs: crawls at a quarter
- an arm gone: loses the attacks that need it; both arms: headbutt only
- head gone (double-damage weak point): turns at half rate
- any break: a short stagger

The look stays a placeholder (Paul designs Foamers): the same lime blob
style, now with a head, two stubby arms and two stubby legs.

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-eng-10 -b eng-10
cd ../dart-eng-10
npm install
```

Dev server: `npm run dev -- --port 5174`.

## Files

Create:

- `src/foamers/foamer-part.ts`: `FoamerPart`
- `tests/foamers/parts.test.ts`

Edit:

- `data/foamers.json`: the `test` spec gains `parts`, `attacks`,
  `handicaps`, `stagger` and `brokenParts` (below); `size`, `capsuleRadius`
  and `health` change as listed.
- `src/foamers/foamer-model.ts`: `buildTestFoamer` is replaced by
  `buildTestFoamerPart(volume, part)` that fills one part's volume.
- `src/foamers/foamer.ts`: the Foamer becomes a root plus parts.
- `src/foamers/foamers.ts`: damage by part, breaking, handicaps, attacks,
  stagger, pop of every part.
- `src/main.ts`: `onBonk` logs the attack id; pass `alpha` as today.
- `tests/foamers/foamers.test.ts`: keep every test that still applies
  (update it to the new API); replace test 1 (single-volume model) and 3b
  (single mesh alignment) with their per-part versions in `parts.test.ts`.
  Say in HANDOFF which tests changed and why.

Do not change `DartImpacts`, `darts.ts`, `debris.ts` or the mesher.

## Data: `data/foamers.json`, `test` spec

Distances in metres unless named Voxels. Part offsets and joints are in
the parent part's frame; the root frame has its origin at the feet
centre, +y up, +z the facing direction.

```json
"test": {
  "voxelSize": 0.05,
  "health": 6,
  "damage": { "standard": 1, "suction": 0.5 },
  "minDamageSpeed": 8,
  "speed": 2.2,
  "turnRate": 6,
  "gravity": 22,
  "capsuleRadius": 0.3,
  "capsuleHeight": 1.6,
  "attackRange": 1.3,
  "recover": 0.8,
  "popChunkScale": 2.5,
  "popBursts": 4,
  "stagger": { "time": 0.5 },
  "brokenParts": { "max": 24, "lifetime": 3, "fadeTime": 0.4, "density": 0.3 },
  "handicaps": {
    "oneLegSpeed": 0.5,
    "noLegsSpeed": 0.25,
    "noHeadTurnRate": 0.5
  },
  "attacks": [
    { "id": "bonk", "needs": "anyArm", "windup": 0.6 },
    { "id": "headbutt", "needs": "none", "windup": 0.9 }
  ],
  "parts": [
    { "id": "body", "kind": "body", "sizeVoxels": [12, 14, 10], "parent": null,
      "joint": [0, 0.4, 0], "pivotVoxels": [6, 0, 5],
      "hp": 6, "damageScale": 1, "totalScale": 1, "breakAt": 0 },
    { "id": "head", "kind": "head", "sizeVoxels": [10, 10, 10], "parent": "body",
      "joint": [0, 0.7, 0], "pivotVoxels": [5, 0, 5],
      "hp": 3, "damageScale": 2, "totalScale": 1, "breakAt": 0.35 },
    { "id": "armL", "kind": "arm", "sizeVoxels": [4, 12, 4], "parent": "body",
      "joint": [-0.34, 0.6, 0], "pivotVoxels": [2, 12, 2],
      "hp": 2.5, "damageScale": 1, "totalScale": 0.5, "breakAt": 0.35 },
    { "id": "armR", "kind": "arm", "sizeVoxels": [4, 12, 4], "parent": "body",
      "joint": [0.34, 0.6, 0], "pivotVoxels": [2, 12, 2],
      "hp": 2.5, "damageScale": 1, "totalScale": 0.5, "breakAt": 0.35 },
    { "id": "legL", "kind": "leg", "sizeVoxels": [5, 8, 5], "parent": "body",
      "joint": [-0.15, 0, 0], "pivotVoxels": [2.5, 8, 2.5],
      "hp": 3, "damageScale": 1, "totalScale": 0.5, "breakAt": 0.35 },
    { "id": "legR", "kind": "leg", "sizeVoxels": [5, 8, 5], "parent": "body",
      "joint": [0.15, 0, 0], "pivotVoxels": [2.5, 8, 2.5],
      "hp": 3, "damageScale": 1, "totalScale": 0.5, "breakAt": 0.35 }
  ]
}
```

Remove `size` and `windup` (now per attack). Keep `spawner` as it is.

- `pivotVoxels`: the joint point inside the part's own volume, in voxel
  units (a leg's pivot is its top centre: the hip).
- `hp`: part health. `damageScale`: multiplies dart damage to this part
  (the head takes double). `totalScale`: the fraction of the part damage
  that also comes off the Foamer's total health.
- `breakAt`: the part also breaks when its voxel count falls below this
  fraction of its starting count (visible damage counts, not just hits).
  0 means never by wear.
- The body cannot break off. Total health reaching 0 pops the Foamer.

## The model (`foamer-model.ts`)

`buildTestFoamerPart(volume: VoxelVolume, part: PartSpec)` fills voxels
0..size-1 of one part:

- body and head: the ellipsoid with a flattened bottom, as today.
- head: the two eyes on the +z face as today, but **at least 3 voxels
  wide** (white disc radius 3, ink pupil 2 x 2), because smoothing blurs
  anything thinner (ENG-09 note).
- arms and legs: a rounded capsule along y filling the size.
- Every part is `foam-lime` apart from the eyes. Left and right parts
  mirror each other.

## `FoamerPart` (`foamer-part.ts`)

```ts
export class FoamerPart implements VoxelTarget {
  readonly spec: PartSpec;
  readonly volume: VoxelVolume;
  readonly body: RAPIER.RigidBody;     // its own kinematic body
  readonly mesh: VolumeMesh;           // smooth: true, built on `body`
  readonly group: THREE.Group;         // draws the mesh
  hp: number;
  readonly startVoxels: number;
  broken: boolean;
  /** Pose of the part's volume corner in world space, this step and the
   *  one before (for render interpolation). */
  readonly pos: THREE.Vector3; readonly quat: THREE.Quaternion;
  readonly prevPos: THREE.Vector3; readonly prevQuat: THREE.Quaternion;
  owns(c: RAPIER.Collider): boolean;
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;  // through pos/quat
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** Set this step's pose (keeps the old one as prev) and move the body
   *  with setNextKinematicTranslation / Rotation. */
  setPose(pos: THREE.Vector3, quat: THREE.Quaternion): void;
  syncRender(alpha: number): void;
  get voxelCount(): number;
  dispose(world: RAPIER.World): void;
}
```

The body's origin is the volume's (0,0,0) corner, as GAME-03 did for the
whole Foamer, so the mesh's colliders line up with the voxels.

## The Foamer (`foamer.ts`)

- Keeps `centre`, `yaw`, `prevCentre`, `prevYaw`, `health`, `state`,
  `stateTime`, `vy` as today, and a **root** kinematic body that carries
  only the movement capsule (`capsuleRadius`, `capsuleHeight`).
- `parts: Map<string, FoamerPart>` for the live (unbroken) parts.
- `has(id)`, `legs` (count of live legs), `arms`, `hasHead`.
- `poseParts(t)`: each step after movement, compute every live part's
  world pose: root transform (centre, yaw) times each ancestor's joint and
  animation rotation, then minus the part's `pivotVoxels * voxelSize`
  turned by its rotation, so the pivot sits on the joint. Call
  `part.setPose`. Parts whose parent broke are broken too (an arm falls
  with nothing; only the body has children here).
- Animation (rotations about the joint, `t` = Foamer age in seconds):
  - Walking (moving this step): legs swing about x by
    `sin(t * 8 * speedFactor) * 0.45` rad, opposite to each other; arms
    swing opposite to their leg at 0.3 rad.
  - Windup: both arms rise to -1.4 rad about x over the windup.
  - One leg: the body tilts 0.15 rad toward the missing side.
  - No legs: the body pose drops by the leg length (0.4 m) so it crawls
    on the floor; the capsule stays as it is (known limit).
  - Stagger: a wobble of the body about z, `sin(t * 30) * 0.12` rad.
- `syncRender(alpha)`: every part draws `alpha` of the way from its prev
  pose to its current one.
- `owns(c)` is gone: a collider belongs to a part (or to the root capsule,
  which takes no damage).

## The system (`foamers.ts`)

- Spawn: create the Foamer and push **every part** into `targets` (each
  part is a `VoxelTarget`; `DartImpacts` then carves the right part).
- Damage (chained on `darts.onHit` as today, after `DartImpacts` carved):
  find the live part that owns the hit collider. Ignore slow hits as
  today. `dmg = damage[type] * part.damageScale`; `part.hp -= dmg`;
  `foamer.health -= dmg * part.totalScale`. Then, in this order: if total
  health <= 0, pop; else if the part is not the body and
  (`hp <= 0` or `voxelCount < breakAt * startVoxels`), break it.
- Also check wear after any carve of a part (a neighbouring hit can carve
  it), once per step in `update`.
- Break a part: mark it and its children broken, remove them from
  `targets` and `foamer.parts`, turn each into a falling piece: remove its
  trimesh colliders, add one cuboid of its volume's bounds (inset 0.02 m)
  with `brokenParts.density`, switch the body to dynamic with the part's
  current velocity (pose difference / dt) plus a small outward push
  (1.5 m/s). Keep at most `brokenParts.max` falling parts (oldest
  disposed first); each fades (scale to 0 over `fadeTime`) and is disposed
  after `lifetime`. Interpolate their render pose like debris. Stuck darts
  ride them and drop when they are disposed (darts.ts already does this).
  Then start a stagger.
- Handicaps, worked out from the live parts each step:
  - speed: 2 legs `speed`, 1 leg `speed * oneLegSpeed`, 0 legs
    `speed * noLegsSpeed`
  - turn rate: `turnRate`, times `noHeadTurnRate` without a head
- Attacks: in range, pick the first attack in `attacks` whose `needs` is
  met (`anyArm`: at least one arm; `none`: always). Wind up for its
  `windup`, then call `onBonk(foamer, attackId)` if the player is in range
  as today, then recover.
- Stagger: state `"stagger"` for `stagger.time`: no movement, no attack;
  then back to approach. A stagger during a windup cancels the attack.
- Pop: every live part bursts into debris (as today, per part, with
  `ignoreBody` not needed), falling broken parts are left to fade, every
  body (root and parts) is removed.

## Tests (`tests/foamers/parts.test.ts`)

Real Rapier, the smooth fake mesher from `foamers.test.ts`, a floor.

1. `buildTestFoamerPart`: every part fits its size; armL mirrors armR and
   legL mirrors legR (voxel for voxel); the head has `foam-white` and
   `foam-ink` voxels on its +z half, white at least 3 voxels across.
2. Spawn: the root plus 6 part bodies exist; `targets` holds the 6 parts;
   each part `owns` its own colliders and not another part's.
3. Poses: at rest (no movement, no stagger), each part's pivot point in
   world space is within 1 mm of its parent's joint in world space, and
   the feet (bottom of the legs) are within 0.05 m of the floor.
4. A standard dart fired at the left leg lowers `legL.hp` by 1 and total
   health by 0.5; a dart at the head lowers `head.hp` by 2 and health by 2.
5. Break by hits: darts at the left leg until `legL` breaks. It leaves
   `targets` and `parts`, its body is dynamic and has fallen (y lower after
   30 steps), and over the next 60 steps of approach (after the stagger)
   the Foamer covers 50% (within 15%) of what an intact Foamer covers.
6. Both legs broken: 25% (within 15%).
7. Both arms broken: the next attack is `"headbutt"` (`onBonk` receives
   it), after a windup of 0.9 s, not 0.6.
8. Head broken: turning 180 degrees to face the player takes about twice
   as long as with a head (ratio 1.7 to 2.3).
9. Break by wear: carve the left arm with `carveSphere` until its voxel
   count is under `breakAt` of the start, with hp still above 0; after one
   `update` it is broken.
10. Stagger: right after a break the Foamer does not move for
    `stagger.time` (centre changes by under 1 mm), then moves again.
11. Pop: darts at the body until health is 0: every part body and the
    root are gone from the world; a suction dart stuck to the head is no
    longer stuck.
12. Broken parts are capped at `brokenParts.max` and each is gone after
    `lifetime + fadeTime`.

## Done when

- [ ] `npm test` passes: the existing tests (updated as described) and
      the 12 new ones.
- [ ] `npm run build` passes.
- [ ] In the browser (port 5174): the test Foamer has a head, arms and
      legs that swing as it walks; shooting a leg makes it limp, both legs
      make it crawl, shooting the arms makes it headbutt, shooting the
      head makes it turn slowly; broken parts fall and fade; the Foamer
      wobbles when a part breaks; popping still works. No console errors.
- [ ] 10 Foamers walking at you: report average and worst frame time,
      and the worker time per part remesh.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`).
- [ ] A dated `HANDOFF.md` log entry (`date +%F`): what was built,
      decisions and why, what is unverified, which old tests changed. Do
      not delete or rewrite other entries or headings.
- [ ] Committed on `eng-10`, message starting `ENG-10:` and ending with
      `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`. **Do not merge
      and do not push.**

## Known limits (do not fix in this task)

- A legless Foamer keeps its full-height capsule.
- Parts never re-attach or regrow.
- Only the test Foamer; the real Foamers and their parts are Paul's
  (GAME-10).
- No sounds or particles for a break beyond the falling part.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
