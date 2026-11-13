# Level 1-4 concept

Status: **proposal, LVL-00**. Works in any setting; place names are
[Paul]. Fourth level of Act 1, the one before the act boss.

| | |
|---|---|
| New blaster | B05 Shrike, precision, bolt (level 4) |
| New Foamer | F05 Darter, 30 health, charges in a straight line, armoured front, orange back |
| New mechanic | Shield charge: lock on, dash, knock back |
| Arenas | 3, plus a bridge set piece, with a mini-boss arena as the third |
| Target time | 19 min (15 to 20) |
| Archetypes | A4 Hall, A8 Bridge, A1 Pit, A2 Ring, A6 Yard |

## 1. What it teaches, and how the space does it

- **A charge needs a line.** The Darter picks a line and commits. The
  level's first Darter is at the end of a 44 m hall, and the player has
  six columns to step behind. The hall exists so the Darter can build
  speed: it needs about 14 m to reach full charge.
- **The front is armour, the back is soft.** The Darter's orange back is
  its weak point and it is visible from behind. The first one charges
  past the player into a column and stands there for 1.5 s, winded. The
  space does the teaching: a charge that misses leaves the back turned.
- **Shield charge answers a charge.** The player can lock on with the
  shield and dash 3.5 m into a Darter, which knocks it back and cancels
  the charge. Arena 2 is a bridge 4 m wide, so there is no room to
  sidestep, and the charge is the only answer. Learned by necessity.
- **B03 is a close-range answer to a heavy.** The Darter has 30 health
  and B03 puts many darts into a small cone at 4 m. The mini-boss arena
  has two Darters and no high ground, so the player has to choose when
  to be close.

## 2. Beat by beat

| # | Beat | Space | Minutes | What the player does |
|---|---|---|---|---|
| 1 | Open | 20 x 14 m forecourt | 1.0 | B03 on a stand (A1, 24 shells). Four static foam dummies at 4, 6, 10 and 15 m to feel the spread |
| 2 | Explore 1 | 14 m corridor, a 16 x 12 m room | 2.0 | First Darter at 30 m in a room with two 1.6 m cover pillars. Player learns sidestep, then back. S1 broken wall |
| 3 | Arena 1 | A4 Hall, 18 x 44 m | 2.0 | 1 Darter and 4 Swarmer, then 2 Darter and 4 Roamer. Columns are the lesson |
| 4 | Breather | 8 x 8 m, mid-hall alcove | 1.0 | Station U1, ammo A2 |
| 5 | Set piece | A8 Bridge and drop | 2.0 | 4 m wide, 24 m long, 9 m above a ring. A Darter charges the length of it. Shield charge is the only answer, or jump the last 1.5 m |
| 6 | Arena 2 | A1 Pit, 34 x 26 m | 2.5 | 2 Darter and 6 Swarmer, then 3 Darter and 6 Roamer. Pit has ramps, so a charge that misses runs up a ramp and stalls |
| 7 | Breather 2 | 10 x 8 m, above the pit | 1.0 | Station U2, ammo A3, S3 ledge |
| 8 | Mini-boss arena | A2 Ring, 30 x 30 m | 3.5 | Two Darters at once, promoted (deep purple with lime plate), plus adds. The act's first real skill check |
| 9 | Gauntlet | A6 Yard, 44 x 36 m | 4.0 | 2 Darter and 8 Swarmer, then 3 Darter and 6 Roamer and 4 Swarmer. Ammo at both ends |
| 10 | Exit | Lift, 3 x 3 m | 0.5 | Visible from the yard's centre, 30 m away |

Total: **19 min**.

## 3. Map (about 1 character = 4 m)

```text
               N
   +---------------------------+
   | EXIT lift ^               |
   | GAUNTLET (A6 44x36)       |
   |  [##]   R      [##]   R   |
   |     [##]  [][]  [##]      |
   |  A7                    A6 |
   +-------------+-------------+
                 | U2 / A3
   +-------------+-------------+
   | MINI-BOSS RING (A2 30x30) |
   |   R     +------+      R   |
   |         | blok |          |
   |   R     +------+      R   |
   +-------------+-------------+
                 | S3, climb 6 m
   +-------------+-------------+
   | PIT (A1 34x26)            |
   |  R    [####]         R    |
   |     ^ ramps at both ends  |
   +-------------+-------------+
                 | U1 / A2
   +-------------+-------------+
   | BRIDGE (A8)               |
   |  yard ====== 24 m ======  |
   |         9 m drop ring     |
   |   S2 blast wall -> ring   |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | ARENA 1: HALL (A4 18x44)  |
   | ##  ##  ##  ##  ##  ##    |
   | R                        R|
   +-------------+-------------+
                 |
   +-------------+-------------+
   | EXPLORE 1: 14 m + room    |
   |   S1 broken wall          |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | OPEN: forecourt. B03 + A1 |
   | START                     |
   +---------------------------+
```

Breather after the hall (U1, A2) is the mid-hall alcove, drawn as the
`U1 / A2` note between the hall and the bridge.

## 4. Arenas

### Arena 1: Long hall (A4)

- **Footprint:** 18 x 44 m, six 1.2 x 1.2 x 4 m columns, staggered, 8 m
  apart, 7 m ceiling.
- **Lock:** trigger at the fourth column, 18 m in. The player is 18 m
  from the door and 26 m from the far wall: a long room, and the longest
  run-in for a charge in the act.
- **Waves:**
  1. 1 Darter from the north wall rift, 4 Swarmer from the floor at 30 m.
  2. 2 Darter (north and east rifts) and 4 Roamer (west wall). 55 s.
- **Destructibles:** three columns voxel (plastic 1.5, 1 zone each),
  three shell. A player who carves the columns while a Darter is
  charging gets a clear lane and a longer charge, so carving has a cost.
- **Why it works:** the Darter's charge line is along the hall, and the
  player's sidestep is behind a column. The columns are 1.2 m wide, so a
  missed sidestep clips the player: 30 damage on Normal. That is enough
  to teach, not enough to kill.
- **Ammo:** A2 at column 3, 8 shells.

### Set piece: Bridge and drop (A8)

- **Footprint:** two 16 x 16 m yards, a 4 x 24 m bridge, 9 m above a
  lower ring that is 8 m wide.
- **Fight:** 1 Darter in the far yard, one in the near yard. The bridge
  is the only connection, 4 m wide, so a sidestep leaves 1.5 m: not
  enough. The answers are shield charge (3.5 m, cancels it) or a jump
  off the bridge at the last second onto the ring (1.5 m drop onto the
  yard's lower ledge, then a 9 m drop to the ring, which the player
  survives, per the drop rule).
- **No lock.** Falling to the ring is the way on, so the bridge fight is
  a choice: fight across, or skip it and take the drop. Skipping costs
  the ammo cache on the far side.
- **Destructibles:** two 3.2 x 3.2 x 0.5 m plastic blast walls in the
  near yard, one hiding the way down to the ring, one hiding an ammo
  cache (S2).
- **Why it works:** it is the first time the level asks "can you cross
  this", and the answer is a skill the player just learned in Arena 1.

### Arena 2: Pit (A1)

- **Footprint:** 34 x 26 m, 4 m deep, two 6 m ramps, 12 m ceiling.
- **Lock:** trigger on the pit floor, 8 m in.
- **Waves:**
  1. 2 Darter (north-east, north-west rifts) and 6 Swarmer (floor).
  2. 3 Darter and 6 Roamer. 75 s.
- **Destructibles:** centre block 3 zones, two ring pillars 1 zone each,
  and one 3.2 x 0.4 x 3.2 m floor island on the west ramp's top, which
  drops a Darter's charge line into a hole. That is the level's best
  joke: a Darter charges, the floor goes, it falls 4 m.
- **Why it works:** a charge that runs up a ramp stalls at the top, so
  the pit's ramps are Darter traps. The player will find this by running
  up a ramp while being charged.
- **Ammo:** A3 on the ring, 8 shells.

### Mini-boss arena: Ring (A2)

- **Footprint:** 30 x 30 m, 10 x 8 m centre block 3.5 m tall, ring 6 m,
  8 m ceiling. All four shutters.
- **Fight:** two **promoted** Darters (deep purple body, lime plate,
  per D5, 45 health each) plus adds. Waves:
  1. 2 promoted Darter, opposite rifts.
  2. At 50% of the pair's total health, 6 Swarmer from two floor rifts.
  No third wave. This is a skill check, not a gauntlet.
- **Why two at once:** one Darter teaches sidestep; two teach positioning
  and the shield charge, because there is no line that dodges both. The
  player must charge one, then deal with the other. The ring's 6 m width
  means the two cannot both charge at once from the same side, so the
  fight is fair.
- **Destructibles:** four 1.6 x 1.6 x 2.8 m pillars in the ring, 1 zone
  each. Removing them makes the ring a clean loop, which helps the
  charges and hurts the player's cover. Either way is a real choice.
- **Ammo:** A4 in the ring, 10 shells, and A5 on the block, 6 shells.
- **Exit:** a 6 m climb back to the pit's ring ledge, lit, 1.5 m ledges.

### Gauntlet: Yard with islands (A6)

- **Footprint:** 44 x 36 m, 9 m ceiling, six islands.
- **Waves:**
  1. 2 Darter (short ends) and 8 Swarmer (floor rifts).
  2. 3 Darter and 6 Roamer and 4 Swarmer. 90 s.
- **Destructibles:** six islands, 1 to 2 zones each.
- **Why it works:** 44 m is enough for three simultaneous charge lines
  from three directions, and the islands are the only thing that breaks
  them. By wave 2, half the islands are gone. This is the hardest fight
  in the act and it should feel like it.
- **Ammo:** A6 and A7, 12 shells each, at the two long ends.
- **Exit:** the lift, 3 m, 30 m from the yard centre, brightest thing in
  the level.

## 5. Secrets (3)

| # | Type | Where | Hint | Reward |
|---|---|---|---|---|
| S1 | Broken wall | Explore 1, the room's east wall behind a cover pillar | Crack decal, lighter shade, a dart thunk | Upgrade token 1, and 8 shells |
| S2 | Broken wall | Bridge set piece, near yard, behind the second blast wall | The wall is plastic, not shell; a scrape of foam at the base | Upgrade token 2 |
| S3 | Ledge you can just reach | Breather 2, a 1.5 m lip on the pit's ring wall | Uplight, toy visible | Collectible toy 1 |

## 6. Stations and pickups

| ID | Type | Place |
|---|---|---|
| A1 | B03 full reserve (24) | Open beat, beside the blaster |
| U1 | Upgrade station | Mid-hall alcove |
| A2 | B03 shells, 8 | Arena 1, column 3 |
| U2 | Upgrade station | Breather 2, above the pit |
| A3 | B03 shells, 8 | Arena 2, on the ring |
| A4 | B03 shells, 10 | Mini-boss ring |
| A5 | B03 shells, 6 | Mini-boss, on the block |
| A6 | B03 shells, 12 | Gauntlet, west end |
| A7 | B03 shells, 12 | Gauntlet, east end |

## 7. Notes for review

- Two promoted Darters at 45 health with adds is close to the act boss in
  pressure. If the boss (BOSS-1) is a weak-point fight, this mini-boss
  should be easier: drop the adds or the second Darter's health to 35.
- The bridge fight can be skipped entirely by dropping off. That is
  intended (README pillar 3 says fights are entered by choice), but the
  skip is 24 m of bridge against a 9 m drop, so a player who wants the
  ammo has to cross. Check in playtest that the drop is not the obviously
  better route.
