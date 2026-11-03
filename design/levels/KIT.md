# DART level kit: spaces, sizes and budgets

Status: **proposal, LVL-00, 2026-11-03**. Spaces and numbers a builder
can reuse. Every size is derived from `data/player.json`,
`data/ai.json` and `data/destruction.json`; if those change, this file
changes with them.

## 1. The player ruler

| Number | Value | What it means for a level |
|---|---|---|
| Walk | 7 m/s | A 40 m arena crossing is 5.7 s |
| Sprint | 10.5 m/s | A 40 m arena crossing is 3.8 s |
| Jump | 7.5 m/s up, 22 m/s² gravity | 1.28 m high, 0.68 s of air |
| Jump distance | walk 4.8 m, sprint 7.1 m | Shelter no gap wider than 6.5 m on the critical path |
| Dash | 22 m/s for 0.16 s | 3.5 m of extra reach, 0.7 s cooldown |
| Mantle | 1.5 m | Anything above 1.5 m needs a step, a ramp or stairs |
| Step | 0.4 m | Kerbs and low crates are free to walk over |
| No crouch, no double jump | | Crawl vents are impossible. Use 2.1 m tunnels and 1.5 m ledges instead |
| Eye height | 1.6 m | Cover shorter than 1.2 m does not hide the player's view of the arena |
| Player radius | 0.35 m | Doors are 2.0 m wide minimum, 3.0 m for a fight door |

**Nav and AI ruler.** Nav cells are 0.25 m, agents need 0.35 m radius and
1.6 m height, and max step between cells is 0.45 m. A floor more than 8 m
below the bake sample is not found, so keep each arena's floor-to-highest
floor under 8 m. Foamers see 20 m, alert others within 8 m, and hold at
2.2 m. An arena wider than 40 m means half the wave is out of sight at
kick-off.

## 2. Arena archetypes

Eight archetypes. Each ready-made as a blockout. Sizes are the footprint
at floor level; height is floor to ceiling.

### A1 Pit (sunken arena)

```text
       N
  +-------------+     one char = 2 m
  |.............|     34 x 26 m, 6 m deep
  |..R.......R..|     floor -4 m
  |.............|     ring ledge +0 m, 4 m wide
  |..[=====]....|     enters from S at +0, exits N at +0
  |.....##......|     # centre cover 6 x 4 m
  |..R.......R..|
  +------+------+
         S
```

34 x 26 m, ring ledge at 0 m and pit floor at -4 m, two ramps 6 m wide
at the short ends, 12 m ceiling. Good for: reading the whole fight at a
glance, teaching drops, showing a heavy before it reaches you. Bad for:
flyers (they lose the height advantage).

### A2 Ring (the donut)

```text
     +---------+    one char = 2 m
     |....R....|    30 m across, 8 m ceiling
     |..#####..|    centre block 10 x 8 m, 3.5 m tall
     |..#...#..|    ring corridor 6 m wide all round
     |..#.U.#..|    entrance and exit both on the S wall
     |..#####..|
     |....R....|
     +----+----+
          S
```

30 x 30 m with a 10 x 8 m block in the middle. The ring is 6 m wide, so
two players abreast and a charger cannot build speed. Good for: teaching
flanking, forcing the player to move round cover, shield-wall Foamers.
Bad for: waves of more than 8 (they bunch in the ring).

### A3 Tiered bowl (three steps up)

```text
    +-----------+   one char = 2 m
    |...R...R...|   36 x 30 m
    |.._________|   tier 0: y 0, 12 m deep
    |.|.........|   tier 1: y +1.2, 8 m deep
    |.|.._____..|   tier 2: y +2.4, 6 m deep
    |.|.|.....|.|   steps 1.2 m, 3 m wide, every 8 m
    |.|.|..U..|.|
    +-+-+--+--+-+
            S
```

36 x 30 m, three tiers at 0, 1.2 and 2.4 m, 9 m ceiling. Tiers are
jumpable (1.28 m jump, 1.5 m mantle) so no ramp is needed, but the
blockout includes 3 m wide stairs for Foamers (their step is 0.45 m).
Good for: teaching height as cover, giving the player an escape shelf,
ranged Foamers shooting down.

### A4 Long hall (a corridor that fights)

```text
  +---------------------+  one char = 2 m
  |R....##....##....##..|  18 x 44 m, 7 m ceiling
  |.....................|  columns 1.2 x 1.2 m, every 8 m
  |R....##....##....##.R|  staggered, alternate sides
  +----------+----------+
             S
```

18 x 44 m with six 1.2 x 1.2 x 4 m columns in two staggered rows. Good
for: charges (the Darter needs 14 m of straight line, the hall gives it),
sight lines, teaching sidestep around cover. Bad for: vertical play, so
never use it twice in one level.

### A5 Tower climb (the level goes up)

```text
     +--------+    one char = 2 m
     |  R  R  |    20 x 20 m footprint
     |  ____  |    4 floors, 5 m apart, 20 m total
     | |    | |    spiral: each floor has one 3 m gap in the slab
     | | U  | |    ledges 1.5 m make the climb, no jump needed
     | |____| |
     |  R  R  |
     +---+----+
         S
```

20 x 20 m per floor, floors at 0, 5, 10 and 15 m, 4 m headroom, one 3 m
stair or ledge chain per floor. Good for: set pieces, flyers, a boss
that follows you up. Bad for: waves (keep it to 4 to 6 Foamers, they
queue on the climb).

### A6 Open yard with islands

```text
  +-----------------+   one char = 2 m
  |..[##]....[##]...|   44 x 36 m, 9 m ceiling
  |....R........R...|   6 islands, 4 to 6 m across
  |..[##]..[][]..[##]|  islands are 2.5 m tall, destructible
  |.......[][].R....|  gaps 5 to 6.5 m, all sprint jumpable
  |..[##]....[##]...|
  +--------+--------+
           S
```

44 x 36 m with six destructible islands. The widest space in the kit.
Good for: the gauntlet, showing off destruction, ranged and melee mixed.
Bad for: anything that needs focus, so the wave list must stay under 12.

### A7 Crossroads (hub with spokes)

```text
        +--+  +--+
        |  |  |  |
   +----+  +--+  +----+   one char = 2 m
   |   .......  ....  |   32 x 32 m hub, 4 spokes 8 m wide
   |   ...R...   .R.  |   hub has one 8 m pillar
   |   .......  ....  |
   +----+  +--+  +----+
        |  |  |  |
        +--+  +--+
```

32 x 32 m hub with four 8 m wide spokes. Used once per act, for a level
that turns. Good for: a lock-in the player can enter from any side, a
boss that circles.

### A8 Bridge and drop (the point of no return)

```text
  +------+     +------+   one char = 2 m
  | back |=====| far  |   bridge 4 m wide, 24 m long
  | yard |     | yard |   no rails, drop 9 m to a lower ring
  +------+     +------+
      \___________/       lower ring is the way on, 8 m wide
```

Two 16 x 16 m yards joined by a 4 x 24 m bridge, 9 m above a ring that
carries the critical path. Good for: a set piece, a charger that can
knock you off, a one-way drop into the next arena. Bad for: 10+ players
who panic on narrow geometry, so make the bridge 4 m and the ring wide.

### Which archetype teaches what

| Archetype | Teaches | Tests |
|---|---|---|
| A1 Pit | Drops, reading a whole fight | Heavy Foamers, weak points |
| A2 Ring | Flanking, cover discipline | Shield walls, chargers |
| A3 Bowl | Height as cover, retreating | Ranged pressure, flyers |
| A4 Hall | Lanes, sidestep | Chargers, sustained fire |
| A5 Tower | Vertical routing | Flyers, bosses |
| A6 Yard | Destruction, target choice | Gauntlets, mixed waves |
| A7 Crossroads | Orientation | Ambushes from two sides |
| A8 Bridge | Commitment, knockback | Chargers, mini-bosses |

## 3. Connectors

Joins between spaces. Keep them short: a connector is 5 to 20 m.

| Connector | Size | Use | Note |
|---|---|---|---|
| Corridor | 4 m wide, 4.5 m tall, 8 to 20 m long | The default join | Put a bend every 12 m so it is never a shooting gallery |
| Wide corridor | 8 m wide, 6 m tall | Wave staging, a breather with a sight line | Reads as a room, keeps momentum |
| Ledge climb | 1.5 m steps, 1.2 m deep | Vertical route for the player only | Foamers need the stairs next to it, or they cannot follow and the fight stalls |
| Drop shaft | 3 to 4 m across, 5 to 9 m down | A one-way route, blocks the way back | Light the bottom. A drop over 9 m is not survivable, so cap it |
| Vent tunnel | 2.1 m tall, 2 m wide, 10 to 15 m | Secret route, or a way for a small Foamer | No crouch in the kit, so this is a walk-through tunnel, not a crawl |
| Blast wall | 4 x 4 x 0.6 m | Shortcut to a secret or an earlier arena | Voxel chunk, not shell. Two hits of B01 slug or one B03 blast |
| Foam plug | 3 x 3 x 1 m of frozen foam growth | Blocks the critical path until destroyed | The only destructible allowed to gate the spine |
| Lift | 3 x 3 m, 4 to 8 m of travel | Reads as a goal from 30 m | The best wayfinding prop in the kit |
| Door | 3 m wide, 3.5 m tall | Arena entry and exit | Lock = two panels sliding shut, 0.4 s, with a colour pulse |

## 4. Secret types

Only six, so a player learns to recognise them.

1. **The broken wall.** A wall that is a different material or shade from
   its neighbours, in a room where the path turns away. Hint: a dart sound
   when hit, and a crack decal.
2. **The ledge you can just reach.** A 1.5 m lip with a lit top, above
   eye height on a side wall. Hint: an uplight, and a pickup visible on it.
3. **The drop behind the fight.** A hole in the floor of a breather room,
   2.5 m across, with a light at the bottom. Hint: a scrape of foam on the
   rim.
4. **The vent.** A 2.1 m tunnel behind a destructible panel, off the spine
   at a corner. Hint: air movement particles, a sound.
5. **The foam growth you clear.** A growth on a dead-end wall that hides
   an alcove. Hint: a different growth colour, and a token glow through
   the gaps.
6. **The jump you only make while sprinting.** A 6.5 m gap with a 1 m
   higher far side, in an arena's outer ring. Hint: an ammo box visible
   across the gap.

A secret is worth 15 to 45 seconds and contains one of: an upgrade token
(2 to 3 per level, per D6), a big ammo cache, a collectible toy (5.4 in
CONTENT-PLAN), or a shortcut back to the spine.

## 5. Destructible pieces

Budgets first, because they set the sizes. From `data/destruction.json`
and `PLAN.md` 7.3: a destructible zone is a 32 x 32 x 32 chunk of 0.1 m
voxels, so a zone is **3.2 x 3.2 x 3.2 m** and no single voxel volume may
be bigger. Live debris is capped at 150 pieces, 14 per carve, 3 voxels
per piece, 4 s life. Break-off islands cap at 16 pieces and 6000 searched
voxels. So: **a level gets 8 to 14 destructible zones**, they are all
3.2 m cubes or smaller, and no more than 6 of them may be adjacent in one
arena (a wall of 6 cubes loses 16 islands and the frame budget at once).

| Piece | Voxel volume | Material | Carves in | Purpose |
|---|---|---|---|---|
| Cover pillar | 1.6 x 1.6 x 2.8 m | foam-orange, hardness 1 | 2 to 3 B01 shots | Wears down during a fight, opens sight lines |
| Low crate stack | 2.4 x 1.6 x 1.2 m | cardboard 0.7 over wood 2.5 | 1 shot | Free step (1.2 m is below the 1.5 m mantle), quick cover |
| Blast wall | 3.2 x 3.2 x 0.5 m | plastic 1.5 | 4 B01 slugs, or 1 B03 blast | Secret or shortcut. Never on the spine |
| Foam growth plug | 3.2 x 3.2 x 1.0 m | foam-lime-deep, hardness 1 | 3 to 5 shots, or one melee | Gates the critical path. Visibly soft and lumpy |
| Foam growth (secret) | 2.0 x 2.0 x 0.8 m | foam-lime-light | 2 shots | Hides an alcove, glows faintly |
| Floor island | 3.2 x 0.4 x 3.2 m | wood 2.5 | 6 shots | Drops out under a heavy Foamer, opens a hole |
| Ceiling plug | 3.2 x 0.6 x 3.2 m | cardboard | 1 shot | Drops foam on a fight, or opens a skylight |
| Barrier of stacked toys | 3.2 x 3.2 x 1.6 m | foam-white | 3 shots | Cover that reads as scenery, per setting |

Rule: **every material on a destructible piece is in
`data/materials.json`.** Bedrock (255) is the shell anchor; a chunk with no
bedrock in it is a free-floating island and will fall the first time it is
touched.

## 6. Arena budgets

| Budget | Limit | Why |
|---|---|---|
| Arena footprint | 44 x 36 m max | Nav grid cell count, and the 20 m sight range |
| Arena floor to highest floor | under 8 m | Nav bake samples 8 m down |
| Destructible zones per arena | 6 | Debris and island caps |
| Foamers alive at once | 12 (Normal), 16 (Foam Fury) | `maxAgents` 64 shared with debris-heavy scenes; 2 melee tokens at Normal means more than 12 is a queue |
| Wave size | 6 to 10 | 25 to 40 s per wave at 2 tokens |
| Waves per arena | 2 to 3 | 2 min per arena |
| Rifts per arena | 2 to 4 | Two directions is a fight, four is a blender |
| Pickups on the floor | 8 | Readability, and the HUD ammo bar is the truth |
| Lock-in trigger | 6 to 10 m inside | Player must be in the room |
