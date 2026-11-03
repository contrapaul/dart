# Level 1-2 concept

Status: **proposal, LVL-00**. Works in any setting; place names are
[Paul]. Second level of Act 1.

| | |
|---|---|
| New blaster | B02 sidearm (table row 1-2) |
| New Foamer | F02 Roamer, 8 health, slow foam ball, parryable |
| New mechanic | Shield block and parry (first parryable shots) |
| Arenas | 3, plus a tower climb set piece and a gauntlet |
| Target time | 18 min (15 to 20) |
| Archetypes | A2 Ring, A5 Tower, A7 Crossroads, A3 Bowl |

Note: CONTENT-PLAN 1A (D04) lists blasters in a different order ("level 2
the shredder, level 3 the double barrel") than table 2. This concept
follows table 2, as instructed. If Paul wants D04's order, swap the B02
row to B04 and nothing else in the level changes.

## 1. What it teaches, and how the space does it

- **A ball you can block, and a ball you can parry.** The first Roamer
  stands at the far end of a 22 m corridor with a 4 m wide alcove to step
  into. Its first shot is slow (about 8 m/s) and glowing pink. Blocking
  works from anywhere; parrying needs the ball to arrive within 0.4 s of
  the press. The corridor is 22 m, giving 12 m of reaction room, and the
  alcove means a failed parry is not a death.
- **Parry sends it back.** The Roamer that fired is the one that pops. The
  space shows this: the first Roamer is alone, 18 m away, with nothing
  behind it. The returned ball kills it. That is a 5 second lesson with no
  text and a joke at the end.
- **Shields are a decision, not a state.** Arena 1 is a ring: the player
  can be shot from two sides, so holding block in one direction is
  punished by movement, not by damage.
- **Height changes the parry.** Arena 2 is a tower: balls come down at an
  angle, so the player learns the shield is a disc with a facing.

## 2. Beat by beat

| # | Beat | Space | Minutes | What the player does |
|---|---|---|---|---|
| 1 | Open | Service corridor, 16 x 6 m | 1.0 | No combat. B02 on a rack (A1), 30 m of corridor to test it on a foam wall |
| 2 | Explore 1 | 22 m corridor with an alcove, then a small yard | 2.0 | First Roamer: block, then parry its ball back. S1 is a vent off the alcove |
| 3 | Arena 1 | A2 Ring, 30 x 30 m | 2.5 | 4 then 6 Roamers around the ring block; the centre block hides the third rift |
| 4 | Breather | 10 x 8 m store | 1.0 | Station U1, ammo A2, a window onto the ring |
| 5 | Set piece | A5 Tower climb, 20 x 20 m, 4 floors | 3.0 | Climb 15 m by 1.5 m ledges while Roamers shoot down. Two fights, one per two floors. Fall damage is off; a fall costs 8 s |
| 6 | Arena 2 | A7 Crossroads, 32 x 32 m | 2.5 | 6 Roamers from three spokes, then 7 with one arriving from behind |
| 7 | Breather 2 | 8 x 8 m, top of the crossroads | 1.0 | Station U2, ammo A3, the S3 ledge |
| 8 | Gauntlet | A3 Bowl, 36 x 30 m | 3.5 | 8 then 10 Roamers from the top two tiers, ammo at both bottom corners |
| 9 | Exit | 4 m door, lit | 0.5 | On the far wall from the entry, at the bottom of the bowl |

Total: **18 min**.

## 3. Map (about 1 character = 4 m)

```text
                 N
   +------------------------------+
   | EXIT v                       |
   | GAUNTLET (A3 36x30)          |
   |  R      [steps]      R       |
   |    [==]        [==]          |
   |  A                        A  |
   +--------------+---------------+
                  | lift down 4 m
   +--------------+---------------+
   | CROSSROADS (A7 32x32)        |
   |   +--+   R       +--+       |
   |   |  |  ....     |  |   S3  |
   |   +--+  .U2.     +--+       |
   |      R  ....  R              |
   +--------------+---------------+
                  | U2 / A3
   +--------------+---------------+
   | TOWER (A5 20x20, 4 floors)   |
   |   R      ____      R         |
   |   |  U1 landing  |           |
   |   |____  S2  ____|           |
   +--------------+---------------+
                  | climb 15 m
   +--------------+---------------+
   | RING (A2 30x30)              |
   |     R                     R  |
   |   +--------+                 |
   |   | block  |   R             |
   |   +--------+                 |
   +--------------+---------------+
                  | store U1 A2
   +--------------+---------------+
   | EXPLORE 1: 22 m corridor     |
   |  [alcove] S1 vent ->         |
   +--------------+---------------+
                  |
   +--------------+---------------+
   | OPEN: corridor. B02 + A1.    |
   | START                        |
   +------------------------------+
```

## 4. Arenas

### Arena 1: Ring (A2)

- **Footprint:** 30 x 30 m, 10 x 8 m centre block 3.5 m tall, ring 6 m
  wide, 8 m ceiling. Entry and exit both on the south wall, on opposite
  corners of the block, so the player must go round.
- **Lock:** trigger 8 m in, past the first corner. Four shutters, one per
  side, drop.
- **Waves:**
  1. 4 Roamer, rifts at the north-west and north-east corners. 40 s.
  2. 6 Roamer, same rifts plus a floor rift inside the ring's east side,
     hidden behind the block until it opens. 60 s.
- **Destructibles:** the centre block is **shell** (bedrock anchored, not
  voxel) on purpose: this arena teaches movement, not carving. Two 1.6 x
  1.6 x 2.8 m foam pillars stand in the ring, 1 zone each, so the ring
  gets wider as the fight goes on. The player who carves them has an
  easier second wave, which rewards the skill from 1-1.
- **Why it works:** a 6 m ring means a Roamer on the far side is 14 m
  away and behind cover, so the player must move. Nothing shoots from
  behind until wave 2, and the floor rift glows for 1.5 s before it opens.
- **Ammo:** A2 in the south-west corner.
- **Exit:** from the block, the north door is not visible; it becomes
  visible once the player is on the north side. Deliberate: this is the
  one arena where the exit is a reveal, and the reveal is a lit door plus
  a colour pulse.

### Set piece: Tower climb (A5)

- **Footprint:** 20 x 20 m, floors at 0, 5, 10 and 15 m, 4 m headroom.
  Each floor has a 3 m hole in the slab on alternating sides, with a
  chain of 1.5 m ledges. No jumps are needed; the ledges are the route.
- **Fights:** 2 Roamers on floor 2, 2 Roamers plus 1 Slowmer on floor 3.
  No lock-in: Foamers that fall stay down, and the player can retreat to
  the previous floor. This is the level's safe vertical puzzle.
- **Destructibles:** one ceiling plug 3.2 x 0.6 x 3.2 m above floor 2
  (cardboard, 1 shot). Shooting it drops a foam slab onto the floor below,
  which is a shortcut down, not a hazard (it does 0 damage, it just
  blocks a lane).
- **Why it works:** parrying is easier when the ball travels in one plane.
  The tower puts the player below the shooter, so every ball is a visible
  arc and the player can lead the parry.
- **Ammo:** a Roamer that loses its ball arm cannot shoot, and the tower
  has one Roamer with a visible satchel: shooting the satchel (a weak
  point per CONTENT-PLAN 3) drops nothing here, but the tutorial for
  ability parts starts here for free.

### Arena 2: Crossroads (A7)

- **Footprint:** 32 x 32 m hub, one 8 m pillar, four 8 m spokes. Three
  spokes are open; the fourth is the exit and stays shut.
- **Lock:** trigger in the hub centre. Four gates drop, including the one
  the player came in by.
- **Waves:**
  1. 6 Roamer from the north, east and west spokes, 20 s stagger.
  2. 7 Roamer, plus one Slowmer from a floor rift at the pillar's base,
     which is the "behind you" moment for the level.
- **Destructibles:** the pillar has four 1.6 x 1.6 x 2.8 m foam skins
  (1 zone each) over bedrock. Carving all four opens the middle of the
  arena as a shooting lane but also removes everyone's cover, the
  player's included. A real choice, no wrong answer.
- **Exit:** the south spoke, which the player entered by, which is why
  the lock has to release it. Contradicts README rule 2, so this is the
  one place in the act where the way on is the way back: the crossroads
  turns the level 90 degrees, which is the point of A7. Flagged for
  review.

### Gauntlet: Tiered bowl (A3)

- **Footprint:** 36 x 30 m, tiers 0, 1.2 and 2.4 m, three rifts on the
  upper tiers, 9 m ceiling.
- **Waves:**
  1. 8 Roamer, two upper rifts, 14 m apart.
  2. 10 Roamer, plus a floor rift in the bottom tier's centre, which
     makes the low ground a bad place to stand and pushes the player up
     the tiers.
- **Destructibles:** four cover pillars on tier 1 (1 zone each), plus a
  floor island under the east tier-2 ledge that drops a Slowmer (and any
  player standing on it) to tier 0. It costs nothing and it is funny.
- **Ammo:** A4 (6 darts) bottom-west, A5 (6 darts) bottom-east.
- **Exit:** lit 4 m door on the south wall, visible from anywhere in the
  bowl.

## 5. Secrets (3)

| # | Type | Where | Hint | Reward |
|---|---|---|---|---|
| S1 | Vent | Explore 1, behind the alcove's back panel | Air particles and a hum; the panel is plastic, not wall | Upgrade token 1, and a vent that comes out in the ring's north side |
| S2 | Broken wall | Tower, floor 2, under the ledge chain | A crack and a lighter shade | 30 darts for B02 |
| S3 | Ledge you can just reach | Breather 2, 1.5 m above the floor | Uplight and a visible toy | Collectible toy 1 |

## 6. Stations and pickups

| ID | Type | Place |
|---|---|---|
| A1 | B02 full reserve (infinite reserve for B02, per CONTENT-PLAN 4: 6 mag) | Open beat |
| U1 | Upgrade station | Store, after Arena 1 |
| A2 | Standard darts, 4 | Arena 1, south-west corner |
| U2 | Upgrade station | Top of the tower |
| A3 | Standard darts, 4 | Breather 2, beside U2 |
| A4 | Standard darts, 6 | Gauntlet, bottom-west |
| A5 | Standard darts, 6 | Gauntlet, bottom-east |

## 7. Notes for review

- A7 makes the player leave by the way they came, which breaks README
  pillar 2. Either accept it as the act's one exception, or mirror the
  crossroads so the exit is a fifth spoke.
- B02 has an infinite reserve in CONTENT-PLAN 4. If that stays, the
  ammo caches in this level are for B01 only and the level's ammo
  pressure is lower than 1-1. Worth testing.
