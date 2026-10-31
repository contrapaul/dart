# DART content plan: enemies, blasters and upgrades

Status: **draft for Paul's input**, 2026-10-31. Everything here is Proposed
until Paul decides. Mechanics, roles and numbers are suggestions to react
to; every name, look, colour and story beat is Paul's and is left as
`[Paul]`. When a decision is made it moves into `PLAN.md` (sections 3 to 6)
and the decisions log.

How to give input: answer the decisions in section 1 (a letter or "yes" is
enough), then fill the `[Paul]` cells in sections 3 and 4 at your own pace.
The vertical slice (P1, due 2026-11-29) only needs **3 blasters and 3
Foamers** from you; the rest can follow.

---

## 1. Decisions for Paul

Each has a recommendation first.

| # | Decision | Options (recommended first) |
|---|---|---|
| D1 | Game length | **A. 3 acts x 4 levels = 12 levels, 15 to 20 min each, about 4 hours.** B. 3 acts x 3 levels, about 2.5 hours. C. 4 acts x 4 levels, about 5 hours |
| D2 | Bosses | **A. One per act (3), plus a mini-boss arena mid-act.** B. One final boss only |
| D3 | Enemy roster size | **A. 12 Foamer types + 3 bosses** (section 3). B. 9 types + 3 bosses for a faster build |
| D4 | Blaster count | **A. 8 blasters** (section 4), one new every level or two. B. 6 blasters |
| D5 | Do Foamer colours mean class? | **A. Yes: one colour family per tier** (fodder, heavy, elite), so players read the threat at a glance. B. Each Foamer its own colour |
| D6 | Upgrade structure | **A. Two layers: blaster mods (2 per blaster, each with an upgrade) and player upgrades from hidden tokens** (section 5). B. Add a third layer of equippable perks, like DOOM's runes |
| D7 | How upgrades are bought | **A. Between levels, on an upgrade screen, with points earned in the level.** B. At stations inside levels |
| D8 | Ammo pickups from floor darts | **A. Off by default; try it in the slice.** B. On |
| D9 | Ammo-for-kills tool | **A. A suck-up tool: a vacuum that pulls a weakened Foamer in and spits darts out.** B. A squeeze finisher on any Foamer below a health line |
| D10 | Difficulty presets | **A. Four: Story, Normal, Hard, Foam Fury (names [Paul])**, plus the sliders from PLAN.md 10. B. Sliders only |
| D11 | Limb damage defaults | **A. As in section 3.1: one leg limps, both crawl, arms take attacks, head is a double-damage weak point.** B. Limbs only slow, never remove attacks |

---

## 2. Game structure (assumes D1 A, D2 A)

DOOM-style: each level is exploration with secrets between 3 to 5 combat
arenas that lock until cleared. Each level introduces **one new thing**
(a blaster, a Foamer or a mechanic) and then combines it with what came
before. A boss ends each act.

| Level | Act | New blaster | New Foamer | New mechanic | Notes |
|---|---|---|---|---|---|
| 1-1 | 1 | B01 starter | F01 fodder | Move, shoot, carve cover | Tutorial woven into play |
| 1-2 | 1 | B02 sidearm | F02 basic ranged | Shield block and parry | First parryable shots |
| 1-3 | 1 | | F03 swarmer | Pop finishers, health from finishers | |
| 1-4 | 1 | B03 spread | F05 charger | Shield charge | Mini-boss arena: two chargers |
| Boss 1 | 1 | | BOSS 1 | Weak points shot off | |
| 2-1 | 2 | B04 flywheel auto | F04 shield wall | Melee weapon 1 | Flank or charge through |
| 2-2 | 2 | | F06 floater | Ammo-for-kills tool | |
| 2-3 | 2 | B05 precision | F09 turret walker | Destructible enemy guns | |
| 2-4 | 2 | | F07 brawler | Melee weapon 2 | Mini-boss: brawler pair |
| Boss 2 | 2 | | BOSS 2 | | |
| 3-1 | 3 | B06 heavy | F08 tank | | In the Foam dimension? [Paul] |
| 3-2 | 3 | B07 launcher | F10 flyer | Melee weapon 3 | |
| 3-3 | 3 | | F11 shielded elite, F12 ambusher | | |
| 3-4 | 3 | B08 special | F13 support | | Everything at once |
| Boss 3 | 3 | | BOSS 3 | | Finale |

Settings per act, story beats and the player character are [Paul] (PLAN.md
section 6).

---

## 3. Foamers

The behaviours come from the roster template in PLAN.md 4.2 (DOOM roles
are team shorthand only and never appear in the game). This trims it to 12
types plus 3 bosses (D3 A) and adds what each one teaches.

Health is in standard-dart hits (a standard dart does 1). Attacks marked
**P** are parryable (one glow colour, PLAN.md 3.2).

| # | Tier | Behaviour | Attacks | Teaches | Weak point | Health | First seen | Name | Look | Colour |
|---|---|---|---|---|---|---|---|---|---|---|
| F01 | Fodder | Slow, walks at you in groups | Bonk at close range | Shooting, finishers | none | 6 | 1-1 | [Paul] | [Paul] | [Paul] |
| F02 | Fodder | Climbs and keeps distance | Slow foam ball (P) | Parry | none | 8 | 1-2 | | | |
| F03 | Fodder | Small, fast, comes in packs of 4 to 6 | Nibble swarm | Spread blaster, staying mobile | none | 2 | 1-3 | | | |
| F04 | Fodder | Holds a shield wall, fires over it | Volley (P) | Flanking, shield charge | Shield can be carved away | 10 | 2-1 | | | |
| F05 | Heavy | Charges in a straight line, armoured front | Charge, stun on hit | Sidestep, shoot the back | Back | 30 | 1-4 | | | |
| F06 | Heavy | Floats slowly, spits blobs | Bouncing blobs, one big blob (P) | Shooting up, staggering | Mouth while open | 35 | 2-2 | | | |
| F07 | Heavy | Melee brawler, leaps and slams | Shockwave ring (jump it) | Dash timing | none | 45 | 2-4 | | | |
| F08 | Heavy | Slow tank | Walls of foam balls with gaps | Reading patterns | Two arm launchers | 80 | 3-1 | | | |
| F09 | Heavy | Turret walker, sustained fire | Stream of pellets | Using cover, carving cover | Its gun | 40 | 2-3 | | | |
| F10 | Elite | Flying, homing shots | Homing foam (P) | Prioritising targets | Its jets | 30 | 3-2 | | | |
| F11 | Elite | Shield that only a parry breaks | Combo, then a parryable finisher (P) | Parry mastery | Shield | 60 | 3-3 | | | |
| F12 | Elite | Hides in foam growths, leaps out | Pounce | Clearing growths, awareness | none | 25 | 3-3 | | | |
| F13 | Elite | Support: rebuilds other Foamers' foam | Heals allies | Target priority | Its tank | 25 | 3-4 | | | |
| BOSS 1 | Boss | [Paul] | 3 phases, weak points | Act 1 skills | Several | 300 | Boss 1 | [Paul] | [Paul] | [Paul] |
| BOSS 2 | Boss | [Paul] | | Act 2 skills | | 500 | Boss 2 | | | |
| BOSS 3 | Boss | [Paul] | | Everything | | 800 | Boss 3 | | | |

### 3.1 Parts and handicaps (Paul asked for this, 2026-10-31)

Every Foamer is built from parts that can be shot off. A part breaks when
its own health runs out; it falls off as a foam piece and the Foamer loses
what it did. Proposed defaults, for Paul to change per Foamer:

| Part | When it breaks | Damage taken |
|---|---|---|
| Leg (one) | Limps: half speed, cannot leap or charge | Normal |
| Both legs | Crawls at a quarter speed, can still attack | Normal |
| Arm (one) | Loses that arm's attacks (throw, punch, launcher held in it) | Normal |
| Both arms | Only a headbutt bonk left | Normal |
| Head | Aims badly (wide spread) and turns slowly | **Double** (weak point) |
| Ability part (launcher, jets, shield, tank, antenna) | Loses that ability (no ranged attack, cannot fly, no shield, cannot heal others) | Set per part |
| Body | Cannot break off: when total health runs out, the Foamer pops | Normal |

Any part breaking also staggers the Foamer for about half a second, which
opens a finisher (GAME-07). Damage to a limb also counts toward total
health, at half rate, so shooting limbs cripples first and kills second.

Per Foamer (proposal, matching the roster above):

| # | Parts that can break | Most useful part to break |
|---|---|---|
| F01 | Arms, legs, head | Legs (it is slow already: now it crawls) |
| F02 | Throwing arm, legs, head | Throwing arm (no more foam balls) |
| F03 | None (too small; pops in one or two hits) | |
| F04 | Shield (carved away), arms, legs | Shield |
| F05 | Legs, armoured front plate | Legs (no more charging) |
| F06 | Mouth flap, fins | Fins (it sinks and floats slower) |
| F07 | Arms, legs | Legs (no more leap slam) |
| F08 | Two arm launchers, legs | Each launcher removes half its foam wall |
| F09 | Gun, legs | Gun |
| F10 | Jets, arms | Jets (it falls and walks) |
| F11 | Shield (only by parry), arms, legs | Shield |
| F12 | Legs | Legs (no more pouncing) |
| F13 | Tank, arms | Tank (no more healing) |
| Bosses | Several each, by phase | [Paul] |

Cut from the template to save build time, easy to add back: the small
flying charger (template F04), the mini-boss brawler (template F14) and the
arena-boss role (template F15, folded into the act bosses).

**Design notes from the engine (for the looks):**
- Foamers are smoothed voxels, 5 cm each (ENG-09). Painted details such as
  eyes, stripes or a mouth need to be **about 3 voxels (15 cm) wide** or
  smoothing blurs them. Shapes can be any size up to about 1.6 m per body
  part; bigger Foamers are built from several parts.
- Parts can be shot off cleanly when they are separate pieces (PLAN.md
  7.3 point 6), so weak points work best as distinct parts: an antenna, a
  backpack, an arm launcher.
- Looks stay friendly (PLAN.md section 2): big eyes, round shapes, bright
  colours.

---

## 4. Blasters

Eight roles that cover the classic shooter spread without two blasters
doing the same job (D4 A). Mechanics are proposals; names, looks,
reference images and the cards themselves are Paul's (PLAN.md section 5
card template, `design/blasters/Bxx.md`).

| # | Role | Fire type | Ammo | Mag / reserve | Feel | Mod 1 idea | Mod 2 idea | Name | Reference |
|---|---|---|---|---|---|---|---|---|---|
| B01 | Starter | Pump | Standard | 8 / 40 | Punchy, priming rhythm | Charged shot (hold to prime harder) | Double pump: two darts per shot | [Paul] | [Paul] |
| B02 | Sidearm | Semi-auto | Standard | 6 / infinite | Quick backup, never empty | Burst of 3 | Suction mode: darts stick and slow Foamers | | |
| B03 | Spread | Pump, wide | Standard | 4 / 24 | Close-range crowd clearing | Tight choke | Bouncing darts | | |
| B04 | Flywheel auto | Full-auto | Standard | 35 / 175 | Hose of darts, spin-up | No spin-up | Mega burst every 10th dart | | |
| B05 | Precision | Bolt or spring | Precision dart (whistler) | 5 / 30 | Long range, weak-point killer | Zoom | Pierce: passes through one Foamer | | |
| B06 | Heavy | Spring-loaded | Mega dart | 3 / 18 | Slow, huge carve, staggers heavies | Charge-up | Mega carve on impact | | |
| B07 | Launcher | Launcher | Foam rocket | 1 / 8 | Area pop, blows up cover | Remote detonate | Cluster: splits into 4 | | |
| B08 | Special | Ball blaster | Foam balls | 12 / 60 | Bouncy, chaotic, ricochets | Hopper (bigger mag) | Bouncy balls bounce more | | |

**Ammo types (5):** standard dart, precision dart, mega dart, foam rocket,
foam ball. Suction is a mod (B02), not its own ammo, to keep pickups simple.

**The rest of the kit** (PLAN.md 3.2 and 3.4), all [Paul] for names and
looks:

| Item | What it does (Proposed) | Upgrade ideas |
|---|---|---|
| Shield (foam disc buckler) | Block, parry, throw to stun and ricochet, charge | Bigger parry window, throw hits more Foamers, charge knocks back further |
| Melee 1 (level 2-1) | Fast, light, combo hits | More charges |
| Melee 2 (level 2-4) | Slow, big area | Stagger bonus |
| Melee 3 (level 3-2) | Charged slam, knocks Foamers up | Shockwave |
| Ammo-for-kills tool (D9) | Suck up a weakened Foamer, get ammo | Faster recharge, works on heavies |

---

## 5. Upgrades (D6 A, D7 A)

Two layers, each simple enough for a 10 year old to understand at a
glance.

### 5.1 Blaster mods

- Each blaster has **2 mods** (section 4). A mod is found in the level
  where the blaster is introduced, or the next one.
- Each mod has **one upgrade** (for example "charged shot charges 30%
  faster"), bought with **points** (name [Paul]) on the between-level
  upgrade screen.
- A **mastery challenge** per mod (for example "pop 10 Foamers with a
  charged shot") unlocks a final bonus. Optional, for players who like
  goals.

### 5.2 Player upgrades

Bought with **tokens** (name [Paul]), one hidden in each level's secrets
(about 2 to 3 per level, so most players get most of them).

| Track | Levels | Effect per level |
|---|---|---|
| Health | 3 | +25 max health |
| Padding (armour) | 3 | +25 max armour |
| Ammo | 3 | +25% reserve for every blaster |
| Dash | 2 | +1 dash charge, faster recharge |
| Shield | 3 | Parry window, throw damage, charge distance |
| Finishers | 2 | More health from finishers, faster finishers |

That is 16 levels of upgrades against about 30 tokens hidden in the game,
so a thorough player maxes out in act 3 and a casual one gets most.

### 5.3 Points economy (rough)

- Points from pops (more for heavies and elites), finishers, parries and
  secrets. About 100 to 150 per level.
- A mod upgrade costs 100 to 200, so each level buys about one.
- Unspent points carry over. Replaying a level earns points again (good for
  younger players who want to catch up).

### 5.4 Collectibles (optional, replay hook)

- A toy figure of each Foamer, hidden once per act (PLAN.md 3.1).
- Codex entries ("Foam files", PLAN.md 6.2) unlocked by popping each
  Foamer type for the first time.

---

## 6. What this means for the build

- **P1 vertical slice** needs from Paul: 3 blaster cards (suggest B01
  starter, B03 spread, B04 flywheel auto) and 3 Foamers (suggest F01
  fodder, F02 ranged, F05 charger). These match PLAN.md tasks GAME-09 and
  GAME-10.
- Weapons, mods, upgrades, Foamer stats and the level table all go into
  `data/` JSON, so balance changes need no code.
- After Paul's answers: section 3 and 4 become `PLAN.md` 4.2 and 5.1, D1 to
  D11 go into the decisions log, and new task cards are written for the
  upgrade screen (UI-02) and the mod system (GAME-11).
