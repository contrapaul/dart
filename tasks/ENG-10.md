# ENG-10: Foamer parts, damage zones, going down and popping

Rewritten 2026-10-31 after Paul approved the sandbox rigs and locked in
blocky voxels. The game's test Foamer becomes the sandbox's F01 rig: a body
of voxel parts that take their own damage, break off, handicap the Foamer,
and die in one of two ways (goes down, or pops).

```
ID:          ENG-10
Title:       Game Foamers built from rig parts, with part damage, breaking,
             handicaps, foam-core wounds, going down and popping
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  GAME-03, ENG-10a (sandbox rigs, done)
Branch:      eng-10, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `PLAN.md` sections 2 (content rules: foam only, no blood), 4.1 (damage
   zones) and 7.3 point 6 (Foamer bodies are parts on a skeleton)
3. `design/CONTENT-PLAN.md` sections 3.1 (what breaking each part does),
   3.2 (wounds, going down, popping, with numbers) and 3.3 (looks)
4. `HANDOFF.md`: GAME-03, the render interpolation entries (everything
   that moves keeps its pose from before the last step and is drawn
   `alpha` of the way to the current one), the sandbox and menace pass
   entries, and "Foamers are blocks"
5. `src/foamers/rig.ts` and `src/foamers/rig-motion.ts` (the rig format
   and pose solver: reuse them, do not copy them), `data/foamer-rigs.json`
   (rig F01)
6. `src/sandbox/main.ts`, class `RigView`: `hit`, `carve`, `breakOff`,
   `goDown`, `poseDown`, `pop`. It is a working preview of most of this
   task without physics. Port its ideas; do not import from `src/sandbox/`.
7. `src/foamers/*.ts`, `src/voxel/volume-mesh.ts`, `src/voxel/pieces.ts`,
   `src/voxel/carve.ts`, `src/weapons/impacts.ts`, `src/weapons/darts.ts`,
   `src/voxel/debris.ts`, `tests/foamers/*.ts`

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
one file, then `npx tsc --noEmit` and the tests, then the next. Never write
more than about 200 lines in one tool call. Suggested order: data, the
motion helpers, `FoamerPart`, the Foamer rewrite with poses (tests 1 to
3), damage and breaking (4 to 6, 10), handicaps and attacks (7 to 9),
stagger, going down, popping (11 to 15), then `main.ts`.

## Goal

Today the test Foamer is one lime voxel blob on one body: where you hit it
does not matter, and at zero health it always pops. After this task:

- The test Foamer is rig **F01** from `data/foamer-rigs.json` (the hunched
  grunt with a club): each rig part is its own voxel volume on its own
  kinematic body, posed every step by `solvePose` from the Foamer's root.
- Shooting a part carves it, paints the foam around the crater in the
  **foam core** colour, and wears down that part's health and the
  Foamer's health.
- A part whose health runs out (or that loses enough foam) **breaks off**:
  it and its children fall as one physics piece, both sides of the break
  show a core-coloured stump, the Foamer staggers and loses what the part
  did (legs: speed; arms: attacks; head: turning).
- At zero health the Foamer **goes down** (topples, lies there, sinks
  away) unless the damage that killed it was **catastrophic**, in which
  case it **pops** into foam chunks as today. Losing the head and an arm
  also downs it.

Blocky voxels only: there is no smoothing any more (Paul, 2026-10-31).

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-eng-10 -b eng-10
cd ../dart-eng-10
npm install
```

Dev server: `npm run dev -- --port 5174`. The sandbox is at
`http://localhost:5174/sandbox.html` and must keep working.

## Files

Create:

- `src/foamers/foamer-part.ts`: `FoamerPart`
- `src/foamers/rig-states.ts`: game motion helpers (below)
- `tests/foamers/parts.test.ts`

Edit:

- `data/foamers.json`: replace the `test` spec (below). Keep `spawner`.
- `src/foamers/rig-motion.ts`: export the existing `bipedWalk`,
  `quadWalk`, `ease` and `clamp01` (no other change; the sandbox uses
  this file).
- `src/foamers/foamer.ts`: the Foamer becomes a root plus parts.
- `src/foamers/foamers.ts`: damage by part, breaking, handicaps, attacks,
  stagger, wounds, going down, popping.
- `src/foamers/foamer-model.ts`: delete `buildTestFoamer` and the file if
  nothing else uses it (`buildPartVolume` in `rig.ts` replaces it).
- `src/main.ts`: `onBonk` logs the attack id; pass `alpha` as today.
- `tests/foamers/foamers.test.ts`: keep every test that still applies,
  updated to the new API. Test 1 (single-volume model) and 3b (single
  mesh alignment) are replaced by per-part tests in `parts.test.ts`. Say
  in HANDOFF which tests changed and why.

Do not change `rig.ts` (other than adding exports if you must),
`DartImpacts`, `darts.ts`, `debris.ts`, the mesher, or anything in
`src/sandbox/`.

## Data: `data/foamers.json`

Distances in metres, times in seconds. Rig shapes, `speed` and `health`
come from `data/foamer-rigs.json` (one source: F01's speed is 1.0 m/s and
health 6). Everything about how damage works lives here:

```json
"test": {
  "rig": "F01",
  "damage": { "standard": 1, "suction": 0.5 },
  "minDamageSpeed": 8,
  "turnRate": 6,
  "gravity": 22,
  "attackRange": 1.3,
  "recover": 0.8,
  "popChunkScale": 2.5,
  "popBursts": 4,
  "poseBlend": 0.06,
  "partDamage": {
    "_note": "Per part kind. hpShare: the part's health as a share of the Foamer's (at least minHp). hit: multiplies dart damage to the part. total: share of that damage that also comes off the Foamer's health. CONTENT-PLAN 3.1 and 3.2.",
    "minHp": 2,
    "kinds": {
      "body":    { "hpShare": 0,    "hit": 1, "total": 1 },
      "head":    { "hpShare": 0.3,  "hit": 2, "total": 1 },
      "arm":     { "hpShare": 0.2,  "hit": 1, "total": 0.5 },
      "leg":     { "hpShare": 0.25, "hit": 1, "total": 0.5 },
      "weapon":  { "hpShare": 0.25, "hit": 1, "total": 0.5 },
      "ability": { "hpShare": 0.25, "hit": 1, "total": 0.5 },
      "fin":     { "hpShare": 0.15, "hit": 1, "total": 0.5 },
      "detail":  { "hpShare": 0.15, "hit": 1, "total": 0.5 }
    },
    "wearBreak": 0.4
  },
  "catastrophic": { "share": 0.4, "window": 0.1 },
  "wound": { "coreShell": 1.0, "stumpRadius": 0.12 },
  "stagger": { "time": 0.5 },
  "down": { "topple": 0.7, "lie": 3.5, "sinkSpeed": 0.35, "max": 8 },
  "brokenParts": { "max": 24, "lifetime": 4, "sinkTime": 1, "density": 0.3 },
  "handicaps": { "someLegsSpeed": 0.5, "noLegsSpeed": 0.25, "noHeadTurnRate": 0.5 },
  "attacks": [
    { "id": "bonk", "needs": ["foreArmL", "foreArmR"], "windup": 0.6, "strike": 0.2 },
    { "id": "headbutt", "needs": [], "windup": 0.9, "strike": 0.2 }
  ]
}
```

- `kind` is the rig part's `kind` (`rig.ts` `PartKind`). The body
  (`hpShare` 0) never breaks.
- Part health: `max(minHp, round(rig.health * hpShare))`.
- A dart of damage `d` on part P: `P.hp -= d * hit`;
  `foamer.health -= d * hit * total`. (A head shot: 2 off the head, 2 off
  the Foamer. An arm shot: 1 off the arm, 0.5 off the Foamer.)
- `wearBreak`: a part also breaks when it has lost this share of its
  starting voxels.
- `catastrophic`: the Foamer pops instead of going down when the damage it
  took in the last `window` seconds (the killing hit plus anything in the
  same moment, so a shotgun blast of 3 darts counts as one hit) is at
  least `share` of its max health. Otherwise it goes down.
- `attacks.needs`: part ids, at least one still attached; `[]` always.
  The first attack whose needs are met is used.
- The capsule is no longer in data. Work it out from the rig at spawn:
  radius half the wider of the body part's x and z size, height
  `rigHeight(rig)`.

## `FoamerPart` (`foamer-part.ts`)

```ts
export class FoamerPart implements VoxelTarget {
  readonly spec: PartSpec;              // from the rig
  readonly volume: VoxelVolume;         // filled by buildPartVolume
  readonly body: RAPIER.RigidBody;      // its own kinematic body
  readonly mesh: VolumeMesh;            // built on `body`
  readonly group: THREE.Group;          // draws the mesh
  hp: number;
  readonly maxHp: number;
  readonly startVoxels: number;
  /** World matrix of the volume's (0,0,0) corner in metres, this step and
   *  the one before (render interpolation). */
  readonly pose: THREE.Matrix4;
  readonly prevPose: THREE.Matrix4;
  owns(c: RAPIER.Collider): boolean;
  worldToVoxel(v: THREE.Vector3): THREE.Vector3;
  voxelToWorld(v: THREE.Vector3): THREE.Vector3;
  /** Set this step's pose from solvePose's matrix (keep the old one as
   *  prev) and move the body with setNextKinematicTranslation/Rotation. */
  setPose(m: THREE.Matrix4): void;
  syncRender(alpha: number): void;
  get voxelCount(): number;
  dispose(world: RAPIER.World): void;
}
```

`solvePose` returns, per part, the world matrix of the part's voxel corner
in metres (a part's voxels map to the world as matrix x (voxel x
voxelSize)). The body's origin is that corner, as GAME-03 did for the
whole Foamer, so the mesh's colliders line up with the voxels. Motion
squash scales the matrix: use only its rotation and translation for the
body, and draw the group with the full matrix.

## Motion (`rig-states.ts`)

The sandbox's movement styles run on a timer loop (walk, then an attack,
then walk). The game drives the Foamer from its state instead, so build
motions from parts:

```ts
/** Walk cycle for whatever legs the rig has left (two-leg or four-leg
 *  gait, as rig-motion does). gait: phase that advances with distance
 *  walked; amount 0..1 scales the stride (0 when standing). */
export function walkMotion(rig: RigSpec, gait: number, amount: number, out: RigMotion): void;
/** Attack wind-up, k 0..1: bonk raises the right arm (with its club) over
 *  the head; headbutt leans back. */
export function windupMotion(rig: RigSpec, attack: string, k: number, out: RigMotion): void;
/** The strike, k 0..1: the raised arm comes down fast; or lean forward. */
export function strikeMotion(rig: RigSpec, attack: string, k: number, out: RigMotion): void;
/** Stagger wobble about z. */
export function staggerMotion(t: number, out: RigMotion): void;
/** Toppled pose, k 0..1 of the topple: forward for two-leg rigs, onto the
 *  side for others; arms, legs and head go limp (sandbox poseDown). */
export function downMotion(rig: RigSpec, k: number, out: RigMotion): void;
```

- The Foamer keeps one `motion` and each step eases it toward the target
  motion for its state: `blend = 1 - exp(-dt / poseBlend)` on y, pitch,
  roll, squash and every rotation. No joint may jump between steps.
- Missing legs: with some legs gone, roll the body 0.15 rad toward the
  missing side; with all legs gone, after solving the pose find the
  lowest point of the attached parts (box corners, as the sandbox's
  `poseDown`) and move the whole pose so it rests on the ground. Downed
  Foamers use the same fit.

## The Foamer (`foamer.ts`)

- Keeps `centre`, `yaw`, `prevCentre`, `prevYaw`, `health`, `maxHealth`,
  `state`, `stateTime`, `vy`; a **root** kinematic body carrying only the
  movement capsule; `parts: Map<string, FoamerPart>` for attached parts;
  `gait` and `motion`; recent damage with times (for the catastrophic
  window).
- `has(id)`, `legs` (attached parts of kind leg whose parent is the root
  part), `startLegs`, `hasHead`.
- States: `approach`, `windup`, `strike`, `recover`, `stagger`, `down`.
- `poseParts()`: once per step after movement: build the target motion
  for the state, ease toward it, `solvePose(rig, feet, yaw, motion, map)`,
  apply the leg fit, `part.setPose(...)` for attached parts.
- `syncRender(alpha)`: every part draws `alpha` of the way from its prev
  pose to its current one (decompose both matrices, lerp/slerp, compose).

## The system (`foamers.ts`)

- **Spawn**: create the Foamer from the rig named in `test.rig`; push
  every part into `targets` (each part is a `VoxelTarget`, so
  `DartImpacts` carves the right one).
- **Damage** (chained on `darts.onHit` after `DartImpacts` carved, as
  today): find the attached part that owns the collider; ignore slow hits
  as today; apply the part and total damage above; record it for the
  catastrophic window. Then **paint the wound**: every solid voxel of
  that part within the dart's carve radius plus `wound.coreShell` voxels
  of the hit (in the part's voxel space) becomes `foam-core`, as
  `RigView.carve` does (`VoxelVolume.set` marks the chunk dirty; the mesh
  picks it up).
- Then, in this order: if `health <= 0`, **pop** if the damage in the last
  `catastrophic.window` seconds is at least `catastrophic.share x
  maxHealth`, otherwise **go down**. Else if the part is not the body and
  (`hp <= 0` or it has lost `wearBreak` of its voxels), **break** it.
- Check wear once per step in `update` too (a hit nearby can carve it).
- **Break a part**: the part and all its children (rig `parent` links)
  leave `targets` and `parts`. Carve and paint a stump on the parent at
  the joint (radius `wound.stumpRadius` metres) and paint the part's own
  pivot end core, as `RigView.breakOff`. The part and its children become
  one falling piece: one dynamic body at the part's pose, one cuboid
  collider per part (its voxel bounds, inset 0.02 m, `brokenParts.density`),
  velocity from the pose difference / dt plus 1.5 m/s outward and up.
  Remove their trimesh colliders. Keep at most `brokenParts.max` pieces
  (oldest disposed first); each lies for `lifetime`, then sinks through
  the floor over `sinkTime` (move it down, no collisions) and is disposed.
  Interpolate their drawn pose like debris. Stuck darts drop when a piece
  is disposed (`darts.ts` already handles bodies that go away). Then
  stagger, and if the head and any part of kind arm are both gone, go
  down.
- **Handicaps** each step: speed `rig.speed`, times `someLegsSpeed` if
  some legs are gone, `noLegsSpeed` if all are gone; turn rate times
  `noHeadTurnRate` without a head.
- **Attacks**: in range, the first attack whose `needs` are met: windup
  for `windup` s, strike for `strike` s (call `onBonk(foamer, attackId)`
  at the start of the strike if the player is in range), recover.
- **Stagger**: `stagger.time` with no movement and no attack; a stagger
  during a windup cancels the attack.
- **Go down**: state `down`. It stops moving and attacking, its parts
  leave `targets` and lose their colliders (darts pass through), and its
  root capsule is removed. It topples over `down.topple` s, lies for
  `down.lie` s, then sinks at `down.sinkSpeed` m/s until it is below the
  floor by its height, then it is disposed and counts as gone for the
  spawner. At most `down.max` downed Foamers: past that, the oldest
  starts sinking at once. Stuck darts drop.
- **Pop**: as today, every attached part bursts into debris (per part),
  falling pieces are left to sink, every body is removed.

## Tests (`tests/foamers/parts.test.ts`)

Real Rapier, the fake mesher from `foamers.test.ts` (greedy blocks), a
floor. Use rig F01 unless a test says otherwise.

1. Spawn: the root plus one body per F01 part exist; `targets` holds every
   part; each part `owns` its own colliders and not another part's.
2. Poses: at rest, each part's pivot point in world space is within 1 mm
   of its parent's joint in world space (as `rig.test.ts` checks), and the
   lowest leg voxel is within 0.05 m of the floor.
3. Walking for 2 s, no part rotates more than 0.35 rad in one step (no
   snaps).
4. A standard dart at `legL` lowers its hp by 1 and the Foamer's health by
   0.5; a dart at the head lowers the head's hp by 2 and health by 2.
5. A wound paints `foam-core` voxels in the hit part around the crater,
   and none in other parts.
6. Break by hits: darts at `legL` until it breaks. It leaves `targets`
   and `parts`, the parent has `foam-core` voxels at the hip, the piece
   is dynamic and has fallen (lower after 30 steps).
7. One leg gone: over 60 steps of approach (after the stagger) the Foamer
   covers 50% (within 15%) of what an intact one covers; both legs gone:
   25%, and its lowest part is within 0.1 m of the floor.
8. Both forearms gone: the next attack is `headbutt`, after a 0.9 s
   windup, not 0.6.
9. Head gone: turning 180 degrees to face the player takes 1.7 to 2.3
   times as long as with a head.
10. Break by wear: carve `armL` with `carveSphere` until it has lost
    `wearBreak` of its voxels with hp above 0; after one `update` it is
    broken.
11. Stagger: right after a break the Foamer's centre moves under 1 mm for
    `stagger.time`, then moves again.
12. Going down: single darts at the body, 0.2 s apart, until health is 0.
    The Foamer is `down`, has no colliders left and no parts in
    `targets`, its body pitch reaches at least 1 rad within `topple` s,
    and it is disposed within `topple + lie + 3` s. A suction dart stuck
    to it is no longer stuck after that.
13. Head and an arm gone with health above 0: the Foamer goes down.
14. Catastrophic: with health at 3 or less, three standard darts hitting
    the body in the same step (3 >= 0.4 x 6) pop it: every body is gone
    and debris spawned. One dart killing it at 1 health downs it instead.
15. Caps: broken pieces stay at or under `brokenParts.max`; with
    `down.max + 2` Foamers downed, at least 2 are sinking early.

## Done when

- [ ] `npm test` passes: the existing tests (updated as described), the
      sandbox's `rig.test.ts` unchanged, and the 15 new ones.
- [ ] `npm run build` passes.
- [ ] In the browser (port 5174): the test Foamer is the grey F01 with its
      club; it walks with its legs and arms swinging, winds up and bonks.
      Shots show yellow foam-core craters; shooting a leg makes it limp,
      both legs make it crawl on the floor, shooting off both forearms
      makes it headbutt, shooting off the head makes it turn slowly;
      broken parts fall, lie, then sink away; it wobbles when a part
      breaks. Single darts at range down it (it topples and sinks); a
      close pump blast that kills it pops it. The sandbox still works.
      No console errors.
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

- Only F01 in the game; the other rigs come with GAME-10 and Paul's cards.
- The capsule does not shrink when legs are lost.
- Parts never re-attach or regrow. No finishers yet (GAME-07).
- No foam fizz particles (the sandbox has them; a later task moves its
  `Burst` into the game) and no sounds.
- The foam core colour is a placeholder until Paul picks it.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
