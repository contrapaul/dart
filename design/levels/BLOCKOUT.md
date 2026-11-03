# Blockout format proposal

Status: **proposal only, LVL-00, 2026-11-03**. No loader code exists and
none is written by this task. This is the shape a level file would take so
a model can build and edit an Act 1 concept as text, and so LVL-01 (one
arena blockout with destructible cover and a lock-in) has a target.

PLAN.md 9 says "code-authored blockout levels (JSON of boxes, arenas,
spawn points)". This file adds the parts the concepts in this folder
need: destructible volumes, waves, rifts, pickups, secrets, stations.

## 1. Rules the format follows

- **Metres, Y up, right handed.** Positions are the centre of a box;
  sizes are full extents, not half. Rotations are degrees about Y only
  (blockout geometry is axis aligned; a ramp is a box with `rot` or a
  `shape: "ramp"`).
- **Everything the player walks on is a shell box,** never a voxel
  chunk. Voxels are props, cover, plugs and secrets only (README pillar
  10, KIT 5).
- **A voxel volume is at most 3.2 m on a side** (32 x 0.1 m). Bigger
  destructible shapes are several volumes in a `piece`.
- **IDs are strings and are stable.** Waves, doors and triggers refer to
  them. Names are lowercase with dashes.
- **Everything is optional except `meta`, `shell`, `playerStart` and
  `exit`.** A file with only those loads as a walkable box.
- **No coordinates are authored by hand where a rule can place them.**
  Rifts, waves and pickups are points, not volumes.

## 2. Shape

```json
{
  "meta": {
    "id": "1-1",
    "name": "[Paul]",
    "act": 1,
    "targetSeconds": 1020,
    "accent": "#[Paul]",
    "setting": "[Paul]"
  },

  "shell": [
    { "id": "floor-yard", "shape": "box", "pos": [0, 0, 0],
      "size": [20, 1, 16], "material": "greybox" }
  ],

  "pieces": [
    { "id": "pit-block", "kind": "cover",
      "volumes": [
        { "pos": [-3, 0, 12], "size": [3.2, 3.2, 3.2],
          "material": "foam-orange" }
      ],
      "anchor": "floor"
    }
  ],

  "arenas": [
    {
      "id": "pit",
      "archetype": "A1",
      "trigger": { "pos": [0, 0, 10], "size": [30, 6, 4] },
      "doors": [
        { "id": "pit-in", "pos": [0, 0, 6], "size": [3, 3.5, 0.4],
          "state": "open" },
        { "id": "pit-out", "pos": [0, 0, 40], "size": [3, 3.5, 0.4],
          "state": "locked" }
      ],
      "rifts": [
        { "id": "pit-r1", "pos": [0, 2, 30], "facing": [0, 0, -1] }
      ],
      "waves": [
        { "id": "pit-w1", "rifts": ["pit-r1"],
          "spawns": [ { "foamer": "F01", "count": 3 } ],
          "delaySeconds": 0 }
      ],
      "unlockOnClear": ["pit-out"],
      "checkpoint": true
    }
  ],

  "pickups": [
    { "id": "pit-ammo", "type": "darts-standard", "count": 4,
      "pos": [12, 0.4, 8] }
  ],

  "stations": [
    { "id": "u1", "pos": [0, 0, 52], "facing": [0, 0, -1] }
  ],

  "secrets": [
    { "id": "s1", "type": "broken-wall",
      "piece": "explore-1-wall",
      "reward": { "type": "darts-standard", "count": 20 },
      "hint": "crack-decal" }
  ],

  "playerStart": { "pos": [0, 0.9, -6], "yaw": 0 },
  "exit": { "pos": [0, 0, 120], "size": [3, 3.5, 0.4] }
}
```

## 3. Field reference

### meta

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Level ID, matches the file name (`1-1`) |
| `name` | string | [Paul]. Shown in level select |
| `act` | number | 1 to 3 |
| `targetSeconds` | number | The beat budget, so a tool can flag an over-long level |
| `accent` | string | The act's "this way on" colour (README 4.2). [Paul] |
| `setting` | string | [Paul]. Free text, not used by the loader |

### shell boxes

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique |
| `shape` | `"box"` or `"ramp"` | Ramp is a box whose top face rises along `size` axis with `rise` |
| `pos` | [x, y, z] | Centre, metres |
| `size` | [x, y, z] | Full extents, metres |
| `material` | string | Key in `data/materials.json`. Shell boxes are non-destructible regardless |
| `rotY` | number | Optional, degrees |
| `rise` | number | Ramps only, metres of rise across the box |

### pieces (destructible)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique. Waves and secrets refer to pieces by ID |
| `kind` | `"cover"`, `"plug"`, `"blast-wall"`, `"island"`, `"growth"`, `"ceiling"` | Drives defaults and the tool's budget check |
| `volumes` | array | Each `{pos, size, material}`. Each volume is at most 3.2 m per axis. A piece of 4 volumes counts as 4 zones against the 6-per-arena budget |
| `anchor` | `"floor"`, `"wall"`, `"ceiling"` | What the piece hangs from. Anything with no path of voxels to an anchored neighbour may fall on first carve (destruction islands) |
| `hidden` | boolean | Optional. Starts with no mesh until a trigger (`secret`, `ambush`) |

### arenas

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique |
| `archetype` | `"A1"` to `"A8"` | KIT.md code, for the tool and for humans |
| `trigger` | box | Player inside it starts the lock |
| `doors` | array | `{id, pos, size, state}` where state is `"open"`, `"locked"` or `"sealed"` (sealed never opens) |
| `rifts` | array | `{id, pos, facing}`, where `facing` is the outward normal of the seam |
| `waves` | array | See below |
| `unlockOnClear` | string[] | Door IDs to open when the last wave's last Foamer is down |
| `checkpoint` | boolean | Whether dying here restarts at the trigger, not the level start |

### waves

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique within the level |
| `rifts` | string[] | Which rifts this wave uses |
| `spawns` | array | `{foamer: "F01", count: 3, promoted: false}`. `foamer` is a CONTENT-PLAN 3 ID, so the loader reads health and behaviour from `data/foamers.json` |
| `delaySeconds` | number | After the previous wave clears, or after lock for wave 1 |
| `holdSeconds` | number | Optional. Stagger between spawns inside the wave, so a pack arrives in a stream and not a clump (LEVEL-1-3 7) |

The sum of `count` across one arena must stay under the KIT 6 budget:
12 alive at Normal, and the tool should warn at 16.

### pickups, stations, secrets

| Field | Type | Meaning |
|---|---|---|
| `pickups[].type` | string | `"darts-standard"`, `"shells-b03"`, `"darts-precision"`, `"mega"`, `"foam-balls"`, `"health"`, `"armor"`, `"token"`, `"toy"` |
| `pickups[].count` | number | Units, per the blaster's data |
| `stations[].facing` | [x, y, z] | Which way the player faces when using it. The station is the checkpoint marker |
| `secrets[].type` | string | `"broken-wall"`, `"ledge"`, `"drop"`, `"vent"`, `"growth"`, `"sprint-gap"` (KIT 4) |
| `secrets[].piece` | string | For destructible secrets, the piece that hides it |
| `secrets[].hint` | string | `"crack-decal"`, `"uplight"`, `"particles"`, `"sound"`, `"growth-colour"`, `"pickup-visible"` |
| `secrets[].reward` | object | `{type, count, itemId}` |

`playerStart` and `exit` are one box each. `exit` is a door, and it is
the only one the loader treats as "level complete".

## 4. Worked example: Arena 1 of level 1-1

The pit only. 34 x 26 m, pit floor 4 m below the entry ring, two ramps,
a centre block, two waves. Coordinates are chosen so the level's origin
is the pit's centre floor; Y 0 is the pit floor.

```json
{
  "arena": {
    "id": "pit",
    "archetype": "A1",
    "trigger": { "pos": [0, 0, -6], "size": [30, 8, 4] },
    "doors": [
      { "id": "pit-in",  "pos": [0, 0, -12], "size": [3, 3.5, 0.4],
        "state": "open" },
      { "id": "pit-out", "pos": [-14, 0, 10], "size": [3, 3.5, 0.4],
        "state": "locked" },
      { "id": "pit-shutter-w", "pos": [-16, 0, 0], "size": [0.4, 3.5, 20],
        "state": "open" },
      { "id": "pit-shutter-e", "pos": [ 16, 0, 0], "size": [0.4, 3.5, 20],
        "state": "open" }
    ],
    "rifts": [
      { "id": "pit-r1", "pos": [-8, 1.5, 12], "facing": [0, 0, -1] },
      { "id": "pit-r2", "pos": [ 8, 1.5, 12], "facing": [0, 0, -1] },
      { "id": "pit-r3", "pos": [ 0, 0.2, -4], "facing": [0, 1, 0] }
    ],
    "waves": [
      { "id": "pit-w1", "rifts": ["pit-r1", "pit-r2"],
        "spawns": [ { "foamer": "F01", "count": 3 } ],
        "delaySeconds": 0, "holdSeconds": 1.5 },
      { "id": "pit-w2", "rifts": ["pit-r1", "pit-r2", "pit-r3"],
        "spawns": [ { "foamer": "F01", "count": 5 } ],
        "delaySeconds": 6, "holdSeconds": 1.2 }
    ],
    "unlockOnClear": ["pit-out", "pit-shutter-w", "pit-shutter-e"],
    "checkpoint": true
  },

  "shell": [
    { "id": "pit-floor", "shape": "box", "pos": [0, -0.5, 0],
      "size": [32, 1, 26], "material": "greybox" },
    { "id": "pit-wall-n", "shape": "box", "pos": [0, 6, 13],
      "size": [34, 12, 1], "material": "greybox" },
    { "id": "pit-wall-s", "shape": "box", "pos": [0, 6, -13],
      "size": [34, 12, 1], "material": "greybox" },
    { "id": "pit-wall-w", "shape": "box", "pos": [-17, 6, 0],
      "size": [1, 12, 26], "material": "greybox" },
    { "id": "pit-wall-e", "shape": "box", "pos": [ 17, 6, 0],
      "size": [1, 12, 26], "material": "greybox" },
    { "id": "pit-ring-s", "shape": "box", "pos": [0, 4, -11],
      "size": [34, 4, 4], "material": "greybox-dark" },
    { "id": "pit-ramp-w", "shape": "ramp", "pos": [-13, 2, 9],
      "size": [6, 4, 8], "rise": 4, "material": "greybox-dark" },
    { "id": "pit-ramp-e", "shape": "ramp", "pos": [ 13, 2, 9],
      "size": [6, 4, 8], "rise": 4, "material": "greybox-dark" }
  ],

  "pieces": [
    { "id": "pit-block", "kind": "cover", "anchor": "floor",
      "volumes": [
        { "pos": [-3, 1.6, 4], "size": [3.2, 3.2, 3.2],
          "material": "foam-orange" },
        { "pos": [ 0, 1.6, 4], "size": [3.2, 3.2, 3.2],
          "material": "foam-orange" },
        { "pos": [ 3, 1.6, 4], "size": [3.2, 3.2, 3.2],
          "material": "foam-orange" }
      ] },
    { "id": "pit-pillar-w", "kind": "cover", "anchor": "floor",
      "volumes": [
        { "pos": [-9, 1.4, 0], "size": [1.6, 2.8, 1.6],
          "material": "foam-orange" }
      ] },
    { "id": "pit-pillar-e", "kind": "cover", "anchor": "floor",
      "volumes": [
        { "pos": [ 9, 1.4, 0], "size": [1.6, 2.8, 1.6],
          "material": "foam-orange" }
      ] }
  ],

  "pickups": [
    { "id": "pit-ammo", "type": "darts-standard", "count": 4,
      "pos": [12, 0.4, -10] }
  ]
}
```

What this example demonstrates:

- **The 3.2 m cap.** The 6 x 4 x 3.5 m centre block is three volumes,
  not one, so each fits a 32 x 32 x 32 chunk. It is also 3 zones of the
  arena's 6.
- **Ramps are shell.** A ramp is walkable ground on the critical path,
  so it is never voxel (README pillar 10).
- **Shutters close with the door.** The pit's side shutters are locked
  with the entry door, so the player cannot retreat onto the ring and
  shoot down. That is the level's design intent (LEVEL-1-1 4) written as
  data.
- **The floor rift faces up.** `"facing": [0, 1, 0]` means a seam in the
  floor, so wave 2 has one spawn behind the player.
- **Wave 1 has 3 Foamers, wave 2 has 5.** Both are under the 12-alive
  budget. `holdSeconds` keeps them from arriving as a clump.

## 5. What the tool must check (for whoever builds the loader)

Not code, just the list of rules a validator would enforce, so the format
stays honest:

1. Every voxel volume is 3.2 m or less on every axis.
2. Every piece has a path of adjacent volumes to an `anchor`.
3. Every arena has at most 6 voxel volumes (KIT 6); warn at 5.
4. Every arena's waves total at most 12 alive at Normal, 16 at Foam Fury.
5. Every rift ID used by a wave is defined in the same arena.
6. Every door ID in `unlockOnClear` is defined in the same arena.
7. Every secret not of type `broken-wall`/`growth` has a `hint`.
8. Every ammo pickup is within 30 m of a gauntlet's trigger or placed
   beside a new blaster (D08). Warn, do not fail.
9. `playerStart`, `exit` and every door are inside the shell, not inside
   geometry.
10. No shell box is inside another shell box by more than 0.1 m.
11. Every material name exists in `data/materials.json`.
12. Every `foamer` ID exists in `data/foamers.json` with health.

The validator is LVL-01's problem, not this task's.
