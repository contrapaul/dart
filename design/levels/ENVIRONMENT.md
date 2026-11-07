# DART environment and terrain elements

Status: **proposal, ENV-00, 2026-11-07**. Design notes only, no game
code. Candidates for Paul to approve, change or cut.

Read with `PLAN.md` 2 (content rules), 3 (combat), 7.3 (destruction) and
9 (level design), `design/levels/README.md` (the pillars), `KIT.md`
(connectors, destructibles, budgets) and `design/CONTENT-PLAN.md` 3
(the Foamers) and 4 (the blasters).

Every number here is a proposal. Names, looks and settings are Paul's:
each element carries a `[Paul]` note where a name or an in-fiction look
is his to give. Nothing here is a fluid, a fire, an electric shock or
anything that reads as horror: foam and toys only, audience 10+.

---

## 1. What already exists

The game has terrain pieces today. This section is the base the
candidates build on, so Paul can see what a candidate adds and what it
would reuse.

| What | Where the code is | What it does |
|---|---|---|
| Shell boxes | `src/level/format.ts` (`ShellBox`), `src/level/build.ts` (`addShell`) | Floors, walls and ceilings as fixed meshes with fixed colliders. Never destructible. README pillar 10: the spine floor is shell, never voxels |
| Ramps | `src/level/build.ts` (`addRamp`) | A slab whose top face rises `rise` metres along its own +z, drawn and collided as one turned slab |
| Doors | `src/level/format.ts` (`Door`), `src/level/build.ts` (`DoorHandle`) | Two panels, three states: open, locked, sealed. Locked is a lock-in pulse; sealed never opens again |
| Destructible pieces | `src/level/format.ts` (`Piece`, `PieceKind`), `src/voxel/pieces.ts` | Voxel volumes anchored to floor, wall or ceiling: cover, plug, blast wall, island, growth, ceiling. Each volume is at most a 3.2 m cube of 0.1 m voxels (`data/destruction.json`, KIT 5) |
| Carving | `src/voxel/carve.ts`, `src/voxel/islands.ts` | A dart or an explosion carves a sphere out of the voxels; a part that loses its anchor falls off as its own rigid body |
| Debris | `src/voxel/debris.ts` | Capped foam chunks (`debris.max` 150, 14 per carve, 4 s life) |
| Rifts | `src/arena/rifts.ts`, `Rift` in the format | The wave spawn: a glowing seam in a wall, floor or ceiling, dim before the lock, open with it |
| Arena lock-in | `src/level/arena.ts`, `src/level/level-runner.ts` | A trigger box that shuts doors and starts waves, `noLock` for a chase, `escape` for a one-way drop out |
| Exit pad | `src/arena/extras.ts` | A lit box behind the last door that ends the level |
| Pickups | `src/pickups/pickups.ts`, `Pickup` in the format | Ammo, health, armor, token, toy: a blob on the floor, collected within a radius, capped at 8 on the floor (KIT 6) |
| Nav grid | `src/ai/nav-grid.ts` (`data/ai.json` `nav`) | A baked grid of walkable cells, 0.25 m, up to 4 layers per cell, re-baked where a carve changes the world. A Foamer paths on it |

So the base is: a static shell, a destructible voxel layer on top, doors
and rifts as the only moving things, and a nav grid that follows carves.
Anything that moves the floor itself, or that the player sets off, is new.

Two rules from the base shape every candidate below:

- **The nav grid is the limit, not the look.** A Foamer walks on baked
  cells: it can step up 0.2 m automatically (a climb up to 0.45 m counts
  only as a step onto a surface, and the autostep refuses more than 0.2 m),
  it will not walk a slope over 40 degrees, and it needs 0.35 m of radius
  and 1.6 m of height clear. Anything the player crosses but a Foamer
  cannot becomes a place Foamers stand still, which KIT 3 calls out for
  the ledge climb.
- **The caps are hard.** 6 destructible zones per arena, 150 live debris
  bodies, 12 Foamers alive at Normal, 8 pickups on the floor. An element
  that spawns objects has to fit inside one of those or bring its own cap.

---

## 2. Candidates

Thirteen candidates, at least one of each kind the card asks for. Cost is
what it takes to build and to hold at 60 fps: **S** is under a day and no
new system, **M** is two to four days and one new system, **L** is a week
or more or touches the nav grid or the physics step.

| ID | Kind | What it is | Cost |
|---|---|---|---|
| E01 | Destructible | Foam cladding on a shell column or wall: a voxel coat over a fixed shell piece | S |
| E02 | Destructible | Toy crate stack: three loose crates that topple and pop, not carved | S |
| E03 | Hazard | Foam spray vent: a puff of foam that shoves the player off a line | S |
| E04 | Hazard | Sticky foam patch: a floor blob that slows whoever stands in it | S |
| E05 | Movement | Spring pad: a foam pad that throws the player up and along | S |
| E06 | Movement | Collapsing shelf: a foam ledge that drops a moment after it is stood on | M |
| E07 | Movement | Ferry ledge: a platform that runs a short track on a timer | L |
| E08 | Interactive | Toy button: a big plunger the player hits or walks into | S |
| E09 | Interactive | Dart target trigger: a foam target that does the thing when shot | M |
| E10 | Changing cover | Toppling foam wall: a hinged panel that falls when its latch is shot | M |
| E11 | Changing cover | Rising bollards: foam posts that pop up from the floor on the lock | M |
| E12 | Station | Ammo station: a fixed refill point with a cooldown, not a one-shot box | M |
| E13 | Station | Upgrade station: the U1 and U2 alcoves the level docs already mark | M |

Every paragraph below names what the element teaches, which Foamers and
blasters it pairs with (IDs from `design/CONTENT-PLAN.md` 3 and 4), which
pillar of `README.md` it serves, and the risk it carries.

### E01 Foam cladding (destructible, S)

**What it is.** A 0.4 to 0.8 m coat of foam voxels over a shell column,
wall corner or pillar, fixed to the shell so it has an anchor. The shell
underneath is ordinary and indestructible, so a shell column that breaks
reads as "the foam came off it", never as "the building fell down". Look:
a thick foam sleeve in one of the factory colours, visibly softer and
lumpier than the shell, with a bottom lip a few centimetres off the floor.

**What it teaches.** That cover is temporary and that the wall behind it
is not. A player who shoots the coat away opens a shooting lane and loses
cover at the same time, which is the A7 Crossroads pillar lesson made
cheap. Pairs with F09 Crawler (a sustained stream eats cladding in one
burst) and F04 Blocker (a coat in front of the shield wall is worth
shooting down before flanking). Pairs with B04 Shredder and B06 The
Standard as the two blasters whose job is chewing, and with B03 Leviathan
for taking a whole coat in one double blast.

**Pillar.** 6: destruction changes the route and sight lines, on a shell
that stays.

**Code.** `Piece` already covers it (`kind: "cover"`, `anchor: "wall"`).
A piece may not exceed a 3.2 m cube, so a tall column is two or three
pieces, which costs zones against the 6-per-arena budget. The nav grid
needs no change: a coat is out of the walking volume, and a re-bake
follows the carve already.

**Risks.** Zone budget: a clad column is 2 to 3 of 6 zones, so a room
gets one clad column, not four. Debris: a coat over a big face is a lot
of carve in one place, so keep the coat small (KIT 5: no more than 6
adjacent zones). Readability: a coat must be obviously soft, or a player
will think the wall is breakable all the way through and keep shooting.
Age rule: fine, it is foam falling off a toy wall.

### E02 Toy crate stack (destructible, S)

**What it is.** Two or three loose toy crates in a low pyramid (1.0 to
1.4 m), each one a small voxel volume with no anchor to the floor, so
losing the bottom crate topples the top ones. Look: a stack of chunky
toy boxes in three factory colours, with a printed side [Paul: the
print], rounded edges, a little taller than the player's knee.

**What it teaches.** Two things at once: a stack is cover you can walk
over (KIT 5's low crate stack is below the 1.5 m mantle) and a stack is
cover that moves when you shoot it. It is also the cheapest place to
teach "loose foam falls", because nothing is behind it and failing costs
nothing. Pairs with F03 Swarmer (the stack breaks a swarm's line for a
moment) and F05 Darter (a Darter's charge hits a stack and stops, a wall
stun in everything but name). Pairs with B01 The Dartman's slug mod: one
slug and the stack is a pile.

**Pillar.** 5 (the floor is a tool: 1.2 m of crate is a step for the
player and a wall for a crawling Foamer) and 6.

**Code.** `Piece` with `anchor: "floor"`; `src/voxel/islands.ts` already
turns a disconnected part into its own rigid body, which is exactly the
topple. Nothing new.

**Risks.** The islands cap is 16 pieces and 6000 searched voxels per
carve, so a stack is 3 pieces and cannot grow into a crate wall. A
toppled crate can block a lane the player needs: keep stacks off the
critical path (README pillar 10, and KIT 5 already allows only a plug on
the spine). A crate that lands on the nav grid changes cells, so the
re-bake must follow a settled island: today it follows a carve, which is
the same thing here.

### E03 Foam spray vent (hazard, S)

**What it is.** A round vent in a floor, wall or ceiling that puffs a
short, wide cone of foam crumbs and air for about a second on a timer
(four on, two off, say). It does no damage: it shoves. On the floor it
lifts and pushes the player and any loose debris; on a wall it pushes
sideways across a lane; in a ceiling it hoses foam down. Look: a
washing-machine-size round grille in foam-white with a soft rubber lip,
and a puff of confetti-sized foam crumbs when it fires. Nothing burns,
nothing sparks.

**What it teaches.** Movement under pressure that is not an enemy. A vent
in the middle of a bridge or a narrow lane is a timing puzzle with no
death attached, which is the right difficulty for Act 1. It also moves
loose foam, so a player learns that debris is not scenery. Pairs with F05
Darter (a vent that pushes the player into a charge line, or out of one)
and F08 Trawler (a vent that spoils the one safe gap in its wall of
balls). Pairs with every blaster equally: it is a movement element, not a
target.

**Pillar.** 5 (the floor is a tool) and 1 (push forward: the vent makes a
camping spot bad without hurting anyone).

**Code.** No new system if the puff is a kinematic push: a trigger volume
that adds a push to the player controller's wish for the puff's length,
the same place the shockwave ring reports to now (`src/foamers/`, the
`onChargeHit` pattern). Debris gets the same push through Rapier
`applyImpulse`. The vent itself is a draw-only mesh plus a timer.

**Risks.** A push over a 9 m drop is a fall (KIT 3 caps a drop at 9 m),
so a vent sits away from a lethal edge or the puff is small. The player
must see it before it fires: a 0.4 s wind-up with the grille glowing is
the telegraph, the same rule the Foamers' attacks follow. Age rule: fine,
it is air and crumbs. Readability: a shove while the player is looking
down a sight line reads as a bug unless the telegraph is loud, so the
first one goes in a breather room with nothing shooting.

### E04 Sticky foam patch (hazard, S)

**What it is.** A 2 to 3 m blob of soft foam stuck flat to the floor, or
a patch of it under a ceiling vent. Walking into it slows the player to
about 60 per cent for as long as they stay in it and for a moment after.
It does no damage and never holds the player still. Look: a low, shiny,
slightly domed puddle of half-set foam in a bright colour, with crumbs
round the rim, visibly tacky. [Paul: the colour, and whether it has a
print in it]

**What it teaches.** That a route has a cost, and that the player should
choose between crossing a slow patch and going round. It reads in half a
second and it never kills, which makes it the gentlest teaching element
in the list. Pairs with F05 Darter (a slow patch inside its charge line
is a trapped corridor) and F03 Swarmer (the pack is fast, the player is
not). Pairs with B03 Leviathan: a player who is slowed wants a blaster
that ends the fight in one double blast.

**Pillar.** 5, and 1: the patch makes standing on the obvious spot bad.

**Code.** A trigger volume that sets a speed multiplier on the player
controller, read from `data/` so the slow and the patch size are tuning.
Foamers need not be affected (keep the rule simple), but if they are, the
same multiplier on `f.speed()` is one line. A decal plus a low mesh, no
physics.

**Risks.** If it is invisible from above it is a trap, so the patch is
always a colour no floor uses and it has crumbs round the rim. In a
falling-to-a-drop room the slow must not be the difference between
clearing a 6.5 m gap and not: keep the patch out of every jump line
(README rule 8). Age rule: fine. Readability: do not put one under a
pickup, or the player takes it by accident and learns nothing.

### E05 Spring pad (movement, S)

**What it is.** A round foam pad, about 1.2 m across, that launches the
player up and forward when stepped on (about 6 m up and 8 m along, more
than a sprint jump's 7.1 m). It re-arms after half a second. Look: a
trampoline-ish disc in a bright colour with a bouncy rim, and a squash
and a bounce when it fires. [Paul: the look and the sound]

**What it teaches.** That the kit can go places the player's jump cannot,
which is the base for every vertical route in the list. Use it to reach a
ledge 3 to 4 m up (above the player's 1.5 m mantle) or to cross a gap
wider than 6.5 m. Pairs with F06 Floater and F10 Turbo (the pads get the
player up to a flyer's height, which turns "shoot up" into "come up").
Pairs with B05 Shrike: the high ledge a pad reaches is a sniper's nest.

**Pillar.** 5 (the floor is a tool) and README rule 8 (nothing the player
cannot solve with the kit they have).

**Code.** A trigger volume that sets the controller's vertical velocity
and the wish direction, the same field the vent pushes. The pad is a
mesh plus squash animation. No nav grid: Foamers never use pads, so every
pad route must have a Foamer route beside it (KIT 3's ledge-climb note).

**Risks.** A pad that reaches a place with no way down is a soft lock
unless the drop is survivable (9 m cap) or there is a second pad. A pad
in a small room is a head bump, so keep 5 m of headroom. Age rule: fine,
and a spring pad is a toy by nature.

### E06 Collapsing shelf (movement, M)

**What it is.** A foam shelf, 2.5 to 3.5 m wide and 0.4 m thick, jutting
from a wall at 1.8 to 2.6 m. It holds for about a second after the player
(or any weight) is on it, trembles, then breaks off as one slab and falls.
It comes back after six seconds, from a foam drip at the wall (the drips
are draw-only). Look: a shelf of dense pale foam with a visible crack
line along its root and crumbs that shed while it trembles.

**What it teaches.** That a route can be a pace, not a place. A player
who wants a secret ledge crosses three shelves in a rhythm; a player who
stops to shoot from one is dropped. That is the Crossroads lesson (fight
position is temporary) without any enemy needed. Pairs with F06 Floater
and F10 Turbo, which punish standing still in the open, and with F09
Crawler, whose stream a player can outlast by moving along a shelf line.
Pairs with B05 Shrike and B02 Musketeer: light, quick blasters for a
moving fight; B06 The Standard is the wrong tool on a shelf, which is
itself a lesson.

**Pillar.** 5 (the floor is a tool) and 6 (the route changes).

**Code.** New, but small: a shelf is a piece with an anchor to the wall
and the same island path a carve already uses, driven by a timer instead
of a carve. `src/voxel/islands.ts` builds a rigid body when a part loses
its anchor; here the root simply goes away after standing for
`holdSeconds`. Timing in `data/`. Respawn: rebuild the volume and its
mesh, which `pieces.ts` already does at level start.

**Risks.** Timing under load: a tumbling slab is a physics body, so it is
capped with the 150 debris budget and must despawn. A shelf that drops a
player into a pit is a death the player did not see coming, so a shelf
route never crosses a lethal drop without a lower ledge. The nav grid: a
shelf at 2 m is not walkable ground for a Foamer anyway, so no bake
change. Age rule: fine.

### E07 Ferry ledge (movement, L)

**What it is.** A platform, 3 by 3 m (the size of KIT's lift), that runs
a fixed straight track of 6 to 10 m every few seconds, carrying whoever
stands on it. Unlike a lift it never answers a call: it is a rhythm to
time, not a button to press. Look: a flat foam raft with a low rim, on a
groove in the floor or a rail in the wall, with a slow float and a clunk
at each end. [Paul: whether it is a raft or a skip on a rail]

**What it teaches.** That the space itself moves, which no combat element
in the list does. It makes a fight where the ground is honest about being
temporary, and it is the natural partner for the Pit and the Bridge
archetypes. Pairs with F06 Floater and F10 Turbo (flyers against a moving
floor, the player keeping their feet is the fight) and F07 Brawler (its
shockwave ring under a moving ferry is a jump-and-keep-balance beat).
Pairs with B04 Shredder (recoil push on a moving platform is a real
trade-off) and B07 Collateral (an arcing shot from a moving floor).

**Pillar.** 5 and 1 (the arena does not sit still, so neither can the
player).

**Code.** The only L in the list, and it is L for one reason: a moving
floor needs the player controller to ride a kinematic body, and the nav
grid to treat the ferry's cells as walkable while it is at each stop. The
lift in KIT has no code today, so this is the same machinery: a Rapier
kinematic body, the player stood on it inherits its velocity, Foamers
never ride it. Build it once and the lift, the ferry and any moving cover
share it.

**Risks.** Highest risk in the list, and the card should not recommend it
first. A player who is not carried with the ferry slides off, which reads
as a bug; getting the ride right is most of the cost. A ferry over a drop
is a timing death, so the first one travels over a floor, not a pit.
Readability: the track must be visible (a groove in the floor) or players
will not know it moves. Age rule: fine.

### E08 Toy button (interactive, S)

**What it is.** A big, palm-size-to-fist-size plunger on a stand at chest
height, with a rubber dome that squashes when hit by a dart, a melee
swing or a body. It fires once, sets a light to the accent colour, and
does one visible thing: opens a door, starts a lift, drops a plug, turns
a vent on. It cannot be pressed twice by accident (a second press only
replays the sound). Look: a toy plunger on a short post, bright, with a
squash animation and a click.

**What it teaches.** That the room answers the player. A button is the
cheapest way to make a space feel like a toy machine rather than a maze,
and it lets a level gate a route behind a shot the player chose to take
rather than behind a lock. Pairs with everything: it is the only element
here that is pure control. It is the natural partner for B02 Musketeer
(the infinite, accurate plinker) and B05 Shrike (a button across a gap is
a reason to zoom).

**Pillar.** 5 and 6. Also README rule 5: light is the arrow, so a pressed
button lights the thing it did.

**Code.** New and small: a trigger box with a `onHit` (darts already
report hits on fixed bodies, per the sticking-dart work) that calls one
action. The action is the same verb a lock-in already uses (close doors,
seal, open doors), so the button is a wiring layer, not a new system.
Actions come from `data/`.

**Risks.** A button that opens a door the player already went through is
noise, so each one does something the level shows. A button is a route
gate, so it must never sit behind something destroyed into an unwinnable
state (README wayfinding 6). If a button is the only way on, the level
must show it from the lock (pillar 1). Age rule: fine, and pressing a big
noisy button is the most 10+ thing in the list.

### E09 Dart target trigger (interactive, M)

**What it is.** A round foam target on a wall or a running rail, like the
targets a dart gun set comes with, with three rings. Hitting the bull
carves it (one dart, no debris), rings it and starts whatever it is wired
to; hitting an outer ring wobbles it and counts nothing. Look: concentric
rings in three factory colours on a foam disc, a small stand or mount,
and a satisfying thunk. [Paul: the print and the sound]

**What it teaches.** That aiming is a verb the level can ask for, and
that a precise blaster has a use outside of Foamers. It is the element
that makes a still room interesting, and it is a natural secret gate
(KIT 4, type 2). Pairs with B05 Shrike and B02 Musketeer most of all;
B03 Leviathan is a joke on it (a slug covers the whole disc, so it counts
as a bull, which is fine and funny once). Pairs with F09 Crawler: a
target behind a stream is a shot under fire.

**Pillar.** 5, 6 and the secret rule (KIT 4 type 2).

**Code.** M because it needs a hit-test with a ring: the dart hit already
tells us the point, so the ring is a distance from the disc centre.
Carving the bull means the target is a small piece and can be spent, or
the target is a mesh and the "carve" is a swap to a holed mesh. Wiring is
the same as E08.

**Risks.** A target that resets forever invites grinding a secret; one
that stays spent is finite, which is the right call. A target at the end
of a sight line down a corridor becomes a sniping joke with a zoom, so
raise or occlude it. Two targets wired to one thing can be solved by
shooting the easier one: decide whether that is the intent. Age rule:
fine.

### E10 Toppling foam wall (changing cover, M)

**What it is.** A panel of dense foam, 3.2 m wide by 2.4 m tall by 0.4 m,
hung on a latch at the top of a doorframe or standing upright on a foam
foot. The latch is a small latch-plate the size of a fist; shoot it, punch
it, or hit it with a B03 blast and the panel falls forward along its hinge
line and lies flat. It is not carved (a dart does not chew through it);
it is a whole object that moves. Look: a hinged toy wall in one factory
colour with a visible hinge and a metal-looking latch in an accent colour
so the target reads.

**What it teaches.** That cover can be taken away in one deliberate act
rather than a long stream. It is the cleanest expression of "changing
cover" in the list: the player sees a wall, sees the latch, and chooses.
It also lets a level open a road the player made themselves, which is the
Crossroads pillar by hand. Pairs with F04 Blocker (a toppled panel exposes
a shield wall's flank) and F09 Crawler (the panel was the only cover from
the stream). Pairs with B03 Leviathan (one shell ends it) and B06 The
Standard (chews the foot instead, if a player prefers that).

**Pillar.** 6 (destruction changes the route) and 3 (a fight entered by
choice: the panel falls when the player says so).

**Code.** M: a hinged rigid body with a joint, plus a latch that reports
a hit (same hit path as E08/E09). The panel is one mesh and one collider,
not voxels, so it costs no zone; but it is a moving collider on the nav
grid, so the bake must treat its fallen footprint as a wall. That is the
same re-bake the carve already triggers.

**Risks.** A fallen panel changes the nav grid, so a Foamer path may need
a re-bake on the area; schedule it on the settle, not the fall. A panel
that lands on the player can shove or squash: make it push, never crush.
A panel that falls on the critical path must not block it (it lies flat;
keep it out of the 2.1 m vent tunnels). Age rule: fine, and a falling
toy wall is a comedy beat, not horror.

### E11 Rising bollards (changing cover, M)

**What it is.** A row of four to six foam posts, 0.5 m square and 1.4 m
tall, sunk in the floor. On the arena lock they rise with a thunk in half
a second; on the clear they sink again. They are indestructible shell.
Look: rounded foam posts with a bright cap, and a dusting of crumbs round
the base when they rise.

**What it teaches.** That the arena itself answers the lock. It turns an
open hall into a cover maze the moment the doors close, which is a strong
opening beat for a Hall (A4) or a Yard (A6), and it makes the lock feel
like a trap the Foamers set. Pairs with F05 Darter (posts cut a charge
line into a lane the player can bait) and F08 Trawler (posts give cover
against the ball wall). Pairs with B04 Shredder (cover that arrives is a
reason to hold a lane) and B07 Collateral (an arcing shot over a rising
post row).

**Pillar.** 3 (the lock is a door you see close, now with the floor
answering too) and 5.

**Code.** M: a post is a shell box that moves between two heights on the
lock and the clear. Because it is shell and not voxel, no zone is spent
and no carve applies. The nav grid must re-bake where the posts rise and
sink, or a Foamer walks through them for a frame; a post that rises under
a Foamer is a real bug, so posts rise with a 0.4 s wind-up and shove
rather than clip.

**Risks.** A post that rises under the player lifts them, which may be
fun once and annoying after; keep posts out of the lock's own doorway and
the first 2 m of the trigger. The nav re-bake cost: four to six posts is
two re-bakes per arena, and the grid bake is already on the carve budget,
so check the frame time on the base Mac. Readability: posts in shell
colour vanish against the floor, so give them a cap colour no floor uses.

### E12 Ammo station (station, M)

**What it is.** A wall mount with a lit trough, 1 m wide, one per ammo
type the level uses. Standing in front of it for a moment refills that
ammo to the level's cap; then it goes dark and recharges over 20 s. It is
not a pickup: it never disappears, it never sits on the floor (so it does
not count against the 8-pickup cap) and a player always knows where ammo
lives. Look: a foam trough with a row of dart-shaped lamps, one per
charge left, that fill in as it recharges. [Paul: the look and the lamp
idea]

**What it teaches.** That a level has a home base, and that ammo is a
route decision, not a drop. Two stations 20 m apart make the player
choose which side of the hall to fight on. That is a strong, cheap lever
and it is what the 1-4 station table (A1 to A7) is already asking for.
Pairs with B04 Shredder and B08 Firehose, the two blasters that run dry
first and most; B02 Musketeer and B01 Dartman need one least, so a
station is also a way to make the heavy blasters playable without
flooding pickups.

**Pillar.** 1 (push forward: a station forward of the fight is a reason
to advance) and 5.

**Code.** M because it needs a station registry: a point, a radius, a
refill amount, a recharge timer, shared by the arena and the HUD. The
refill itself is one call into `src/pickups/pickups.ts` (its
`blasters` handle already adds ammo). The lights are draw-only.

**Risks.** A station in the arena is a camping spot, which pillar 1
hates: put stations outside the lock or where a fight reaches them, and
never a health station inside an arena (that is the classic
regeneration loop). The recharge must be legible or players stand on it
waiting, so the lamp count is the whole tell. Age rule: fine.

### E13 Upgrade station (station, M)

**What it is.** The U1 and U2 alcoves the 1-4 level already marks: a
niche in a wall 1.2 m wide, lit, holding one of the shield mods or a
blaster mod. Walking in and holding for a moment swaps or grants it, once
per station. Look: a foam alcove with a bright rim and the mod shown as a
small sculpted part on a stand; the alcove goes dim once spent. [Paul:
the mod list and which ones are stations rather than drops]

**What it teaches.** That the kit grows at places the level chose, and
that an alcove is worth a detour. It is the element that makes a secret
worth finding (KIT 4) pay in the kit, not only in tokens. Pairs with B03
Leviathan's quad mod, the shield's parry and throw, and B01 Dartman's
slug mod. It also pairs with the F04 Blocker and F11 Seawall, the two
Foamers that a shield answer is built for: a player who took the parry at
a station meets the Blocker on fair terms.

**Pillar.** 1 and 5, and KIT 6 (mods live in the world, not in a menu).

**Code.** M: it shares E12's station registry (point, radius, hold,
spent flag) and calls the mod grant the weapon system already has. The
spent state is per level run, so a restart resets it, which the arena's
checkpoint restart already does for doors.

**Risks.** A station the player walks past is a wasted authoring day, so
it sits where the level's light arrow points (README wayfinding 1 and 3).
If two stations can grant the same mod the level must say which wins; the
simple rule is one grant per mod per run. A mod that changes balance mid
level needs a way to lose it: keep station mods for the run only, which
is what the shield already does.

---

## 3. Recommended first set

Five elements, in build order. The test used to pick them: does the
element teach something the README pillars say a level must teach, does
it cost no more than an M, and does it reuse machinery the game already
has so the first level can carry it this milestone.

| Order | ID | Element | Why first |
|---|---|---|---|
| 1 | E01 | Foam cladding | Free: it is the existing `Piece` code with a wall anchor. It gives the first two levels a destructible that looks like the wall, which is the Crossroads lesson at its cheapest |
| 2 | E02 | Toy crate stack | Free for the same reason, and it teaches the 1.2 m step and the falling part. It is the safe place to prove the island rigid body feels right |
| 3 | E04 | Sticky foam patch | Four lines of player controller (a speed multiplier from `data/`), no new system, and it makes a route cost something. The cheapest non-lethal pressure in the list |
| 4 | E08 | Toy button | Small wiring layer on the lock-in verb, and it turns a room into a machine. Every later interactive element (target, shelf release, lift call) reuses it |
| 5 | E12 | Ammo station | The first element that needs the station registry, which E13 then reuses. The 1-4 table already asks for A1 to A7, so this pays for itself in level authoring |

Why not the others yet:

- E03 Foam vent and E05 Spring pad are good and cheap, but both need the
  controller push field to be final (it moves with the shockwave work).
  Take them with whichever card lands that first.
- E06 Collapsing shelf needs a piece that un-anchors on a timer, which is
  a small change to `islands.ts`; do it after E02 has proven the island
  path.
- E07 Ferry ledge is the only L and it is the one that risks the
  controller. Do it after the lift, or with it, not before.
- E09, E10 and E11 are all M and all want a hit-trigger or a moving
  collider. They follow E08 and E06, not precede them.
- E13 Upgrade station is the right second station, once E12's registry
  exists and Paul has picked the mods.

Read across the set: one element that teaches cover is temporary (E01,
E02), one that teaches a route costs something (E04), one that makes the
room answer (E08), one that makes ammo a route (E12). Those are the four
lessons README pillars 3, 5 and 6 ask of early levels. The set costs one
L-sized card at most if split (E01 and E02 in one, E04 in one, E08 in
one, E12 in one).

---

## 4. Questions for Paul

Added to `PLAN.md` section 13 as Q17 to Q20.

- **Q17 Stations or pickups.** Should ammo and mods live at stations you
  return to (E12, E13), or stay as the one-shot pickups the game has now?
  Stations cost a registry and a recharge rule; pickups are capped at 8 on
  the floor. The 1-4 table marks both, so the answer decides whether
  those rows build or drop.
- **Q18 Moving floors.** Is a moving floor (E07 ferry, and KIT's lift)
  worth the controller and nav work this milestone, or does the lift stay
  a shell box that goes nowhere until it does? The ferry is the only L
  here.
- **Q19 Hazards that do not damage.** Are non-damaging hazards the right
  pressure for Act 1 (the vent, the sticky patch), or should the first
  hazard deal a little damage so a player takes it seriously? This is a
  difficulty question, and it sets the tone for every later hazard.
- **Q20 What the crates and buttons look like.** The list gives the toys
  their sizes and their jobs, not their faces. `[Paul]` marks every one:
  the crate print, the button colour, the target rings, the station lamps.
  Nothing here needs a name or a story, only a look.
