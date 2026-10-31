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
| D12 | How Foamers die (section 3.2) | **A. Three outcomes: most go down (topple, fizz, dissolve); a catastrophic killing hit (40% or more of max health in one hit) pops them into chunks; losing the head and an arm downs them whatever their health.** B. Pop only from explosives (B05 explosive mod, B06 every 5th, B07), never from a shotgun |
| D13 | Rating target, now that parts come off and Foamers look menacing | **A. Aim for ESRB E10+ / PEGI 12 ("non-realistic violence towards fantasy characters").** B. Keep PEGI 7: then no parts breaking off, only wounds and pops |
| D14 | Ammo for B06 and B07, both now on mega darts | **A. Keep five ammo types: standard, precision, mega, foam ball, and a launcher round for B07 (a mega dart with a foam warhead, its own pickup).** B. Four types: B06 and B07 share mega darts |
| D15 | B03 fire type: "pump" and "double barrel" | **A. Break-action double barrel: each trigger pull fires one barrel, both fired means reload (the 2 in 2 / 24); mod 1 fires both at once.** B. Pump-action with a 2-shell tube |

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

### 3.2 Wounds, going down and popping (Paul, 2026-10-31)

Paul: Foamers should not always explode when killed. Fodder especially
should "go down" with some foamy gore when it has taken enough damage, or
when its head and an arm are blown off. Explosive results are for
catastrophic damage only: close-range shotguns, massive impacts.

"Foamy gore" means foam, never body parts: every Foamer is foam all the way
through, with a **core colour** (Paul picks it; the sandbox uses pale
yellow) that shows wherever the surface is broken. No red, no fluids, no
bones or insides, no faces in pain, and nothing lies around for long.

| Stage | When | What you see |
|---|---|---|
| Wounded | Any hit | The hit carves a crater; the foam around it shows the core colour; a short fizz of foam bubbles from the wound |
| Part off | A part's own health runs out (or it loses 40% of its foam) | The part falls off as one foam piece, bounces and settles; both sides of the break show a core-coloured stump that fizzes for a second. The Foamer loses what the part did (section 3.1) and staggers |
| Goes down | Health runs out from an ordinary hit, or the head and an arm are both gone | It topples (forward on two legs, onto its side on four), limbs go limp, foam fizzes off it for about 3 s, then it sinks into the floor and is gone (about 5 s). A finisher on a downed Foamer is not needed: it is out |
| Pops | The killing hit alone is 40% or more of the Foamer's max health | It bursts into foam chunks (15 cm), the deep ones in the core colour, thrown away from the hit. Chunks bounce, settle and shrink away within 5 s |

Proposed numbers (all in `data/`, Paul to tune after trying the sandbox):

- **Catastrophic hit:** 40% of max health in one hit. A point-blank B03
  double blast or a B07 round pops fodder and most heavies; F08 (80) takes
  a 32-damage hit, so it usually goes down instead. Shots to the head count
  double, so a big head shot pops more often.
- **Part health:** a share of the Foamer's health. Head 30%, legs 25%,
  arms 20%, weapons and ability parts 25%, fins and armour details 15%
  (minimum 2 darts). Damage to a part also counts toward total health at
  half rate; the head at double (section 3.1).
- **Bodies on the floor:** at most 8 downed Foamers or loose parts at once;
  the oldest sinks early. Pop chunks share the debris cap.
- **Finishers (GAME-07)** stay as they are: a staggered Foamer can be
  finished, and the finisher always pops it (it is the player's choice to
  be dramatic).

Try it: the sandbox (`/sandbox`) has Dart, Heavy and Blast buttons. Click a
Foamer to shoot it. The rules there are a preview; the game's version is
ENG-10.

### 3.3 Looks: the menace pass (Paul, 2026-10-31)

Paul asked for more visible weapons on the Foamers and a general menace
overhaul. The sandbox greyboxes now follow these rules; they are shape
proposals for Paul's looks, not designs.

- **Faces:** angry eyes (a heavy lid slanting down toward the middle),
  slit eyes for helmeted or visored Foamers, toothless mouths (a wide grin
  with the corners up, or a gaping hole). No teeth, no claws with points.
- **Posture:** heads low and forward, shoulders hunched, legs bent.
  Nothing stands up straight like a toy on a shelf.
- **Weapons you can see:** every Foamer that attacks carries the thing it
  attacks with, so players read the threat before it fires, and so it can
  be shot off (section 3.1). Weapons are toy-like: tubes with orange
  muzzles, foam clubs, foam spikes with round tips.
- **Spikes are foam nubs:** rounded cones on backs, shoulders, maces and
  fists.
- **Greybox colours:** grey is foam, dark grey is gear and weapons, orange
  marks muzzles and throwables, pale yellow is the foam core. Real colours
  are Paul's (D5).

| # | Greybox shape (sandbox) | Weapon you can see | Breakable parts |
|---|---|---|---|
| F01 | Hunched grunt, jutting head, long arms with elbows | Foam club in the right hand | Head, arms, club, legs |
| F02 | Lanky, knees and elbows, satchel of balls on its back | Foam ball held ready (orange) | Head, arms, legs, satchel |
| F03 | Small four-legged biter, spined back, gaping mouth | Its mouth | None (pops in 1 or 2 hits) |
| F04 | Visored trooper, riot shield on the left forearm | Blaster on the right forearm, over the shield | Shield, blaster, arms, legs |
| F05 | Low bull, head down, horns forward, armour plate, spined back | Horns | Horns, plate, legs |
| F06 | Spiky floating ball, gaping mouth with a jaw, three tendrils | Mouth (jaw drops to spit) | Jaw, fins, tendrils |
| F07 | Gorilla stance, tiny head sunk in the shoulders | Huge fists with knuckle nubs | Fists, arms, legs |
| F08 | Huge, shoulder spikes, ammo drum on its back | Two launcher arms (orange muzzles) | Launchers, drum, legs |
| F09 | Spider legs with knees, low body | Twin-barrel turret | Turret barrels, legs |
| F10 | Visored flyer with jets and wings | Wrist launcher | Jets, wings, launcher arm |
| F11 | **Rebuilt (Paul: "janky", wanted larger and more ominous):** a 3.4 m armoured knight. Horned helm with slit eyes, spiked pauldrons, belt, bent legs with boots, a cape | Spiked tower shield (left), spiked foam mace (right). Combo: overhead slam, sweep, then a slow high wind-up (the parry window) and a full-body slam | Shield (parry only), mace, arms, legs, helm |
| F12 | Long low stalker, spined back, jointed legs, tail, gaping head | Its pounce | Legs, tail |
| F13 | Hooded medic, foam tank and antenna on its back | Spray wand (core-coloured tip) | Tank, antenna, wand, arms |

Movement no longer snaps between phases (walk to throw, coil to pounce):
every style blends over 0.15 s, and a test checks that no joint jumps.

**Blocks (Paul, 2026-10-31):** Foamers, wounds and pop chunks are blocky
voxels. Smoothing was compared in the sandbox and removed.

Cut from the template to save build time, easy to add back: the small
flying charger (template F04), the mini-boss brawler (template F14) and the
arena-boss role (template F15, folded into the act bosses).

**Design notes from the engine (for the looks):**
- Foamers are blocky voxels, 5 cm each. Painted details such as eyes,
  stripes or a mouth can be as small as one voxel, though 2 to 3 voxels
  read better at a distance. Shapes can be any size up to about 1.6 m per
  body part; bigger Foamers are built from several parts.
- Parts can be shot off cleanly when they are separate pieces (PLAN.md
  7.3 point 6), so weak points work best as distinct parts: an antenna, a
  backpack, an arm launcher.
- Looks stay 'foamy', but range from friendly to menacing, if not quite 'pure evil': big eyes, toothless mouths, rounded shapes combined with weapons, bright
  colours. (Paul, 2026-10-31; section 3.3 has the rules the greyboxes follow.)

---

## 4. Blasters

Eight roles that cover the classic shooter spread without two blasters
doing the same job (D4 A). Mechanics are proposals; names, looks,
reference images and the cards themselves are Paul's (PLAN.md section 5
card template, `design/blasters/Bxx.md`). See design/referenceimages/ for shape inspiration, colors are flexible.

The reference images are product photos with other companies' logos on
them, so they stay on Paul's machine: `design/referenceimages/` is
gitignored, like `reference/`. They guide feel and function (a break-action
double barrel, a drum-fed gatling, a bipod heavy); the game's blasters
must not copy any one product's silhouette or markings (PLAN.md section 2).

| # | Role | Fire type | Ammo | Mag / reserve | Feel | Mod 1 idea | Mod 2 idea | Name | Reference |
|---|---|---|---|---|---|---|---|---|---|
| B01 | Starter | Pump | Standard | 8 / 40 | Punchy, 3 darts per shot | slugs- heavy single shot that can punch holes in enemies | Double pump: 6 darts per shot - changes mag to 12/40 | The Dartman | B01reference.webp |
| B02 | Sidearm | Semi-auto | Standard | 6 / infinite | Quick backup, never empty | Burst of 3 | heavy rounds- slower firing, much larger impact and damage | Musketeer | B02reference.webp |
| B03 | Spread | Heavy shotgun, Pump, wide | Standard | 2 / 24 | Close-range heavy/elite melting, double barrel - ammo is treated as shotgun shells, firing many darts for each expended ammo | Fire both barrels at the same time | quad barrel- adds 2 more barrels, same reload time, adding utility/effectiveness | Leviathan | B03reference.webp |
| B04 | Flywheel auto | Full-auto | Standard | 35 / 175 | Hose of darts, high recoil increases spread and upward drift with each shot- but burts feel accurate | Recoil suppression making it feel like an *accurate* hose | Every 5th shot bounces to another target | Shredder | B04reference.webp |
| B05 | Precision | Bolt or spring sniper, zoom | Precision dart (whistler) | 5 / 30 | Long range, weak-point kille, piercing rounds | Explosive rounds | heavier rounds which pierce through multiple enemies | Shrike | B05reference.webp |
| B06 | Heavy | Full-auto | Mega dart | 60 / 120 | Slower rate of fire than B04, but shots are considerably more damaging | Increased rate of fire | Every 5th dart is explosive | The Standard| B06reference.webp |
| B07 | Launcher | Pump | Mega dart | 5 / 15 | Arcing shot, area explosion, blast can push enemies | Remote detonate | Cluster: splits into 4 smaller explosions after initial blast | Collateral | B07reference.webp |
| B08 | Gatling | Room-clearing 'final word', spins up to fire at an incredible rate | Foam balls | 120 / 240 | Massive power, recoil, chaotic, ricochets, slows movement when firing | Recoil control and reduced movement penalty | Add a second barrel for 2x fire rate | Firehose | B08reference.webp |

**Ammo types:** standard dart (B01 to B04), precision dart (B05), mega
dart (B06, B07), foam ball (B08). B07 used to fire foam rockets; with
Paul's change to mega darts, D14 decides whether its round is its own
pickup. Suction darts are no longer a B02 mod (Paul replaced it with heavy
rounds); the suction darts already built stay as a test dart type until
something else uses them.

**Notes on Paul's blaster changes, for the cards:**

- B01 "slugs" punch holes in Foamers: a big carve radius and pierce through
  thin parts (an arm), which ties in with parts breaking off (section 3.1).
- B03 is now the heavy and elite killer: many darts per shell at close
  range, which makes it the main way to pop heavies (section 3.2). Its
  fire type is D15.
- B04 recoil (spread and upward drift that grows during a burst) and B08
  spin-up and movement slow are new mechanics for the blaster system
  (GAME-09); worth testing early on B04.
- B05, B06 and B07 all gain explosive options. Explosions should carve
  terrain and Foamers alike and are the other main way to pop.
- The names are Paul's. Before launch, check each one isn't another toy
  or game company's product name.

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
