# ENG-12: Foamers go limp when killed (ragdoll)

Written 2026-11-01 after Paul's play test of ENG-10: "all fall forward the
same way, made worse by their arms holding their body off the ground.
Ideally they'd go limp when killed, rather than have a canned animation."

```
ID:          ENG-12
Title:       A downed Foamer becomes a jointed physics ragdoll that falls
             the way the killing hit pushes it, lies still, then sinks
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-10, ENG-11 (both done)
Branch:      eng-12, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (every rule applies to you)
2. `HANDOFF.md`: the ENG-10 entries (going down, broken pieces, the
   review fixes) and the 2026-11-01 play test notes
3. `tasks/ENG-10.md` sections "The system" (Go down) and the tests for
   going down (12, 15)
4. `src/foamers/foamers.ts` (`goDown`, `stepDown`, `breakPart`: broken
   pieces already turn parts into dynamic bodies with cuboid colliders,
   reuse that), `src/foamers/foamer.ts`, `src/foamers/foamer-part.ts`,
   `src/foamers/rig.ts` (`solvePose`, the joint `at` and `pivot`),
   `src/foamers/rig-states.ts` (`downMotion`, which this replaces)
5. `src/physics/world.ts` (collision groups)

## How to work (important)

Keep each reply's thinking short and act through tools. Build in stages:
one file, then `npx tsc --noEmit` and the tests, then the next. Never write
more than about 200 lines in one tool call. Suggested order: data, the
collision group, building the ragdoll (tests 1, 5, 9), the kill push
(3, 4), settling and limits (2, 6, 10), sinking and caps (7, 8), then
removing the old topple.

## Goal

Today a Foamer that goes down plays `downMotion`: every Foamer topples
forward the same way, arms and club stiff, and the arms prop the body off
the floor. After this task:

- When a Foamer goes down, every part still attached becomes a
  **dynamic body**, joined to its parent at the rig's joint by a hinge
  with limits, so nothing bends the wrong way.
- The **killing hit pushes** the part it hit, so a Foamer shot from the
  left falls to the right, one shot in the head falls backwards, and no
  two falls look alike.
- It falls under gravity, **lies still** for `down.lie` seconds, then
  **sinks** away as today and is removed.
- Darts and the player pass through ragdolls (they are scenery, not
  cover, and cannot be farmed for hits).

## Setup

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-eng-12 -b eng-12
cd ../dart-eng-12
npm install
```

Dev server: `npm run dev -- --port 5176`. Check it on the range,
`http://localhost:5176/range.html`.

## Data: `data/foamers.json`, `test.down`

Replace `topple` with a `ragdoll` block (starting values, tuned on the
range in review):

```json
"down": {
  "lie": 3.5, "sinkSpeed": 0.35, "max": 8,
  "ragdoll": {
    "_note": "ENG-12. density in kg/m^3 for the part cuboids. damping slows the fall to a limp, heavy foam feel. killPush: impulse in N s added to the killed part along the dart's travel, on top of the dart's own capped push. limits: hinge range in radians about the part's local x axis, per part kind, measured from the pose it had when it went down (negative bends forward).",
    "density": 60,
    "linearDamping": 0.4,
    "angularDamping": 1.5,
    "killPush": 2.5,
    "limits": {
      "head": [-0.7, 0.7],
      "arm": [-2.4, 0.4],
      "leg": [-1.8, 0.3],
      "weapon": [-1.5, 1.5],
      "fin": [-0.5, 0.5],
      "ability": [-0.5, 0.5],
      "detail": [-0.3, 0.3]
    }
  }
}
```

Update every reader of `down.topple` (the Foamer, tests, `HANDOFF` notes
are history and stay as they are).

## Collision group (`src/physics/world.ts`)

Add `GROUP_RAGDOLL` and `RAGDOLL_GROUPS`: ragdoll colliders collide with
the static world and with other ragdoll colliders, not with the player,
darts, debris or live Foamers. `SOLID_QUERY_GROUPS` must exclude them, so
the player's character controller and the muzzle ray ignore them. Find out
how darts query for hits (`src/weapons/darts.ts`, read only) and make sure
the ragdoll group is not hit; if darts can only be kept off by a change in
`darts.ts`, make the smallest change and say so in HANDOFF.

## Going down (`foamers.ts`, `goDown` and `stepDown`)

At `goDown(f, hit?)`:

1. As today: state down, no moving or attacking, parts leave the voxel
   targets, stuck darts drop, root capsule removed, counts as gone for the
   spawner, `down.max` cap.
2. Every part still attached: switch its body to dynamic, give it the
   cuboid collider(s) from its voxel bounds (the same builder broken
   pieces use) in `RAGDOLL_GROUPS` with `density`, and set
   `linearDamping` and `angularDamping`. Keep the trimesh dropped
   (`dropColliders`).
3. Start each body with the velocity it had on its last step (its pose
   change over the step divided by dt, linear and angular), so a walking
   Foamer falls forward with its stride instead of stopping dead.
4. For every attached part with a parent, a **revolute joint** at the
   rig joint: anchor on the parent at `at`, anchor on the child at
   `pivot`, both in the bodies' local frames (use the same joint maths as
   `solvePose`). Axis: the child's local x axis (the axis the rig's walk
   swings about). `setLimits` from `limits[kind]`, measured from the angle
   the joint had at the moment it went down. Disable contacts between the
   two bodies of each joint (`setContactsEnabled(false)`).
5. The kill push: if `goDown` came from a dart hit, apply `killPush`
   along the dart's travel direction at the hit point to the part that
   was hit (`applyImpulseAtPoint`). A down from losing the head and an
   arm has no hit: no push.

In `stepDown`:

- While lying: nothing moves the bodies but physics. Render the parts
  interpolated between the last two steps, as broken pieces do.
- After `down.lie` seconds: as broken pieces do when they sink, remove the
  joints, make every body kinematic with colliders disabled, and move it
  down at `sinkSpeed` until its top is below the floor, then dispose. The
  `down.max` cap still sinks the oldest at once.

Delete `downMotion` from `rig-states.ts` if nothing else uses it.

## Tests (`tests/foamers/ragdoll.test.ts`)

Use the fake mesher and `settleAll` as `parts.test.ts` does. Kill with a
standard dart (they down, never pop).

1. Going down: every attached part's body is dynamic, there is one joint
   per attached part with a parent, the root capsule is gone, no part is
   a voxel target.
2. Limp: 3 s after a kill, the body part's centre is below 0.6 m and no
   part's lowest point is below the floor by more than 0.05 m.
3. Direction: a kill shot travelling -z (from the front) moves the body
   part's centre toward -z after 2 s; one travelling +x moves it toward
   +x. Same Foamer pose both times.
4. Not canned: two Foamers killed by shots from different directions end
   with body orientations at least 30 degrees apart.
5. Joints hold: 3 s after a kill, every child's pivot point is within
   0.05 m of its parent's joint point.
6. Limits: through 3 s after a kill, every hinge angle stays within its
   limits plus 0.1 rad.
7. Pass through: a ray in `SOLID_QUERY_GROUPS` through a lying ragdoll
   hits nothing of it, and a dart fired through it does not count a hit.
8. Sinking and caps: after `lie`, no joints, colliders disabled, the
   parts sink below the floor and are disposed; with `down.max + 2`
   downed, the oldest two are already sinking (update ENG-10 test 15 if
   it reads the old topple).
9. Broken first: a Foamer that lost `legL` and then dies ragdolls with
   the parts it has left (no joint to the missing leg, no crash).
10. Settles: 5 s after a kill, every part's speed is under 0.05 m/s and
    no position is NaN.

Old tests that read `down.topple` or the topple pose change to match;
say which in HANDOFF.

## Done when

- [ ] `npm test` passes (old tests updated as described, 10 new).
- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files)`).
- [ ] A dated `HANDOFF.md` log entry (`date +%F`): what was built,
      decisions and why, which old tests changed, what is unverified. Do
      not delete or rewrite other entries or headings. Set the ENG-12 row
      in `PLAN.md` to "Pi (review)".
- [ ] Committed on `eng-12`, message starting `ENG-12:` and ending with
      `Co-Authored-By: Qwen3.8-27B via Pi <noreply@local>`. **Do not merge
      and do not push.**

Skip the browser check: the reviewer tunes the ragdoll on the range and
runs the Benchmark with 8 downed Foamers.

## Known limits (do not fix in this task)

- Hinges only: Rapier's JavaScript API cannot limit ball joints, so a
  part only swings about its own x axis. The body itself rolls freely.
- Only F01 is in the game; other rigs get the same ragdoll with GAME-10.
- No foam fizz while sinking (the sandbox's `Burst` moves into the game
  later) and no sounds.
- Popping is unchanged (no starter dart pops; `catastrophic.popTypes`).

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API of existing modules beyond what
this card lists.
