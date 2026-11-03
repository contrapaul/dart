# Level 1-3 concept

Status: **proposal, LVL-00**. Works in any setting; place names are
[Paul]. Third level of Act 1.

| | |
|---|---|
| New blaster | Table 2 is blank here. **Proposed: none.** The 8 blasters already fill levels 1-1, 1-2, 1-4, 2-1, 2-3, 3-1, 3-2 and 3-4, so this level's new thing is the Swarmer and the finisher. Paul decides; see the note in section 7 about D04 |
| New Foamer | F03 Swarmer, 2 health, packs of 4 to 6, nibble swarm |
| New mechanic | Pop finishers: a staggered Foamer glows and wobbles, melee it for health |
| Arenas | 3, plus a drop set piece and a gauntlet |
| Target time | 17 min (15 to 20) |
| Archetypes | A1 Pit, A6 Yard, A4 Hall, A2 Ring |

## 1. What it teaches, and how the space does it

- **Stagger is a state, and it is loud.** A Foamer that takes a burst
  wobbles and glows. The level's first Swarmer pack is 4, in a 30 m pit
  where every one of them is visible, and the player's first B04 burst
  staggers one at 10 m. The glow is the tutorial.
- **Finishing refills health.** The arena before this one took health and
  gives no health pickups. Arena 1's wave 2 is 8 Swarmers with 2 health,
  so they stagger and die in one burst, and a player who melees three of
  them leaves the arena fuller than they went in. That is the loop of
  D12 and GAME-07 in one room, without a word.
- **Swarmers come in a shape the space answers.** They are small and fast
  and come in packs, so the space gives a narrow throat: the pit has two
  6 m ramps and nothing else, so a pack arrives in a stream. The yard
  after it has six islands, so the pack has to split.
- **Sustained fire wants a crowd, not a corridor.** The long hall set
  piece puts 12 Swarmers down one 44 m lane: a 44 m lane lets the player
  hold a line and keep firing without repositioning, and the yard's
  islands do not. Teaching by geometry.

## 2. Beat by beat

| # | Beat | Space | Minutes | What the player does |
|---|---|---|---|---|
| 1 | Open | 18 x 12 m loading bay | 1.0 | No pickup. 25 m of bay with three foam dummies to warm up the trigger on, and A1 ammo beside the door |
| 2 | Explore 1 | Two corridors, 10 m each, a 12 x 10 m room | 1.5 | One Slowmer and one Swarmer, clearly separate. Player sees the Swarmer stagger and glow, and can melee it. S1 vent |
| 3 | Arena 1 | A1 Pit, 34 x 26 m | 2.0 | 6 Swarmer (wave 1), then 8 Swarmer plus 2 Slowmer (wave 2). Packs come down the ramps in a stream |
| 4 | Breather | 8 x 6 m, a catwalk over the pit | 1.0 | Station U1, no health pickup on purpose (the finishers are the health) |
| 5 | Arena 2 | A6 Yard, 44 x 36 m | 3.0 | 8 Swarmer from both ends, then 10 Swarmer plus 3 Slowmer. Islands split the pack |
| 6 | Set piece | A4 Hall plus a 6 m drop | 1.5 | A 44 m lane, a drop at the end that seals behind. Wave of 12 Swarmers in the lane, no lock (they chase you down it) |
| 7 | Breather 2 | 10 x 8 m, bottom of the drop | 1.0 | Station U2, ammo A3, S3 ledge |
| 8 | Gauntlet | A2 Ring, 30 x 30 m | 3.0 | 10 Swarmer, then 12 Swarmer plus 4 Roamer. The ring's 6 m width turns the swarm into a queue |
| 9 | Exit | North door, lit | 0.5 | Visible from the ring's east side |

Total: **17 min**.

## 3. Map (about 1 character = 4 m)

```text
                N
   +----------------------------+
   |  RING (A2 30x30)    EXIT ^ |
   |    R      +----+       R   |
   |        U2 |blok|           |
   |    R      +----+       R   |
   +-------------+--------------+
                 | drop 6 m, seals
   +-------------+--------------+
   | HALL (A4 18x44)            |
   |  ##   ##   ##   ##   ##    |
   |  S3 alcove     R           |
   +-------------+--------------+
                 | U2 / A3
   +-------------+--------------+
   | YARD (A6 44x36)            |
   |  [##]   R     [##]     R   |
   |     [##]  [][]  [##]       |
   |  S2 growth    A        A   |
   +-------------+--------------+
                 | catwalk U1
   +-------------+--------------+
   | PIT (A1 34x26)             |
   |   R    [####]        R     |
   |   ^ ramps only, no flats   |
   +-------------+--------------+
                 | S1
   +-------------+--------------+
   | EXPLORE 1: 2 corridors     |
   +-------------+--------------+
                 |
   +-------------+--------------+
   | OPEN: bay. A1 only. START |
   +----------------------------+
```

## 4. Arenas

### Arena 1: Pit (A1)

- **Footprint:** 34 x 26 m, pit 4 m deep, ring ledge 4 m wide on the
  south and west only, two 6 m ramps at the north and east ends. 12 m
  ceiling. Entry from the ring, 4 m above the floor.
- **Lock:** trigger 8 m in on the pit floor. South shutters close, so the
  player cannot stand on the ring ledge and hose the whole fight from
  above. This is deliberate: free high ground with an auto blaster would
  trivialise the pack.
- **Waves:**
  1. 6 Swarmer, four from the north ramp, two from the east. 25 s.
  2. 8 Swarmer, north and east ramps plus a floor rift centre-south,
     then 2 Slowmer from the same floor rift 10 s later. 45 s.
- **Destructibles:** centre block 6 x 4 x 3.5 m, 3 zones of foam-orange,
  plus two 1.6 x 1.6 x 2.8 m pillars on the pit floor (1 zone each). The
  pillars are what the pack has to run around, so the player gets 2 s of
  a clean line.
- **Why it works:** 8 Swarmers at 2 health die to about one second of
  fire, which means the room fills with foam chunks and the frame budget
  is the real enemy. Cap: the wave list never has more than 10 alive, per KIT 6.
- **Ammo:** A2 on the ring ledge, 30 darts. The player has to go back up
  one ramp to get it, which is a 4 s decision.

### Arena 2: Yard with islands (A6)

- **Footprint:** 44 x 36 m, 9 m ceiling, six 4 to 6 m islands at 2.5 m.
- **Lock:** trigger at the yard centre, 12 m in. Four gates close, all
  visible from the centre.
- **Waves:**
  1. 8 Swarmer, rifts at both short ends, 20 s apart.
  2. 10 Swarmer from the ends, plus 3 Slowmer from a rift on the north
     wall. 70 s.
- **Destructibles:** the six islands, 1 to 2 zones each. By wave 2, some
  islands are gone and the yard is more open, which helps the player and
  the pack equally.
- **Why it works:** the first time Swarmers have to split around cover,
  they arrive in two streams instead of one. Two streams is where the
  player has to turn and keep firing, which is the level's whole skill.
- **Ammo:** A3 and A4 at the two long ends, 35 darts each.

### Set piece: Long hall into a drop (A4)

- **Footprint:** 18 x 44 m, six columns, 7 m ceiling. The last 6 m of the
  floor is missing: a 6 m drop into the level's next corridor.
- **No lock.** 12 Swarmers spawn behind the player at the hall's mouth
  and chase them down the 44 m lane. The player can fight or run. The
  drop is a one-way exit and it seals 3 s after the player lands, so the
  choice is real and short.
- **Destructibles:** three of the six columns are voxel (1 zone each),
  three are shell. The same lesson as 1-1, now under a swarm, so a player
  who shoots cover reflexively has a worse lane and a better escape.
- **Why it works:** this is the level's only chase. It uses the player's
  sprint (10.5 m/s) against the Swarmer's speed, and it is the only place
  where the level rewards running away.

### Gauntlet: Ring (A2)

- **Footprint:** 30 x 30 m, 10 x 8 m centre block, 6 m ring.
- **Waves:**
  1. 10 Swarmer, four rifts, one per side. 45 s.
  2. 12 Swarmer plus 4 Roamer from the same rifts. The Roamers arrive
     last and shoot over the swarm, so the player has to get out of the
     ring and onto the block.
- **Destructibles:** four 1.6 x 1.6 x 2.8 m pillars in the ring, 1 zone
  each. The block stays shell. With four pillars gone the ring is a clean
  loop, which is the reward for carving them early.
- **Ammo:** A5 in the ring's north-west corner, 40 darts, and A6 on top
  of the block, 20 darts (a 3.5 m block is reachable by a 1.5 m mantle
  chain on the east side).
- **Exit:** the north door, 3 m, lit, with a colour pulse when the
  gauntlet clears.

## 5. Secrets (3)

| # | Type | Where | Hint | Reward |
|---|---|---|---|---|
| S1 | Vent | Explore 1, behind the second corridor's floor grate | A hum and particles; the grate is a different metal | Upgrade token 1, and a vent to the pit's ring ledge |
| S2 | Foam growth you clear | Yard, on the south wall between two islands | A different growth colour, and a token glow through the gaps | 60 standard darts |
| S3 | Ledge you can just reach | Hall, a 1.5 m lip above the drop | Uplight, a toy visible on it | Collectible toy 1 |

## 6. Stations and pickups

| ID | Type | Place |
|---|---|---|
| A1 | Standard darts, 40 | Open beat, beside the door |
| U1 | Upgrade station | Catwalk over the pit |
| A2 | Standard darts, 30 | Arena 1, ring ledge |
| U2 | Upgrade station | Bottom of the drop |
| A3 | Standard darts, 35 | Yard, west end |
| A4 | Standard darts, 35 | Yard, east end |
| A5 | Standard darts, 60 | Ring, north-west |
| A6 | Standard darts, 20 | Ring, on the block |

## 7. Notes for review

- No health pickups in the level at all, on purpose: finishers are the
  health. If a playtest shows players dying, add 2 small health pickups
  in the two breathers, not in the arenas.
- Swarmer packs of 10 at 2 health each will make 10 break-off bodies and
  140 debris pieces inside 2 s. That is at the destruction caps. The
  blockout should use a 4 s wave stagger, never one clump.

## 8. Blaster note (table 2 vs D04)

CONTENT-PLAN table 2 leaves 1-3 blank for a blaster, and CONTENT-PLAN
1A (D04) says "one new blaster per level, in order, until we run out",
with level 2 getting the Shredder. Adding B04 here would put B04 in both
1-3 and 2-1, and would leave levels 2-2 and 2-4 without one anyway.

So this concept treats 1-3 as a **mechanic level**: the new things are
the Swarmer and pop finishers, and the blaster table stays as written.
If Paul wants a blaster here, the cheapest fit is B05 Shrike (precision),
which would make the arena wiring a long sight line: the hall and the
yard both have 44 m lanes, and the pit's centre block is the only cover
that breaks them. Swapping B05 in changes no geometry, only the ammo
tables.
