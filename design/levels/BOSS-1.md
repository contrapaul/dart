# Boss 1 concept: the Act 1 boss

Status: **proposal, LVL-00**. Setting, boss name and look are [Paul]
(CONTENT-PLAN 3 lists BOSS 1 as "Foam Demon", [Paul] look, 300 health,
3 phases, several weak points). This concept only designs the **space and
the fight shape**, so any boss that fits the table can use it.

| | |
|---|---|
| New thing | Weak points shot off: the boss cannot die until its three weak points are gone |
| Health | 300 (CONTENT-PLAN 3), three phases of 100 |
| Length | 5 min, including 30 s of walk-in |
| Space | A1 Pit (34 x 26 m), 4 m deep, 14 m ceiling, plus a 2 m centre plinth |
| Kit needed | B01, B02 or B04, B03, shield (block, parry, charge), melee |
| Target time for the level | 5 min (the boss level is a boss, not a level) |

## 1. What it teaches

Nothing new. That is the point: a boss is a test, not a lesson. The fight
asks for the three skills of Act 1 in order:

- **Phase 1 asks for shooting and carving.** The boss has a launcher on
  each shoulder. Both are weak points. They shoot slow foam balls at
  2 per 3 s from 12 m. The player has to shoot them off while moving.
  The 4 m pit walls are cover, and four foam pillars in the pit are
  cover that wears out.
- **Phase 2 asks for the parry.** With the launchers gone, the boss
  switches to a two-handed overhead throw that is parryable (pink). The
  parried ball knocks the boss onto one knee for 3 s, which is the only
  window to hit its back tank (weak point 3). Waiting for the parry is
  faster than shooting through the armour.
- **Phase 3 asks for the shield charge.** With all three weak points gone,
  the boss can be finished, and the last target is its crown plate, on
  its head 4 m up. No blaster in
  Act 1 can reach it reliably. The only way up is to shield charge into
  the boss's knee when it slams (a 1 s window) and mantle 1.5 m onto the
  plinth, then shoot down onto the crown from the plinth's 2 m lip.
  Failing the timing costs 30 health and a 4 s reset.

## 2. The space

```text
                 N
   +-------------------------------+
   |  R                            |   one char = 2 m
   |        [##]      [##]         |   34 x 26 m pit
   |   R      +------+       R     |   plinth 6 x 6 m, 2 m tall, centre
   |          |plinth|             |   ring ledge +0 m, 4 m wide, S only
   |   [##]   +------+    [##]     |   pit floor -4 m
   |        [##]      [##]         |
   |  A                         A  |   boss enters from the N wall rift
   +---------------+---------------+
                   S  entry, 4 m down (drop, one way)
```

- **Entry:** the player drops 4 m into the pit from the south ledge. The
  door seals. There is no high ground for the player: this is deliberate,
  because high ground would let B03 solve every phase.
- **Plinth:** 6 x 6 m, 2 m tall, in the centre. It is shell, indestructible,
  and it is the only route to the boss's head. It gives 2 m of height, 1.5 m
  short of a mantle from the floor, so the player needs the charge.
- **Ring ledge:** 4 m wide, 4 m up, all the way round, reached by two 6 m
  ramps at the north end. It is a retreat, and the boss can knock the
  player off it. It has 2 ammo caches on it.
- **Ceiling:** 14 m, so a thrown ball can arc and be seen. No flyer
  phase: F10 arrives in Act 3, so the boss stays grounded.
- **Light:** the pit floor is dark, the plinth top is the brightest
  surface in the room, and the boss's weak points glow in the accent
  colour (not pink: pink means parryable, and only the phase 2 throw is).

## 3. Phases

| Phase | Health | Weak points | What it does | Answer | Time |
|---|---|---|---|---|---|
| 1 | 300 to 200 | 2 shoulder launchers, 60 each | Walks at the player, 2 foam balls per 3 s, stomps at 3 m | Shoot the launchers while circling the plinth. 4 foam pillars give cover, 1 zone each | 90 s |
| 2 | 200 to 100 | Back tank, 60, only exposed when kneeling | Parryable overhead throw every 4 s, sweep at 5 m | Parry the throw, hit the tank for 3 s, retreat | 90 s |
| 3 | 100 to 0 | Crown plate, 40, only from above | Slam that cracks the floor (1 s window at the knee), charge across the pit | Shield charge the knee, mantle onto the plinth, shoot the crown | 90 s |

Between phases the boss roars, all four rifts open and 4 Swarmers arrive,
and the arena's rifts stay open for 20 s. That gives the player a target
for finishers, which is where their health comes from: **this fight has
no health pickups** (D08 ammo rule, and GAME-07 is the health loop).

## 4. Waves and rifts

| Moment | Rift | Spawn |
|---|---|---|
| Phase 1 start | North wall | Boss only |
| Phase 1, at 250 health | North-east, north-west floor | 4 Swarmer |
| Phase 2 start | Same two | 4 Swarmer, plus 2 Roamer at 150 health |
| Phase 3 start | All four | 6 Swarmer, 2 Roamer |
| Crown destroyed | All four close | Nothing: the boss pops, foam only, per section 2 rules |

Never more than one boss plus 8 Foamers alive: 9 agents against the cap
of 64 and 2 melee tokens at Normal, so the Swarmers are the only Foamers
that can actually touch the player.

## 5. Destructibles

| Piece | Size | Zones | Purpose |
|---|---|---|---|
| 4 foam pillars | 1.6 x 1.6 x 2.8 m | 4 | Cover in phase 1, worn away by the fight |
| 2 floor islands | 3.2 x 0.4 x 3.2 m | 2 | On the ring ledge ramps: shoot one out and the boss's charge line drops into a hole |
| 1 ceiling plug | 3.2 x 0.6 x 3.2 m | 1 | Above the plinth: shoot it and a foam slab falls onto the plinth top, which is a 1.2 m step for the player and a 0 m problem for the boss |

Total 7 zones, over the 6-per-arena guideline in KIT 6 by one. The floor
islands are optional; cut them if the frame budget in the boss room is
tight.

## 6. Ammo and stations

| ID | Type | Place |
|---|---|---|
| A1 | B03 shells, 12 | Ring ledge, south |
| A2 | Standard darts, 40 | Ring ledge, north |
| A3 | B03 shells, 8 | Pit floor, north-east, behind a pillar |
| U1 | Upgrade station | **Before** the drop, in the antechamber. There is no station inside the boss room |

The antechamber (10 x 8 m, before the drop) is the checkpoint: the player
respawns there, walks 20 m, drops in. A boss retry costs 15 s, not a
replay of the level.

## 7. Time budget

| Beat | Minutes |
|---|---|
| Walk-in and antechamber | 0.5 |
| Phase 1 | 1.5 |
| Transition and adds | 0.3 |
| Phase 2 | 1.5 |
| Transition and adds | 0.3 |
| Phase 3 | 1.5 |
| Pop, exit lift, act card | 0.4 |
| **Total** | **5.5, about 5** |

## 8. Notes for review

- The plinth is the one piece of geometry the whole fight depends on. If
  a shield charge cannot reliably reach its lip from the floor (2 m, with
  a 1.5 m mantle), phase 3 has no answer and the fight stalls. Blockout
  must test this first, with the real charge distance (3.5 m).
- Boss weak points are voxel parts (ENG-10), so "shot off" means a part
  with its own health, which is already built. The boss should be one rig
  with 3 to 5 parts, not a bespoke system.
- 300 health across three 100 phases with 60-damage weak points means the
  player needs 60 darts minimum. At B04's rate that is 6 s of fire; at
  B01's 3 darts per shot it is 20 shots. Ammo must be generous, per the
  table, or the fight becomes a search for shells.
EOF
echo ok