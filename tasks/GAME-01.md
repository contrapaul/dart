# GAME-01: Dart projectile system

```
ID:          GAME-01
Title:       Visible dart projectiles: flight, arc, hits, sticking, pooling
Owner:       Pi (Qwen 3.8-27b)
Reviewer:    Claude Opus 5.5
Depends on:  ENG-01, ENG-02 (both done)
Branch:      game-01, in its own worktree (see "Setup")
```

## Read first

1. `CLAUDE.md` (rules for this repo; every rule applies to you)
2. `PLAN.md` section 3.3 (darts as a mechanic) and section 7.3 (budgets)
3. `HANDOFF.md` (current state)
4. `src/main.ts`, `src/player/controller.ts`, `src/core/input.ts`,
   `src/physics/world.ts` (the code you will connect to)

## Goal

When the player presses fire, a foam dart leaves the camera, flies fast but
visibly with a slight downward arc, and hits things. Darts either stick
(suction darts) or bounce and drop (standard darts). Other systems will later
use the hit events to carve voxels and damage Foamers, so hits must be
reported, but this task applies no damage.

## Setup

Another agent is working on the voxel mesher in the main checkout at the same
time. Work in a separate git worktree so you never touch its files:

```bash
cd /Users/paul/Documents/GitHub/dart
git worktree add ../dart-game-01 -b game-01
cd ../dart-game-01
npm install
```

Run the dev server with `npm run dev -- --port 5174` so it does not clash with
port 5173.

## Files

You own these (create them):

| File | Purpose |
|---|---|
| `src/weapons/darts.ts` | `DartSystem` class: pool, flight, collision, sticking, rendering |
| `src/weapons/dart-model.ts` | Builds the dart geometry in code (no model files) |
| `data/darts.json` | Dart type definitions and caps (see below) |
| `tests/weapons/darts.test.ts` | Vitest tests (see "Tests") |

You may make these small changes and nothing else:

| File | Allowed change |
|---|---|
| `src/player/controller.ts` | Add one public read-only getter `get collider()` returning the private `collider`. No other change. |
| `src/main.ts` | Create the `DartSystem` after the player; call its `update(dt)` inside the `update` hook before `world.step()` and `syncRender()` inside `render`; replace the body of the `if (input.wasPressed("fire"))` block so it fires a dart; add a key to switch dart type (see below). Keep the foam block spawning code, but trigger block throwing with the `use` action (E) instead of fire. Do not edit anything else in this file. |
| `HANDOFF.md` | Add your log entry at the top of the log (see "When done") |

Do **not** edit anything in `src/core/`, `src/render/`, `src/voxel/`,
`src/physics/`, `data/input.json`, `data/player.json`, `PLAN.md` or `CLAUDE.md`.

## Data: `data/darts.json`

```json
{
  "_note": "Placeholder dart types until Paul's blaster cards exist.",
  "maxLive": 150,
  "maxStuck": 100,
  "maxResting": 60,
  "lifetime": 8,
  "types": {
    "standard": {
      "speed": 38,
      "gravityScale": 0.35,
      "drag": 0.4,
      "length": 0.16,
      "radius": 0.018,
      "bodyColor": "#2ec4ff",
      "tipColor": "#ff7a1a",
      "sticks": false,
      "restitution": 0.35,
      "impulse": 0.6
    },
    "suction": {
      "speed": 34,
      "gravityScale": 0.4,
      "drag": 0.45,
      "length": 0.16,
      "radius": 0.018,
      "bodyColor": "#ffd23f",
      "tipColor": "#ff4fa3",
      "sticks": true,
      "restitution": 0,
      "impulse": 0.4
    }
  }
}
```

Units: metres, seconds. `drag` is the fraction of speed lost per second
(`v *= 1 - drag * dt`). `gravityScale` multiplies 9.81 m/s^2. `impulse` is the
impulse in newton-seconds applied to a dynamic body when a dart hits it.
Darts are drawn larger than real foam darts on purpose, so they read on screen.

## Public API (implement exactly this)

```ts
export type DartTypeName = "standard" | "suction";

export interface DartHit {
  point: THREE.Vector3;       // world position of the hit
  normal: THREE.Vector3;      // surface normal at the hit
  direction: THREE.Vector3;   // unit flight direction at impact
  speed: number;              // m/s at impact
  type: DartTypeName;
  collider: RAPIER.Collider;  // what was hit
}

export class DartSystem {
  constructor(scene: THREE.Scene, world: RAPIER.World, rapier: Rapier, ignore: RAPIER.Collider);
  /** Called once per hit. Other systems subscribe here later. */
  onHit: (hit: DartHit) => void;
  fire(origin: THREE.Vector3, direction: THREE.Vector3, type: DartTypeName): void;
  /** Fixed step. Call before world.step(). */
  update(dt: number): void;
  /** Write instance matrices. Call once per render frame. */
  syncRender(): void;
  /** For tests and debug: counts by state. */
  stats(): { flying: number; stuck: number; resting: number };
}
```

`ignore` is the player's collider, so darts never hit the player who fired them.

## Behaviour

1. **Flight.** Each fixed step: `vel.y -= 9.81 * gravityScale * dt`, then
   apply drag, then move. Do **not** use Rapier rigid bodies for flying darts
   (too costly at 150 darts).
2. **Collision.** Sweep from the old to the new position with
   `world.castRayAndGetNormal` (solid, exclude the `ignore` collider and
   sensors). A ray is enough; darts are thin. If there is a hit, the dart
   stops at the hit point and `onHit` fires exactly once for that impact.
3. **Sticking** (`sticks: true`). The dart stays at the hit point, pointing
   along its flight direction, with its tip pushed `0.3 * length` into the
   surface. If the hit collider belongs to a dynamic or kinematic rigid body,
   store the dart's position and rotation in that body's local space and
   follow the body every step. If that body or collider is removed (check
   `world.getCollider(handle)` returns null), the dart starts falling as a
   resting-state dart (rule 4).
4. **Bouncing** (`sticks: false`). Reflect velocity about the normal and scale
   by `restitution`. When speed falls below 1.5 m/s while touching the ground
   (normal.y > 0.7), the dart becomes **resting**: it lies flat on the surface
   and stops simulating.
5. **Push.** On every hit with a dynamic body, apply `impulse` along the
   flight direction at the hit point (`applyImpulseAtPoint`).
6. **Caps and pooling.** Never allocate meshes or vectors per shot or per
   step after construction. Use one `THREE.InstancedMesh` per dart type, sized
   `maxLive + maxStuck + maxResting`. When a cap is reached, recycle the oldest
   dart in that state. Darts older than `lifetime` seconds in the resting
   state shrink to zero over 0.3 s and are freed. Stuck darts stay until
   recycled.
7. **Model.** `dart-model.ts` builds one `BufferGeometry` per type from code:
   a cylinder body (`bodyColor`) and a rounded tip (`tipColor`, about 22% of
   the length, slightly wider than the body), merged into one geometry with
   vertex colours. Its long axis is +Z with the tip at +Z, origin at the
   centre. Use `MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })`.
8. **Firing in main.ts.** Fire from the camera position offset 0.2 m right
   and 0.15 m down, aimed at the point 50 m along the camera's view
   direction (so darts converge on the crosshair). Key `KeyT` toggles
   between `standard` and `suction`, with a `console.info` naming the new
   type (no on-screen display needed).
   Read `KeyT` with a plain `keydown` listener in main.ts, not through
   `data/input.json` (it is a debug key).

## Tests (`tests/weapons/darts.test.ts`)

Rapier's compat build runs in Node, so use a real world:
`await RAPIER.init()` in `beforeAll`. Three.js runs in Node too (no renderer
needed; pass a plain `new THREE.Scene()`).

1. A standard dart fired horizontally at 38 m/s drops less than 0.15 m over
   10 m of flight (no walls).
2. A dart fired at a fixed cuboid wall 5 m away calls `onHit` exactly once,
   with the hit point on the wall face (within 0.02 m) and normal facing back.
3. A suction dart fired at that wall is `stuck` afterwards and its position
   does not change over 60 more steps.
4. A suction dart that hits a dynamic box follows the box when the box is
   moved with `setTranslation`.
5. Firing `maxStuck + 10` suction darts at the wall leaves exactly
   `maxStuck` stuck darts.
6. A standard dart fired down at a floor ends up `resting`.
7. The `ignore` collider is never hit (fire from inside a capsule collider
   passed as `ignore`, at a wall; the hit must be the wall).

## Done when

- [ ] `npm test` passes, including all 7 tests above.
- [ ] `npm run build` passes (it type-checks first).
- [ ] In the browser: firing sends visible darts that arc, standard darts
      bounce and lie on the floor, suction darts stick to walls and to the
      falling foam blocks and ride along with them. `E` still throws blocks.
- [ ] Holding fire with an auto-repeat test (fire every step for 10 s)
      does not grow memory or drop below 60 fps in the dev server.
- [ ] No em dash or en dash characters anywhere you wrote, including commit
      messages: `grep -rnP '\x{2014}|\x{2013}' --exclude-dir=node_modules .`
      prints nothing.
- [ ] Nothing fetched from another host.
- [ ] A dated `HANDOFF.md` log entry: what was built, decisions you made and
      why, what is unverified.
- [ ] Committed on branch `game-01` with message starting `GAME-01:` and
      ending with your attribution line. **Do not merge into main and do
      not push.** Paul and the reviewer merge after review.

## If something is unclear

Stop and write the question at the top of your HANDOFF entry rather than
guessing. Do not change the public API above without saying so.
