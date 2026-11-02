# GAME-11: a Foamer that loses a leg falls over, then crawls

Written 2026-11-02 from D11 (Paul, 2026-11-01): "Foamers should fall over
when a leg is removed, then crawl. At present they defy physics and tip
over slightly but don't fall, then move slower."

```
ID:          GAME-11
Title:       Leg loss: a living Foamer falls over the way a body tips (no
             canned slump), lands, then crawls at the player and can
             still attack
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-12 (done), AUD-01 (done)
Branch:      game-11, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `design/CONTENT-PLAN.md` section 3.1 (parts and handicaps)
3. `src/foamers/foamer.ts`: `FoamerState`, `speed()`, `startLegs()`, the
   capsule in the constructor, `poseParts` (the "Missing legs: roll the
   body 0.15 rad" lines are what this replaces)
4. `src/foamers/foamers.ts`: `stepFoamer` (the state machine),
   `breakPart`, `goDown`, the character controller move
   (`computeColliderMovement`), `onSound`
5. `src/foamers/rig.ts` (`RigMotion`: y, pitch, roll, rot) and
   `src/foamers/rig-states.ts` (`walkMotion` and friends)
6. `data/foamers.json` (`handicaps`)
7. `tests/foamers/` (the existing Foamer tests, including the one that
   checks no joint jumps when a style changes)

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages,
one per run if you are asked to: never write more than about 80 lines in
one tool call. After each file, run `npx tsc --noEmit` and the tests.

## The design

**Why not a real ragdoll fall:** ENG-12's ragdoll is one-way. Its parts
become dynamic bodies and lose their dart colliders, so a falling Foamer
could not be shot, and turning a ragdoll back into a posed, walking rig is
a large job. Instead the fall is computed like the tipping of a rigid
body: an inverted pendulum about the foot it still stands on. It speeds
up as it goes over (no linear ease), lands, bounces once, and settles.
Every part stays a kinematic, shootable target throughout.

### New states

`FoamerState` gains `"fall"` and `"crawl"`.

- **When:** a part of kind `leg` breaks (`breakPart`) on a living Foamer
  and the legs left are fewer than `handicaps.fallBelowLegs` (2 for F01:
  a biped falls on losing either leg). A Foamer already in `fall` or
  `crawl` does not fall again. Any attack in progress is cancelled. A
  Foamer whose health runs out goes down as before (`goDown` from any
  state, including `fall` and `crawl`; the ragdoll starts from the pose
  it is in).
- **Fall:** the direction is mostly forward with a sideways part toward
  the lost leg's side (`handicaps.fall.sideShare`, 0.35: a left leg lost
  rolls it left). The tilt angle `a` (radians from upright) starts at
  `handicaps.fall.startTilt` (0.12) and follows
  `a'' = (gravity / pivotHeight) * sin(a)`, where `pivotHeight` is the
  height of the body's centre over the ground, integrated per fixed step
  (semi-implicit Euler). When `a` reaches `handicaps.fall.proneTilt`
  (1.35) it bounces: the angular speed reverses at
  `handicaps.fall.bounce` (0.25) of its value, once, then it settles at
  `proneTilt`. The tilt drives `RigMotion.pitch` and `RigMotion.roll`
  split by the direction, and `RigMotion.y` lowers so the body rests on
  the ground when prone. Legs and arms go slack: the arms swing forward
  to reach the ground as it lands. No movement and no attacks during the
  fall. `fall` lasts until settled (it ends after
  `handicaps.fall.settle`, 0.25 s, at rest after the bounce).
- **Crawl:** prone at `proneTilt`, it pulls itself toward the player with
  its arms: a new `crawlMotion(rig, gait, out)` in `rig-states.ts`, arms
  reaching forward in turn, the remaining leg dragging, a small body bob.
  Speed is `rig.speed * handicaps.crawlSpeed` (0.3). It turns at half its
  turn rate. In range it attacks with the attacks its arms allow (`needs`
  as now); a Foamer with no arms left headbutts. The strike reach and the
  player check use the prone body's head position, not the upright one.
- **Collider:** the upright capsule is wrong for a prone body. When the
  fall starts, replace it with a lying capsule (axis along the Foamer's
  forward, radius as now, length the rig's height times
  `handicaps.crawlLength`, 0.7, resting on the ground) so the character
  controller moves the prone shape. Keep the collider within the body's
  voxels, as the upright one is, so darts hit parts, not the capsule.
- **Remove** the "roll 0.15 rad per missing leg" tilt. A Foamer that
  loses a leg but keeps enough legs (a quad later) limps as now at
  `someLegsSpeed`.

### Data (`data/foamers.json`, inside F01's `handicaps`)

```json
"fallBelowLegs": 2,
"crawlSpeed": 0.3,
"crawlLength": 0.7,
"fall": { "startTilt": 0.12, "proneTilt": 1.35, "sideShare": 0.35, "bounce": 0.25, "settle": 0.25 }
```

Add a `_note` in the style of the file explaining each number. Gravity is
the file's existing `gravity`.

### Sound

`FoamerSystem.onSound` gains the kind `"fall"`, called once when the
Foamer lands (the first time `a` reaches `proneTilt`), at the body.
`src/audio/foamer-sounds.ts` plays `FX-topple` for it (no fizz-out: it is
not down). No footsteps while falling or crawling.

### Range

The test panel gets a **Break leg** button: it breaks the left leg of the
nearest living Foamer through `breakPart` (a public method on
`FoamerSystem` for the range only, `breakLegForTest()`, in the style of
the existing test hooks), so the reviewer can watch falls on demand.

## Tests (`tests/foamers/`)

1. Breaking a leg on a living F01 sets `fall`; within 2 s it is `crawl`.
2. The tilt over the fall rises with growing speed (the second half of
   the fall covers more angle than the first half, in equal time), peaks
   at `proneTilt`, bounces back less than `bounce * proneTilt`, and ends
   at `proneTilt`.
3. A left leg lost rolls it left (roll sign), a right leg right.
4. Crawling, it closes on a player 5 m away at `rig.speed * crawlSpeed`
   (within 15%), and attacks once in range; with no arms it headbutts.
5. No joint jumps on entering `fall` or `crawl` (the existing check).
6. A crawling Foamer killed by darts goes down (ragdoll) as before.
7. `onSound` gets `"fall"` once per fall; `FX-topple` plays once.
8. Darts hit a falling Foamer's parts (at least one part is still a
   target mid-fall).

## Done when

- [ ] `npm test` passes (old tests unchanged, the new ones added).
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files | grep -vE '\.(png|glb|webp|jpg)$')`).
- [ ] A dated `HANDOFF.md` log entry at the top of the Log (`date +%F`):
      what was built, decisions and why, what is unverified. Set the
      GAME-11 row in `PLAN.md` to "Pi (review)".
- [ ] Committed on `game-11`, each message ending with
      `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`. **Do not
      merge and do not push.**

Skip the browser check: the reviewer watches falls on the range and
tunes the numbers.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API of existing modules beyond what
this card names.
