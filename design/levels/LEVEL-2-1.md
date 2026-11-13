# Level 2-1 concept

Status: **proposal, LVL-06**. Works in any setting; place names are
[Paul]. Fifth level of the campaign and the first of Act 2. It builds on
the short concept in `ACTS-2-3.md` and replaces that concept's B04 line
with B06, per Paul's campaign rules (PLAN.md section 14, 2026-11-13).

| | |
|---|---|
| New blaster | B06 The Standard: heavy full-auto on mega darts, 60 mag, 120 reserve, 0.17 s between shots, 2.4 s reload, mods rate and explosive |
| New Foamer | F04 Blocker, 10 health, 1.3 m/s, holds a shield wall, volleys three darts over it at 16 m, bashes at 1.4 m |
| New mechanic | The shield wall: 120 degrees of shield on the front, 0.05 of a dart's damage from inside that arc, and three ways round it |
| Arenas | 3, plus a gantry set piece and a gauntlet |
| Target time | 18 min (15 to 20) |
| Archetypes | A4 Hall, A2 Ring, A3 Bowl, A6 Yard |

## 1. What it teaches, and how the space does it

- **A shield wall is not a health bar.** A Blocker has 10 health and a
  mega dart does 3, so 4 darts from its side kill it. From the front the
  shield takes 0.05 of each dart's damage and 10 / (3 x 0.05) is 67
  darts. The player's first frontal burst on the first Blocker teaches
  this with no words: a whole 35-round B04 magazine goes in and takes
  1.75 off 10, so the bar twitches, and then it reloads and the wall is
  still standing. The same mag into the Blocker's back from a B04 is 35.
- **Footwork alone does not flank it.** A Blocker turns at 1.4 rad/s and
  its wall holds at 9 m. Walking at 7 m/s round it at 9 m is 0.78 rad/s
  and sprinting is 1.17, so the shield keeps facing the player. Inside
  7.5 m a sprinting player turns faster than it can (10.5 / 1.4 = 7.5 m),
  and the level uses that in the explore beat, where one Blocker stands
  in the open. Everywhere else the space has to do the flanking.
- **The gantry is the first flank: over the top.** The hall's deck runs
  across the floor at 3 m, above the wall's line. The shield's arc is
  judged on the ground plane (`src/foamers/armour.ts` `plateFaces` takes
  the yaw and the flat direction of the hit), so shooting down onto a
  shield does nothing special. What works is crossing above the line and
  dropping in behind it, and 3 m is a survivable drop (the KIT caps a
  drop at 9 m).
- **B06 makes a flank pay, and never gates the level.** Six shots a
  second at 3 damage turns a flanked Blocker into four darts, about half
  a second of fire, and the 60 mag is ten seconds of trigger. A wall can
  still be beaten without B06 (a B04 burst into its back is 1 a dart, 10
  darts), so the level never locks a door behind the new blaster. B06 is
  the reason to take the flank, not the key to it.
- **Three answers in three shapes.** The hall gives the over (the
  gantry), the ring gives the round (a 6 m corridor, too narrow to get
  inside 7.5 m, so the shield charge is the answer: it knocks a Blocker
  back 3 m and leaves its shield down for 1.2 s), and the bowl gives the
  height and the drop behind. The same enemy, three lessons, one level.

## 2. Beat by beat

| # | Beat | Space | Minutes | What the player does |
|---|---|---|---|---|
| 1 | Open | 20 x 14 m workshop forecourt | 1.0 | B06 on a stand (A1, a full reserve of 120 mega), four foam dummies at 6, 10, 16 and 20 m, two crate stacks to carve. Ten seconds of trigger to feel the thump |
| 2 | Explore 1 | 14 m corridor, a 16 x 12 m store room | 2.0 | One Blocker alone at 12 m behind a crate. Frontal fire barely marks it. Walking round it at 9 m does not work; walking inside 5 m does. S1 broken wall |
| 3 | Arena 1 | A4 Hall, 18 x 44 m | 2.5 | 3 Blockers in a wall and 4 Slowmer, then 2 Blockers and 4 Roamer. The gantry is the way round. A2 ammo |
| 4 | Breather | 8 x 8 m deck landing, 3 m up | 1.0 | Station U1, ammo A3, and the deck on into the well room |
| 5 | Set piece | The gantry drop, 6 m into a conveyor well | 1.5 | 1 Blocker and 4 Swarmer on the well floor, shot from the deck edge or fought after the drop. The drop is the way on |
| 6 | Arena 2 | A2 Ring, 30 x 30 m | 2.5 | 2 Blockers on the far side and 4 Swarmer, then 3 Blockers and 4 Roamer. The ring is 6 m wide, so the shield charge is the answer. A4 ammo |
| 7 | Breather 2 | 10 x 8 m above the ring | 1.0 | Station U2, S3 ledge |
| 8 | Arena 3 | A3 Bowl, 36 x 30 m | 2.5 | 3 Blockers on tier 1 and 2 Roamer on tier 2, then 4 Blockers and 4 Swarmer. Climb the 3 m stairs to come down behind the wall |
| 9 | Gauntlet | A6 Yard, 44 x 36 m | 3.5 | 2 Blockers and 8 Swarmer, then 3 Blockers, 6 Roamer and 3 Swarmer. Ammo at both ends |
| 10 | Exit | Lift, 3 x 3 m | 0.5 | Visible from the yard's centre, 30 m away |

Total: **18 min**.

## 3. Map

Sketches: about one character = 2 m, so the hall is 9 characters across.
Long spaces are drawn shorter than they are.

```text
               N
   +---------------------------+
   | EXIT lift ^               |
   | GAUNTLET (A6 44x36)       |
   |  [##]   R      [##]   R   |
   |     [##]  [][]  [##]      |
   |  A6                    A7 |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | FINAL BOWL (A3 36x30)     |
   |  . . . tier 2 . . .       |
   |  B   B   B    tier 1      |
   |     A5     tier 0         |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | BREATHER 2 (10 x 8)       |
   |  U2      S3               |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | RING (A2 30x30)           |
   |   +------+    B    B      |
   |   | blok |                |
   |   +------+    A4          |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | SET PIECE: gantry drop    |
   |  6 m down into a well     |
   |     B     [S2]            |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | BREATHER 1 (8 x 8)        |
   |  U1      A3               |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | ARENA 1: HALL (A4 18x44)  |
   | ##  ##  ==gantry==  ##    |
   |   B    B    B             |
   | A2                        |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | EXPLORE 1: 14 m + room    |
   |   S1 broken wall          |
   +-------------+-------------+
                 |
   +-------------+-------------+
   | OPEN: forecourt, B06 + A1 |
   | START                     |
   +---------------------------+

B06 is found in the Open beat, 30 m before Arena 1's door, with 20 m of
empty forecourt and four dummies to try it on (README: a new blaster in
the Open beat, then 20 to 30 s of space to use it).

## 4. Arenas

### Arena 1: Workshop floor (A4)

- **Footprint:** 18 x 44 m, 7 m ceiling, seven 1.2 x 1.2 x 4 m columns in
  two staggered rows every 8 m. A 6 x 18 m deck at 3 m crosses the hall's
  width 24 m in, with a 6 m ramp up from the floor at each end (3 m rise,
  27 degrees, inside the kit's 46). The exit stair to the breather leaves
  the deck's far end, so the deck is on the way out as well as the way
  round.
- **Lock:** trigger at the fourth column, 18 m in. The player is 18 m
  from the door and 26 m from the far wall, so the wall has room to close
  and the player has room to break. The lock holds both side doors; the
  deck stays open, so the flank is never taken away.
- **Waves:**
  1. 3 Blockers from the north rift at 30 m, closing to one 3.6 m wall,
     and 4 Slowmer from the floor rifts at the sides.
  2. 2 Blockers, one through each side door, and 4 Roamer from the
     north rift. 55 s.
- **Destructibles:** five columns, 1 zone each, and one 3.2 x 3.2 x 1.6 m
  barrier of stacked toys on the deck. Six zones, the KIT arena cap.
  Carving the columns near the wall removes the player's own cover, so
  carving has a cost.
- **Why it works:** the wall holds at 9 m where neither walk nor sprint
  can out-turn it, and the deck crosses above and behind it. The player
  who tries to out-shoot the shields spends a mag and learns; the player
  who takes the ramp, crosses the 6 m above the wall and drops off the
  far edge lands about 5 m behind the line and kills a Blocker in four
  darts. The Slowmers behind the wall are the pressure that stops the
  player from standing still to think.
- **Ammo:** A2 at the hall's entry side, 30 mega.
- **Sketch:**

```text
   +---------+
   | ## ## ##|   ## column, 1.2 m square
   |         |
   | B  B  B |   wall, 3.6 m across, holds at 9 m
   |=========|   deck at 3 m, 18 m across, ramps at both ends
   | ## ## ##|
   |    S    |   enters S at floor, leaves N by the deck stair
   +---------+
```

### Set piece: The gantry drop

- **Footprint:** the breather's deck runs 20 m along the well room's
  north wall at 3 m and stops at a 6 m gap. Below the gap is a conveyor
  well, 14 x 12 m and 6 m down, with a 6 m ramp up to the ring's
  antechamber at its far end. The deck's edge has no rail.
- **No lock.** The way on is the well. There is no way back up onto the
  deck, so the drop is a one-way route (KIT: cap a drop at 9 m; 6 m is
  survivable and lit at the bottom).
- **Fight:** 1 Blocker on the well floor 9 m from the drop point and
  4 Swarmer from two floor rifts. The Blocker's wall faces the drop, so
  the player who drops in front of it arrives inside its arc.
- **Why it works:** it turns the hall's flank into a decision. A player
  who stands on the deck edge above the well can shoot down into a shield
  that still faces them (the arc is flat, see the notes), so the deck is
  not a free win. Dropping lands behind the wall if the player drops off
  its side. The drop also teaches that a level goes down as well as along,
  which the ring and the bowl then use.
- **Ammo:** none. The reward is S2, on the deck just before the gap.

### Arena 2: Conveyor ring (A2)

- **Footprint:** 30 x 30 m, 8 m to the ceiling, a 10 x 8 m centre block
  3.5 m tall, a 6 m ring all round. The ring's floor is a conveyor belt
  in look only: the belts are scenery, static, because there is no moving
  floor in the code yet.
- **Lock:** trigger 8 m in from the south door.
- **Waves:**
  1. 2 Blockers on the far side of the ring and 4 Swarmer from two floor
     rifts.
  2. 3 Blockers, one from each of three rifts round the ring, and
     4 Roamer from the ring itself. 70 s.
- **Destructibles:** four 1.6 x 1.6 x 2.8 m pillars in the ring, 1 zone
  each, and two crate stacks on the block, 1 zone each. Six zones.
- **Why it works:** the ring is 6 m wide and a two-Blocker wall is 1.8 m
  of body with 1.2 m slots, so the player cannot get inside 7.5 m and
  round it without leaving the ring. The answer is the shield charge the
  player learned in 1-4: 14 m of range covers the ring, and the 1.2 s
  stagger is the whole opening. Removing the pillars makes the loop
  faster and the cover worse, which is a real choice.
- **Ammo:** A4 in the ring, 30 mega.

### Arena 3: Final bowl (A3)

- **Footprint:** 36 x 30 m, tiers at 0, 1.2 and 2.4 m, 3 m stairs every
  8 m, 9 m ceiling. The bowl's top tier holds the door to breather 2's
  stair, and the level's last wall stands on tier 1.
- **Lock:** trigger on tier 0, 8 m in.
- **Waves:**
  1. 3 Blockers on tier 1 facing tier 0, and 2 Roamer on tier 2.
  2. 4 Blockers spread across the three tiers, and 4 Swarmer from the
     floor. 70 s.
- **Destructibles:** three pillars on tier 1 and three barrier pieces of
  stacked toys on tier 2. Six zones.
- **Why it works:** the wall faces down the bowl, and the stairs put the
  player on tier 2 behind it. Height alone does not beat a shield (the
  arc is flat), so the tier is the position, not the angle: the player
  comes down behind a wall that is still facing the tier below. The 8 m
  stair spacing means the player is exposed on the way, and that is the
  fight.
- **Ammo:** A5 on tier 0 at the entry side, 30 mega, where the player
  passes it on the way to the lock.

### Gauntlet: Yard with islands (A6)

- **Footprint:** 44 x 36 m, 9 m ceiling, six islands 4 to 6 m across and
  2.5 m tall.
- **Waves:**
  1. 2 Blockers from the short ends and 8 Swarmer from the floor rifts.
  2. 3 Blockers, 6 Roamer and 3 Swarmer, about 12 alive at once, so
     spawn them in a held order like the 1-4 yard rather than a clump.
- **Destructibles:** six islands, 1 zone each.
- **Why it works:** 44 m is six times the flank radius, so the player can
  choose which island to fight round, and a wall that holds at 9 m has
  four different faces to show. By wave 2, half the islands are gone and
  the flanks are shorter. This is the level's hardest room and it should
  feel like it.
- **Ammo:** A6 and A7, 24 mega each, at the two long ends.
- **Exit:** the lift, 3 x 3 m under a lime panel, 30 m from the yard
  centre and the brightest thing in the level.

## 5. Secrets (3)

| # | Type | Where | Hint | Reward |
|---|---|---|---|---|
| S1 | Broken wall | Explore 1, the store room's east wall behind the crate | Crack decal, lighter shade, a dart thunk | Upgrade token 1, and 12 mega |
| S2 | Vent | The deck, just before the well gap, behind a plastic blast wall | Air movement particles, a scrape of foam at the base | 24 mega |
| S3 | Ledge you can just reach | Breather 2, a 1.5 m lip on the ring wall | Uplight, toy visible | Collectible toy 1 |

## 6. Stations and pickups

| ID | Type | Place |
|---|---|---|
| A1 | B06 full reserve (120 mega) | Open beat, beside the blaster |
| A2 | Mega darts, 30 | Arena 1, entry side |
| U1 | Upgrade station | Breather 1, the deck landing at 3 m |
| A3 | Mega darts, 30 | Breather 1 |
| A4 | Mega darts, 30 | Arena 2, in the ring |
| U2 | Upgrade station | Breather 2, above the ring |
| A5 | Mega darts, 30 | Arena 3, tier 0 |
| A6 | Mega darts, 24 | Gauntlet, west end |
| A7 | Mega darts, 24 | Gauntlet, east end |

Seven ammo pickups and two station marks: under the KIT's readability cap
of 8 things on the floor. One cache in each arena's entry side (A2, A4,
A5), one in breather 1 (A3), and two at the gauntlet's ends (A6, A7).
Breather 2 has no ammo on purpose: the ring's cache is 40 m back, and the
bowl is the level's last long fight. An ammo cache is visible from where
it is needed (D08).

**Health.** No level-placed health pickups, on purpose, as in 1-3: the
health is in the finishers. A staggered Blocker is finished like any
Foamer and sprays health blobs (GAME-07), and the shield charge's 1.2 s
stagger is the reliable window. Health is therefore on the far side of
the wall, which is the same lesson a third time. Note for the build: a
level file may name a `health` pickup and the validator accepts it, but
the pickups system only spawns `darts-*` types today
(`src/pickups/pickups.ts`), so a placed health box would never appear.

## 7. Notes for review

- **The 12 m arc in `ACTS-2-3.md` does not match the tuning.** Blockers
  walk to slots `spacingMetres` 1.2 apart, so three of them make a 3.6 m
  wall. This doc uses the 3.6 m wall. A real 12 m arc would either need a
  spacing of about 5 m (which leaves gaps a player can walk through) or
  more Blockers in the line.
- **The line cannot be squeezed.** A Blocker body is 12 voxels wide
  (0.6 m) on 1.2 m slots, so the gap between two bodies is 0.6 m and the
  player's diameter is 0.7 m. Any change to `spacingMetres` changes that.
- **Height does not beat a shield, and that is a code fact, not a
  choice.** `plateFaces` in `src/foamers/armour.ts` reads yaw and the
  flat direction of the hit, so a dart fired down from the gantry at a
  shield's top face is still inside the arc. The gantry and the bowl work
  as position, never as angle. If Paul wants height to matter, that is a
  gameplay card, not a level doc.
- **B03 point blank can out-shoot the shield.** The Leviathan's damage
  line is 11 a buck dart inside 3 m, so both barrels landing 8 of 8 is 88
  and the shield's 0.05 share leaves 4.4 off a Blocker's 10. Landing most
  of 16 pellets at 3 m is not guaranteed (its own tests hunt a seed for
  it), but a point blank player who gets it kills a Blocker through its
  shield in about a second, faster than the flank. That undercuts the
  lesson with the one blaster the player owns by level 5. Options: keep
  it (walking into a wall at 1.4 m means bashes) or tune the share down
  for multi-dart blasters. Not changed here.
- **The first exchange starts at 16 m.** The wall's volley reaches 16 m
  and it holds at 9 m, so the player is shot at before reaching fighting
  range. Three Blockers landing three darts each is 27 damage a cycle,
  and the player's `hitGrace` is 0.5 s. Check in playtest that the hall's
  opening exchange is teachable and not a coin flip.
- **Gauntlet wave 2 is 12, the Normal cap.** Use held spawns as the 1-4
  yard does, never one clump.
- **Ammo economy is a tuning question, not a design one.** B06's 60 mag
  is ten seconds of fire and the reload is 2.4 s; A1 tops the reserve to
  its 120 cap (two magazine loads), and the level hands out 168 more mega
  across six caches, so 288 in all. Try the wall fights on the range
  before changing the cache sizes.
- **No promoted Foamers in this level.** The ring's promoted pair is 1-4's
  skill check, and 2-1's check is the wall itself.

## 8. Open questions for Paul

1. **Setting.** `ACTS-2-3.md` offers a workshop floor, a school hall with
   a stage that the gantry becomes, or a toy store's shelving aisle. This
   doc assumes the workshop. Which one, and what are the rooms called?

   Answer: Workshop, and for now we can call them workshop room 1, 2, etc. 

2. **The conveyor.** The belts are scenery. Should the gantry (or the
   ring) actually move? That is E07 in `ENVIRONMENT.md`, rated a large
   piece of new work, so it is not in this concept.

  Answer: Not yet, but this is something to revisit in later passes.

3. **Melee weapon 1.** The short concept lists it as a 2-1 pickup;
   Paul's campaign rule says hand weapons are found in levels, decided
   later with melee. Is 2-1 where it is found? This doc places none, and
   the finishers carry the health instead.

   Answer: Yes, we should add a melee weapon here. A sword, to be precise. Just before arena 1. 

4. **B06's mods.** The mod station exists (ENV-03). Should `rate` or
   `explosive` be granted here (after Arena 2, say), or do mods stay a
   later upgrade-token thing?

  Mods are purchased with tokens. For testing stations should offer them for free, but they will be locked to purchases later. 

5. **A promoted wall for the last room.** Arena 3 could close on a
   promoted pair (1.5 health, light purple plates, the 1-4 look). Keep
   the plain wall or promote it?

   Promote

6. **Health between levels.** The campaign carries health and nothing
   tops it up at a level start. Does 2-1 begin on what the player
   carried, and is there a heal at each arena checkpoint? This doc
   assumes "what you carry".

   Health should be found in drops on the map and melee kills, but moving from 1-X to 2-X, or 2-X to 3-X should reset health to full. 
