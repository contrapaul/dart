# DART: Planning Document

A browser first person shooter with the push-forward combat of DOOM (2016) and the shield, parry and heavy melee of DOOM: The Dark Ages, played with foam dart blasters against Foamers, monsters from the Foam dimension. No blood, no gore: everything that breaks, breaks into foam.

This is a living document. Sections marked **[Paul]** are Paul's to write. Items marked **Proposed** are suggestions to accept, change or cut. Nothing here is final until it moves into the Decisions Log (section 14).

---

## 0. How to use this document

- One copy of the plan lives here (`dart/PLAN.md`). Other docs link to it rather than repeat it.
- Every piece of work becomes a task in section 12 with an ID (for example `ENG-04`), an owner model, inputs, outputs and a "done when" line. That is what makes delegation to different AI models possible: a model gets the task card plus the files it names, nothing else.
- When a decision is made, record it in section 14 with the date, then update the section it affects.
- `HANDOFF.md` (to be created at P0) records the current state of the build after every working change, so any model can pick up where the last one stopped.

---

## 1. Vision

**One line:** [Paul] 

**Pitch (draft):** The Foam dimension is leaking into ours. You are the [Paul: player character name/role], armed with a rack of dart blasters and a shield, and the only way to send the Foamers home is to blast them apart, one squishy chunk at a time.

**Design pillars (Proposed):**

1. **Push forward.** Like DOOM 2016: standing still is losing. Health and ammo come from aggressive play (finishers, close kills), not from hiding.
2. **Stand your ground.** Like The Dark Ages: a shield to block, parry and charge with. Combat is weighty and readable; enemy attacks are big, colourful, dodgeable projectiles.
3. **Everything pops.** Foamers and the world both break apart. Destruction is the reward and the feedback.
4. **Bright, not grim.** The energy and intensity of DOOM with the look of a toy box. Scary is replaced by loud, fast and funny.
5. **Runs anywhere.** A browser tab on a school laptop. No install, no account required to play.

---

## 2. Audience, tone and content rules

**Target audience:** ages 10 and up, public release on the web (decided 2026-10-29). Free to play, forever.

**Rating target:** equivalent to ESRB E10+ / PEGI 7. Cartoon action, no blood, no gore, no realistic weapons, no frightening imagery. Under review since parts can come off and Foamers look menacing (2026-10-31): `design/CONTENT-PLAN.md` D13 proposes E10+ / PEGI 12.

**Hard rules for every model working on this project:**

- No blood, bones, organs or bodies left lying around. Foamers are foam all the way through: a wound shows the foam's core colour, a part shot off falls as a foam piece, a downed Foamer topples, fizzes and dissolves within seconds, and a catastrophic hit bursts it into foam chunks that fade (Paul, 2026-10-31: "foamy gore"; `design/CONTENT-PLAN.md` 3.2). No red, no fluids, no faces in pain.
- Foamers can look menacing, not scary (Paul, 2026-10-31): angry eyes, toothless grins, hunched postures and visible toy weapons, still foamy, rounded and brightly coloured. No teeth, no pointed claws, nothing gross or realistic. Rules in `design/CONTENT-PLAN.md` 3.3.
- No demonic or religious imagery from the DOOM source material (no pentagrams, hell, skulls, crosses, sacrifice). The Foam dimension replaces Hell.
- Blasters are toys. Bright plastic colours, orange tips, chunky shapes. Nothing that reads as a real firearm.
- Language: no swearing. Taunts and barks are silly, not cruel.
- No em dash characters in any project file, code comment or UI text.

**Intellectual property guardrails:**

- "Nerf" is a Hasbro trademark. DART is Nerf-*inspired*: the word Nerf and Nerf logos never appear in the game, and blaster designs are original, using reference images for feel and function rather than copying a specific product's silhouette.
- DOOM is an id Software / Bethesda trademark. The DART logo can borrow the *energy* of the DOOM logo (heavy, chiselled, extruded metal letters) but must be its own design. Enemy behaviours are inspired by DOOM's enemy roles; names, looks and lore are original.

---

## 3. Combat design

What we take from each DOOM, and how it becomes foam. **All Proposed.**

### 3.1 From DOOM (2016)

| DOOM 2016 element | DART version | Notes |
|---|---|---|
| Fast movement, double jump, mantling | **Hybrid (decided):** 2016 speed with sprint, dash and mantling, but no double jump. Dark Ages weight in hits, shield and parry | Keeps arenas readable for younger players. Q1 |
| Glory kills: stagger an enemy, then a melee finisher that drops health | **Pop finishers:** a staggered Foamer glows/wobbles; melee it for a short, funny finisher (squeeze, pop, wring out) that sprays health pickups | Finishers must be quick (under 1 s) and never gory |
| Chainsaw: instant kill that showers ammo | **[Paul: name]:** for example a foam vacuum or "reclaimer" that sucks a Foamer up and spits out darts | Ties into darts-as-ammo theme |
| Arena lock-ins with waves | Same: arenas seal, waves spawn from Foam rifts, arena opens when cleared | Core level structure |
| Weapon mods (two per weapon) | Blaster attachments | [Paul] per weapon |
| Suit upgrades, runes, secrets, collectibles | Upgrade tokens hidden in levels; collectible toys/figures of each Foamer | Good replay hook for kids |

### 3.2 From DOOM: The Dark Ages

| Dark Ages element | DART version | Notes |
|---|---|---|
| Shield Saw: block, throw, ricochet | **The Shield (decided): a foam disc buckler.** A big round foam-and-plastic disc worn on the arm. Blocks attacks, thrown like a frisbee to stun and ricochet between Foamers, returns to the arm. [Paul: name and look] | Signature tool, needs strong design. Q12 |
| Parry: green projectiles bounce back | **Bounce-back:** projectiles with a distinct colour/outline (Proposed: glowing pink) can be parried with the shield at the right moment and return to sender | Key to readability: one colour always means "parryable" |
| Shield charge: dash to any targeted enemy | **Bumper charge:** lock on, dash, knock back | Great for closing distance |
| Melee weapons with limited charges (gauntlet, flail, mace) | Foam melee weapons: [Paul] for example a noodle flail, a bumper gauntlet, a big foam hammer | Recharged by parries |
| Bullet-hell style enemy projectiles, slower and readable | Same: Foamers fire foam balls, rings, waves, bouncing blobs at readable speeds | Make dodging fun, not twitchy |
| Big set pieces (mech, dragon) | [Paul: optional] for example a giant ride-on toy robot section | Probably post-launch |
| Difficulty sliders (game speed, damage, parry window) | Same, plus a "Story" preset for younger players | Strongly recommended for this audience |

### 3.3 Darts as a mechanic (Proposed)

Darts are what makes DART different from a reskin, so they should *feel* like darts:

- **Visible projectiles, not hitscan.** Darts fly fast but visibly, with a slight arc. Heavier ammo (mega darts, rockets) arcs more.
- **Darts stick.** Suction-cup darts stick to walls and Foamers for a few seconds (capped count for performance), then fall. Foamers covered in darts wobble.
- **Ammo recovery (optional).** Spent darts on the floor can be picked up, a small reason to push into the space you just fought in. Needs testing: may be fiddly.
- **Ammo types:** [Paul] for example standard, suction, mega, foam balls ("rival" style), rockets, whistlers. Each type pairs with certain blasters.
- **Rate of fire classes:** single shot / pump, semi-auto, flywheel full-auto, spring-loaded heavy, launcher.

### 3.4 Player kit summary

| Slot | Item | Owner |
|---|---|---|
| Blasters | See section 5 | [Paul] |
| Shield | Section 3.2 | [Paul] |
| Melee | Section 3.2 | [Paul] |
| Ammo-for-kills tool | Section 3.1 | [Paul] |
| Health | [Paul: name, for example "Fizz"] | |
| Armor | [Paul: name, for example "Padding"] | |
| Upgrade currency | [Paul] | |

---

## 4. Foamers

Foamers are made of foam in different colours. Colour family could signal enemy class (Proposed: matches the DOOM habit of readable silhouettes). They burst into chunks of their own colour when damaged or killed. Behaviour is modelled on Dark Ages enemy roles; appearance is entirely original and not frightening.

### 4.1 Damage model (Proposed)

- Foamers are voxel models (section 7.3). Hits knock voxel chunks off at the impact point, so damage is *visible*: a Foamer that has taken a lot of darts is lumpy and missing pieces.
- **Damage zones and handicaps (decided 2026-10-31, Paul):** a Foamer is built from parts (body, head, arms, legs, and ability parts such as a launcher, jets or a shield; section 7.3 point 6). Each part has its own health. Shooting a part wears it down visibly, and when it breaks it falls off as a foam piece and the Foamer loses what that part did: a broken leg makes it limp, both legs make it crawl, a broken arm takes away that arm's attacks, ability parts take away their ability. Breaking a part also staggers the Foamer briefly. Weak points (head, a backpack tank) take extra damage. Which parts each Foamer has, and what losing them does, is in `design/CONTENT-PLAN.md` section 3.1 for Paul to adjust. Engine task: ENG-10.
- Stagger state: wobble + glow = finisher available.
- Death: the whole model breaks into physics chunks, a burst of foam crumbs and a satisfying "pop" sound. Chunks bounce, then shrink and fade within a few seconds.

### 4.2 Roster template

Behaviour source names refer to DOOM roles for the team's shorthand only; they never appear in the game. Rows below are a starting set to choose from. **[Paul]** fills name, look and colour.

| # | Behaviour source | Role and behaviour (to adapt) | Foamer name | Look | Foam colour | Tier |
|---|---|---|---|---|---|---|
| F01 | Zombie / fodder | Slow, walks at you, swarms. Free finishers and health | [Paul] | [Paul] | [Paul] | Fodder |
| F02 | Imp | Agile, climbs, throws slow projectiles. The basic ranged threat | | | | Fodder |
| F03 | Soldier with shield | Holds a shield wall, shoots from behind it. Teaches flanking and shield charge | | | | Fodder |
| F04 | Lost Soul | Small flying charger, comes in groups | | | | Fodder |
| F05 | Pinky (charger) | Charges in a straight line; armoured front, weak back. Teaches sidestep | | | | Heavy |
| F06 | Cacodemon | Floating, slow, spits projectiles. Stagger it with a big hit | | | | Heavy |
| F07 | Hell Knight | Melee brawler, leaps and slams with a shockwave | | | | Heavy |
| F08 | Mancubus | Slow tank, fires walls of projectiles with gaps to slip through | | | | Heavy |
| F09 | Arachnotron | Turret-like walker, sustained fire, destructible gun | | | | Heavy |
| F10 | Revenant | Airborne, homing shots, destructible jetpack | | | | Heavy |
| F11 | Agaddon Hunter style shielded elite | Shield can only be broken by a parry or specific weapon | | | | Elite |
| F12 | Komodo style ambusher | Fast, burrows or hides, leaps out | | | | Elite |
| F13 | Arch-vile style support | Buffs or revives other Foamers; priority target | | | | Elite |
| F14 | Baron | Big brawler mini-boss, wide attacks, combos | | | | Super heavy |
| F15 | Tyrant (Cyberdemon role) | Arena boss-class, rockets, stomps | | | | Super heavy |
| B01+ | Bosses | [Paul: one per act?] | | | | Boss |

Verify the Dark Ages-specific roster names against a reference before relying on them; only the *behaviours* matter.

### 4.3 AI architecture (Proposed)

- Each Foamer is a small state machine (idle, alert, approach, attack, stagger, pop) driven by a shared "director" that limits how many enemies attack at once. This is the DOOM "token" approach: only a few enemies are allowed to fire at a time, so arenas stay intense but fair.
- Navigation: navmesh baked per level (recast-navigation compiled to WebAssembly, vendored), with simple steering for flyers.
- Attack data (projectile type, speed, telegraph time, damage, parryable) lives in JSON so balance changes need no code.

---

## 5. Blasters

Paul's blaster details (roles, fire types, ammo, mods, names) are in `design/CONTENT-PLAN.md` section 4, and his reference images are in `design/referenceimages/` (`B01reference.webp` to `B08reference*.webp`, plus `generalcolorreference.webp`; gitignored, product photos). Each blaster gets a card in `design/blasters/<id>.md` (ART-01) using this template:

```
ID:            B01
Name:          [Paul]
Reference:     design/referenceimages/B01reference.webp (local only)
Role:          [starter / crowd control / precision / heavy / launcher / ...]
Fire type:     [pump / semi / flywheel auto / spring heavy / launcher]
Ammo:          [dart type] , magazine size, reserve max
Fire rate:     [shots per second]
Damage:        [per dart] , [stagger value]
Projectile:    speed, arc (gravity), spread, sticks? (y/n)
Reload:        [time, animation idea]
Alt fire / mod 1: [Paul]
Mod 2:         [Paul]
Upgrade path:  [Paul]
Feel notes:    sounds, recoil, screen shake, what makes it satisfying
Colours:       body / accent / tip
Unlock point:  [level]
```

### 5.1 Arsenal overview

| ID | Name | Role | Ammo | Status |
|---|---|---|---|---|
| B01 | The Dartman | Starter, pump, 3 darts per shot | Standard | Model approved 2026-11-01 (`public/models/blasters/B01.glb`, built by `art/blasters/B01/build.py`); in game with GAME-09 |
| B02 | Musketeer | Sidearm, semi-auto, never empty | Standard | Details in CONTENT-PLAN 4; card and model not started |
| B03 | Leviathan | Spread, double barrel heavy shotgun | Standard (as shells) | Model approved 2026-11-01 (`public/models/blasters/B03.glb`, built by `art/blasters/B03/build.py`); in game with GAME-09 |
| B04 | Shredder | Flywheel full-auto, recoil grows | Standard | Model approved 2026-11-01 (`public/models/blasters/B04.glb`, built by `art/blasters/B04/build.py`); in game with GAME-09 |
| B05 | Shrike | Precision, zoom, piercing | Precision dart | Details in CONTENT-PLAN 4; card and model not started |
| B06 | The Standard | Heavy full-auto | Mega dart | Details in CONTENT-PLAN 4; card and model not started |
| B07 | Collateral | Launcher, arcing, explosive | Mega dart | Details in CONTENT-PLAN 4; card and model not started |
| B08 | Firehose | Gatling, spin-up, ricochets | Foam ball | Details in CONTENT-PLAN 4; card and model not started |

Names are Paul's; check each is not another company's product name before launch.

### 5.2 From reference image to in-game blaster (pipeline)

Updated 2026-11-01: Paul added Kimi K3.1 Pro to Pi and installed Blender
(5.2.3 LTS, through Steam), so blasters are **modelled by a script in
Blender**, the same way Foamers are built by code. This replaces the image
model and Hunyuan3D route (Proposed until the ART-00 spike passes).

1. **Reference (Paul, done).** Details in CONTENT-PLAN section 4, photos in
   `design/referenceimages/` (local only).
2. **Card and brief (ART-01, Claude).** `design/blasters/Bxx.md`: the card
   above, filled from CONTENT-PLAN, plus a written design brief from the
   photo: silhouette, a part list with rough sizes in centimetres, which
   parts move and how, a colour scheme (from `generalcolorreference.webp`,
   colours are flexible), and an **originality list**: no logos, text or
   decals; at least three clear silhouette changes from the photo; our own
   colours. Paul approves the brief.
3. **Model (ART-04, Kimi K3.1 Pro in Pi, Blender headless).** Kimi writes
   `art/blasters/Bxx/build.py`, a Blender Python script that builds the
   blaster from bevelled primitives, booleans and curves with toy plastic
   materials (flat colours, a translucent magazine where the brief has
   one) and exports `public/models/blasters/Bxx.glb`. It runs with
   `Blender --background --python art/blasters/Bxx/build.py`. The script
   is the source and is reviewed like code; the `.glb` is committed too,
   because the Cloudflare build has no Blender. Kimi works from the
   brief, not the photo, so the model is ours.
4. **Renders (same script).** A turnaround (side, three-quarter, top,
   first-person view) to `art/blasters/Bxx/renders/`. Kimi reads its own
   renders against the brief and iterates; Paul approves or redirects
   from them ("longer barrel, chunkier pump" is a script edit).
5. **Review (Claude).** The `.glb` contract below, originality against the
   photo, size budget, and the script runs clean from scratch.
6. **In game (GAME-09, ART-05).** Three.js `GLTFLoader` (bundled, no
   outside host) loads the viewmodel; code animates the named parts
   (recoil, pumping, reload, spin-up).

**The `.glb` contract** (every blaster):

- Metres at true size (a 45 cm blaster is 0.45 m long); +Y up; the
  muzzle points along -Z in glTF (the script handles Blender's axes).
- Origin at the trigger-hand grip, so the game can place every blaster
  the same way.
- Named nodes: `body` (everything that does not move); one empty per
  barrel tip, `muzzle_1` to `muzzle_n` (where darts leave); each moving
  part where the blaster has it, with its origin on its pivot and moving
  along or about its own axes: `pump`, `trigger`, `mag`, `bolt`, `breach`
  (break action), `barrels` (spins about local Z), `drum`, `crank`,
  `flywheel_l` and `flywheel_r` (visible spinning wheels), `latch`,
  `shell_1` to `shell_n` (shells in a break action). Parts that move
  with another part are its children (B03's muzzles, shells and quad mod
  under `breach`). Mods that add geometry are their own nodes,
  `mod_<name>`, hidden by default (B03 quad barrels, B08 second barrel).
- Budget: at most 20,000 triangles, 1.5 MB, 8 materials. Colours are
  flat; image textures only for small surface detail such as grip
  texture (a tiling normal map), each at most 256 x 256 and embedded,
  all together at most 200 KB (Paul, 2026-11-01: grip ribs are
  textured, not modelled).
- No text, logos or real product markings anywhere.

---

## 6. Story

**[Paul]** writes the story. Template:

- **Premise:** [Paul] (working idea: the Foam dimension is breaking through into our world)
- **Player character:** [Paul]
- **Why foam?** [Paul: what the Foam dimension is, why Foamers come, why darts hurt them]
- **Allies / guide voice:** [Paul]
- **Antagonist:** [Paul]
- **Tone references:** [Paul: for example Saturday morning cartoons, toy commercials, Pixar]
- **Ending:** [Paul]

### 6.1 Act and level outline

| Act | Setting | Levels | New blasters | New Foamers | Boss | Story beat |
|---|---|---|---|---|---|---|
| 1 | [Paul: for example a toy store, school, suburban street] | | | | | |
| 2 | | | | | | |
| 3 | [Paul: the Foam dimension itself?] | | | | | |

### 6.2 How story is delivered (Proposed)

DOOM keeps story out of the way of combat. Proposed: short in-engine intro per level, radio-style voice lines during exploration, collectible "Foam files" (codex entries) for those who want lore, and nothing that stops play mid-arena.

---

## 7. Technical architecture

### 7.1 Platform constraints

- **Browser only.** Desktop Chrome, Edge, Firefox, Safari. Chromebooks, tablets and phones are out of scope for v1 (Q4).
- **No external hosts at runtime.** Paul's audience is partly in China, so every library, font, model, texture and sound is served from our own domain. No CDNs, no Google Fonts, no third-party analytics.
- **Load budget (Proposed):** playable within 10 s on a mid-range connection. First level under 25 MB compressed, later levels streamed.
- **Performance target (decided):** 60 fps at 1080p on low/medium settings on a mid-range laptop with integrated graphics. This is the minimum spec for every performance gate. **Benchmark machine (Q13): a base Apple Silicon Mac** (M1/M2 MacBook Air class). Because its GPU is stronger than most Windows integrated graphics, **Proposed:** also check each gate on one Intel Iris Xe or AMD Radeon integrated-graphics laptop (borrowed or a school machine), and treat the Mac numbers as needing headroom (for example 90 fps or more on the Mac at medium).
- **Input:** mouse + keyboard with Pointer Lock; gamepad via the Gamepad API. Touch is out of scope for v1.

### 7.2 Engine choice

**Decided 2026-10-29: Three.js + Rapier physics + a custom voxel layer** (Q5). The table below is kept for the record.

| Option | For | Against |
|---|---|---|
| **Three.js** (WebGPU renderer with WebGL2 fallback) | Huge ecosystem, every AI model writes it well, full control, small, easy to vendor | We build the game framework ourselves |
| Babylon.js | More batteries included (physics, GUI, inspector) | Heavier; models know it less well |
| PlayCanvas engine | Fast, game-focused | Editor is a hosted service (China reachability); engine-only use is less common |
| Godot 4 web export | Real game engine, editor | Large download, web export threading needs special server headers (COOP/COEP), less suited to custom voxel destruction, harder for AI models to drive |
| Custom WebGPU | Maximum voxel performance | Far too much work for v1 |

Supporting libraries (all vendored into the repo, versions pinned):

- **Rapier** (`@dimforge/rapier3d-compat`, WebAssembly) for player controller collisions, physics debris and foam chunks.
- **recast-navigation-js** for navmesh pathfinding.
- **Vite** for local dev and builds (output is plain static files).
- **TypeScript** throughout: types are the contract that lets several models work on separate modules without breaking each other.

### 7.3 Voxel destruction: "Teardown-lite"

A full Teardown-style world (everything voxels, every voxel simulated) is beyond what a browser can do at 60 fps on a school laptop. **Proposed hybrid:**

| Layer | Representation | Destructible? |
|---|---|---|
| Level shell (floors, outer walls, terrain) | Regular meshes (glTF) with collision | No |
| Destructible zones (cover, crates, inner walls, props, foam growths) | Voxel volumes, 32 x 32 x 32 chunks | Yes |
| Foamers | Voxel models (one or a few volumes, skinned by part) | Yes |
| Debris and foam chunks | Small instanced meshes + Rapier rigid bodies | Short-lived |

How it works:

1. **Storage:** each chunk is a flat `Uint8Array` of material IDs (0 = empty). Palette per material: colour, hardness, sound, chunk behaviour.
2. **Meshing:** greedy meshing in a Web Worker pool, so destroying voxels never stalls the main thread. Remesh only the affected chunks.
3. **Damage:** a dart hit or explosion carves a sphere (radius from damage, reduced by material hardness). Removed voxels spawn a capped number of debris chunks.
4. **Structural break-off:** after a carve, flood-fill from anchored voxels; any island no longer connected becomes a new rigid body (its own small voxel mesh) and falls. This is the Teardown magic, done only on the small affected region.
5. **Budgets:** hard caps on live debris bodies (for example 150), stuck darts (for example 100), and remeshes per frame. Oldest items fade first. A quality setting scales all caps.
6. **Foamer bodies:** Foamers are built from voxel parts attached to a simple skeleton (head, body, limbs). Each part is its own small volume, so a part can be blasted off cleanly and movement still animates cheaply (parts are rigid, animated by transforms rather than per-vertex skinning).

**Spike first** (P0): prove a 64 x 64 x 32 destructible wall plus 10 voxel Foamers holds 60 fps on Paul's target low-end machine before committing.

### 7.4 Rendering and look

- **Foam material:** a custom shader with soft stipple/pore noise, slight subsurface glow and a rim light, so voxels look like foam rather than Minecraft blocks.
- **Blocky voxels for Foamers (decided 2026-10-31, Paul, after the sandbox):** Foamers are greedy-meshed blocks like everything else, with the foam material. Surface nets (ENG-09) were built, compared side by side in the sandbox and removed.
- Toon-ish lighting, strong colours, outline pass for enemies (helps readability, like DOOM's enemy highlighting).
- Particle systems: foam crumbs, confetti, bubbles, dart trails, parry flashes.
- Post-processing kept light (bloom, simple colour grading) to protect performance.

### 7.5 Game code structure (Proposed)

```
dart/
  PLAN.md               this document
  HANDOFF.md            current state, next steps (from P0)
  CLAUDE.md             rules for AI models working in the repo (from P0)
  reference/            Paul's reference images (blasters, foamers, logo, mood)
  design/               blaster cards, foamer cards, level designs, story
  src/
    core/               game loop, time, input, events, settings, save
    render/             renderer setup, materials, foam shader, post fx
    voxel/              chunk storage, meshing workers, carve, islands
    physics/            Rapier wrapper, player controller, debris
    player/             movement, shield, melee, finishers, health
    weapons/            blaster base class, projectiles, darts, each blaster
    ai/                 director, state machines, navigation
    foamers/            one module per Foamer type
    level/              level loading, arenas, triggers, secrets
    ui/                 HUD, menus, pause, settings
    audio/              Web Audio mixer, sfx banks, music layers
  data/                 JSON: weapon stats, foamer stats, levels, difficulty
  assets/
    models/  textures/  audio/  fonts/  voxels/
  tools/                voxelizer, asset pipeline scripts, level tools
  tests/
```

### 7.6 "Single player online": what it means

**Decided 2026-10-29 (Q3): browser play only.** The game is single player and played online in a browser. No server, no accounts. Saves are local (IndexedDB), with a save export/import code as a backup.

Possible later additions, not in scope for v1:

- Cloud save across devices
- Leaderboards per level (time, score)
- Shareable custom difficulty codes

If any are added later, use Paul's existing pattern: Cloudflare (static assets for the game, Durable Objects or D1 for saves and leaderboards).

**Hosting (decided, Q11):** dart.contrapaul.com, public GitHub repo, Cloudflare static-assets deploy on push to main (same pattern as build.contrapaul.com).

### 7.7 Audio

- Web Audio API with a small mixer (sfx, music, voice buses).
- Signature sounds matter: dart thwip, flywheel spin-up, priming clack, foam pop, parry "boing". Each blaster needs a distinct set.
- Music: DOOM-style dynamic layers (calm exploration layer, combat layer that kicks in at arena lock-in). **Direction (decided, Q7): pop-punk / metal lite.** DOOM energy, big riffs, upbeat and kid-friendly.

---

## 8. Art and asset pipeline

### 8.1 Art direction

- **Mood:** [Paul: reference board in `reference/mood/`]
- **Palette:** bright toy plastics for blasters and the player's world; saturated foam colours for Foamers; the Foam dimension [Paul].
- **Logo:** Paul designs the DART logo (DOOM-inspired lettering). Deliverables needed from it: title screen version, small HUD/loading version, favicon, 3D version for the title scene (optional).

### 8.2 Generated models

| Asset type | Method (Proposed) | Output |
|---|---|---|
| Blasters (first person, high detail) | Written brief from Paul's reference, then a Blender Python script by Kimi K3.1 Pro (section 5.2), renders for approval | `.glb` with named moving parts, plus the script |
| Foamers | Concept art (image model), then either: (a) voxel models authored by code (an LLM writes a generator script per Foamer) or (b) image-to-3D mesh, voxelized by our tool | `.vox` or our own voxel JSON/binary |
| Destructible props (crates, cover, furniture) | Voxels generated by code, or meshes voxelized | voxel volumes |
| Level shell | Modular kit pieces (meshes) generated by image-to-3D or by code, assembled in a level tool | `.glb` + level JSON |
| Textures | Procedural shaders where possible; image model for decals/signage | `.ktx2` / `.webp` |
| Pickups, UI icons | Image model or code (SVG) | `.webp` / `.svg` |

Notes:

- **Code-generated voxel models** suit this project unusually well: a Foamer is simple rounded shapes, and an LLM can write and iterate a script ("make the eyes bigger, add a second antenna") faster than any 3D tool. Recommend trying this first for Foamers (task ART-03).
- Every generated asset gets a row in `assets/MANIFEST.md`: source tool/model, prompt, date, licence terms of the tool. DART is free forever (Q8), but the repo is public, so each tool's terms must still allow public release and redistribution of its output.
- **Tool access (Q9, 2026-10-29):** Paul currently has coding agents only, no image, 3D or audio generation tools. Until that changes, the default is **assets generated by code**: voxel Foamers and props from generator scripts, blasters built from code-generated primitives (rounded boxes, cylinders, lathe and extrude shapes), procedural textures in shaders, and procedural sound effects synthesized with Web Audio. Image-to-3D and AI audio are added later if Paul picks tools (see 11.1). **Update 2026-11-01:** blasters are modelled by scripts in Blender (Kimi K3.1 Pro through Pi), section 5.2; Blender's output under a script we wrote is ours to publish, and Moonshot's terms for Kimi output are to be checked and noted in `assets/MANIFEST.md` before the first model ships.
- **Reference images stay out of the public repo.** Product photos of real blasters are other people's copyright, so `reference/` is listed in `.gitignore` and kept locally. Design briefs written from them (text) are committed.
- Asset size budgets: blaster under 1.5 MB, Foamer under 300 KB, prop under 100 KB (compressed). Use meshopt/Draco compression and KTX2 textures.

### 8.3 Audio assets

| Asset | Method (Proposed) |
|---|---|
| Sound effects | Blasters: recordings of Paul's own foam blasters (pump, flywheel, spring), one session per blaster: prime, fire, dry fire, reload, mag in/out, flywheel rev. Raw files stay local; edited, layered `.ogg`/`.m4a` files are committed. Everything else: procedural Web Audio |
| Music | [Paul: AI music generation, commissioned, or licensed] |
| Voice | [Paul: AI voice, own recordings, students?] |

The full list of sounds, with IDs, takes and delivery format, is `design/SOUNDS.md`.

---

## 9. Level design

- **Structure (Proposed):** DOOM-style levels: exploration corridors with secrets, connecting combat arenas that lock until cleared, a key or switch puzzle, an exit. 15 to 25 minutes each.
- **Destruction in level design:** cover that wears down, walls that can be blasted through to secrets, Foam growths that block paths until destroyed.
- **Building levels (Proposed):** start with code-authored blockout levels (JSON of boxes, arenas, spawn points) so models can build and edit levels as text. Later, a simple in-browser level editor if needed (post P2).
- **Level list:** [Paul], see section 6.1.
- **Direction (decided 2026-11-03, Paul): semi-open linear.** One clear critical path from start to exit, never a maze, as in the modern Doom games. Each stretch opens into wide, multi-level spaces with optional side areas, vertical routes, overlooks and secrets off the path. Arenas lock until cleared and then open the way on; the next goal is always visible; backtracking is short and optional. Concepts, the space kit with metric sizes, and the blockout format are in `design/levels/` (LVL-00).

---

## 10. UI and accessibility

- HUD: health, armor, ammo, shield charge, melee charges, current blaster. Chunky toy-like style.
- Menus: title (with Paul's logo), level select, settings, blaster/upgrade screen, codex.
- **Difficulty and assist options (Proposed, important for a young audience):** game speed, damage taken, parry window size, aim assist, toggle vs hold, invert look, FOV, motion-sickness options (reduce head bob, screen shake, flash), subtitles, colourblind-safe parry colour.
- Pause anywhere. Checkpoint at every arena.

---

## 11. AI model delegation

The project uses a range of models. Each task in section 12 names an owner. The proposed roles below are a starting point; adjust once we see how each performs on real tasks.

### 11.1 Model roster (Proposed, Paul to confirm what he has access to)

| Role | Proposed model(s) | Used for |
|---|---|---|
| Architect / lead engineer | Claude Opus 5.5 | Engine architecture, voxel system, physics integration, performance, code review of other models' work, task card writing |
| Feature engineer | Claude Sonnet 5.5 | Most gameplay code: weapons, Foamer AI, UI, level loading, from a clear task card |
| Bulk / data worker | Claude Haiku 5.5 | JSON data entry, balance tables, tests, refactors, docs, asset manifest upkeep |
| [Paul to assign] | Claude Fable 5.1 | [Paul: for example story drafts, barks, codex entries in Paul's voice] |
| Long-task implementer and reviewer | Pi coding agent running Qwen 3.8-27b (Q14) | Long coding tasks from a clear, detailed task card (strong at this); parallel feature work on separate modules; independent review of other models' code. Task cards for Pi spell out files, interfaces and "done when" exactly |
| Vision / reference analysis | A vision-capable model (Claude, or another) | Reference image to design brief |
| Concept art | None yet (Q9). For blasters, the Blender renders are the concept (section 5.2) | Blaster turnarounds for approval |
| 3D modelling | **Kimi K3.1 Pro through Pi (`--provider moonshotai --model kimi-k3.1-pro`) writing Blender Python scripts, Blender 5.2.3 run headless** (2026-11-01). Kimi reads images, so it checks its own renders. Proven by spike ART-00. Hunyuan3D is parked | Blaster meshes, later props and level kit pieces |
| Sound effects | **Recordings of Paul's own foam blasters (Q16)**, edited and layered, plus procedural Web Audio for non-blaster sounds (pops, parry, UI) | sfx |
| Music | None yet (Q9). [Paul: AI music tool, commission, or licensed tracks] | Dynamic music layers |
| Voice | [Paul] | Player and guide lines |

### 11.2 Task card format

Every delegated task uses this card (lives in `tasks/<ID>.md` once work starts):

```
ID:          ENG-04
Title:       Greedy mesher in a Web Worker
Owner:       Opus 5.5 (review: Sonnet 5.5)
Depends on:  ENG-03
Inputs:      src/voxel/chunk.ts, PLAN.md section 7.3
Outputs:     src/voxel/mesher.worker.ts, tests/voxel/mesher.test.ts
Done when:   a 32^3 chunk meshes in under 4 ms in a worker; test passes; demo page shows a carved chunk
Notes:       no external imports; no em dashes
```

### 11.3 Delegation rules

- Hard, cross-cutting systems (anything in `core/`, `voxel/`, `physics/`) go to the strongest model, and its interfaces are written first. Other models then build against those interfaces.
- One owner per file at a time. Two models never edit the same module in parallel.
- Every task ends with an update to `HANDOFF.md`.
- Code from any model gets reviewed by a different model before it merges.
- Paul is the final judge of feel: anything about "does this feel good" goes to a playtest, not a model.

---

## 12. Milestones and task breakdown

IDs: `PRE` pre-production, `ENG` engineering, `GAME` gameplay, `ART` art, `AUD` audio, `LVL` levels, `UI` interface, `QA` testing, `OPS` hosting.

Owners use the roles in 11.1: **A** = Architect (Opus), **F** = Feature (Sonnet), **B** = Bulk (Haiku), **P** = Paul, **IMG** / **3D** / **SND** = the generation tools.

### Phase 0: Pre-production (now)

| ID | Task | Owner | Depends on |
|---|---|---|---|
| PRE-01 | Finish this plan: answer open questions (section 13) | P + A | |
| PRE-02 | Write story outline (section 6) | P | |
| PRE-03 | Collect blaster reference images, one folder per blaster | P | |
| PRE-04 | Write blaster cards (section 5) | P (B can format) | PRE-03 |
| PRE-05 | Name and describe Foamers (section 4.2) | P: done 2026-11-02 (CONTENT-PLAN 3, colours 3.4); boss names and looks later | |
| PRE-06 | Design the DART logo | P | |
| PRE-07 | Mood board in `reference/mood/` | P | |
| PRE-08 | Confirm model roster and tool access (11.1) | P | |
| PRE-09 | Set up public repo, CLAUDE.md, HANDOFF.md, `.gitignore` (with `reference/`), Vite + TypeScript skeleton, vendored Three.js and Rapier, deploy to dart.contrapaul.com | A | PRE-01 |

**Schedule (Q10, set 2026-10-29):** P0 prototype by **2026-11-12** (two weeks), P1 vertical slice by **2026-11-29** (one month). P2 and P3 get dates after the slice playtest.

### Phase 1 (P0): Technical prototype, due 2026-11-12. Goal: "Is it fun to shoot a foam wall?"

| ID | Task | Owner | Depends on |
|---|---|---|---|
| ENG-01 | Game loop, fixed-step update, input with Pointer Lock and gamepad | A | PRE-09 |
| ENG-02 | First person controller on Rapier (walk, sprint, jump, mantle) | A | ENG-01 |
| ENG-03 | Voxel chunk storage and material palette | A | PRE-09 |
| ENG-04 | Greedy mesher in a Web Worker pool | A | ENG-03 |
| ENG-05 | Sphere carve + debris spawning with caps | A | ENG-04 |
| ENG-06 | Island detection and break-off rigid bodies (card: `tasks/ENG-06.md`) | Pi | ENG-05 |
| ENG-07 | Foam shader v1 and voxel AO (card: `tasks/ENG-07.md`) | Pi | ENG-04 |
| ENG-09 | Smoothed meshing (surface nets) for Foamer volumes, same worker pool (PLAN 7.4). Built, then removed 2026-10-31: Paul chose blocks | Claude | ENG-04 |
| GAME-01 | Projectile system: visible darts, arc, sticking, pooling (card: `tasks/GAME-01.md`) | Pi | ENG-02 |
| GAME-02 | One placeholder blaster (pump action) end to end (card: `tasks/GAME-02.md`) | Pi | GAME-01 |
| GAME-03 | One voxel test Foamer that walks at you and pops into chunks (card: `tasks/GAME-03.md`) | Pi | ENG-05 |
| QA-01 | Performance test on Paul's low-end target machine; record numbers in HANDOFF.md | P + A | all above |
| **Gate** | Go / no-go on the voxel approach (fall back to pre-fractured meshes if it fails) | P | QA-01 |

### Phase 2 (P1): Vertical slice, due 2026-11-29. Goal: "One arena that feels like DOOM with foam."

| ID | Task | Owner | Depends on |
|---|---|---|---|
| GAME-04 | Shield: block, parry (bounce-back), throw. Stage 1 done 2026-11-03 (`tasks/GAME-04.md`): viewmodel, block, movement gates, ricochet throw, return, cooldown | Done 2026-11-04 (card: `tasks/GAME-04b.md`; stage 2: parry and bounce-back; Qwen 3.8-27B via Pi + Claude review, awaiting Paul) | P0 gate |
| GAME-04c | (card: `tasks/GAME-04c.md`) Shield look (concentric foam rings, emblem [Paul]), the thrown disc spins, and the foam saw: a throw lodges in the first Foamer and grinds it, then ricochets | Done 2026-11-05, awaiting review (DeepSeek V4.1 Flash via Pi): one disc model held and flown, spin about its own axis, the grind with its own `saw` block, `SH-saw` and `SH-sawEnd`, the watch's `grinding`; emblem still [Paul] | GAME-04b, GAME-05 |
| GAME-05 | Shield charge | Done 2026-11-04 (card: `tasks/GAME-05.md`; Qwen 3.8-27B via Pi + Claude review, Paul approved) | GAME-04 |
| GAME-06 | (card: `tasks/GAME-06.md`) Melee weapon 1 (M01, name [Paul]): a three-hit combo that spends charges, a shield bash with none, charges refilled by parries and time, `data/melee.json` | Done 2026-11-05 (card: `tasks/GAME-06.md`; Qwen 3.8 Flash Next via Pi, dgx-spark; look and feel unverified by eye, awaiting Paul) | GAME-04b, GAME-07 |
| GAME-07 | Stagger + Pop finishers + health drops | Done 2026-11-03 (card: `tasks/GAME-07.md`; Qwen 3.8-27B via Pi + Claude review, Paul approved) | GAME-03 |
| GAME-08 | (card: `tasks/GAME-08.md`) The foam vacuum (D09, name [Paul]): E on a stunned weakened Foamer locks on, sucks it up and refills reserves; one charge that recharges | Done 2026-11-06, reviewed by Claude (two fixes), merged locally, not pushed (Qwen 3.8-27B via Pi, qwen-machine) | GAME-07, LVL-02a |
| GAME-09 | (card: `tasks/GAME-09.md`) Weapon framework from JSON data: per-blaster data from the cards, fire types (pump, semi, full-auto with growing recoil, spin-up, break-action double), new dart types (precision, mega, foam ball, slug), `popTypes` per type, a `.glb` viewmodel from the named nodes; the 3 slice blasters in level order B01, B04, B03 (D04), tested on the range | Done 2026-11-02 (Pi + Claude review) | ART-04 for the models (placeholder models until then) |
| GAME-09b | (card: `tasks/GAME-09b.md`) Catastrophic hits and explosions (D12): a close B03 blast or a B01 slug blows a big chunk out of a mid-tier, weakened elite or boss and finishes it in a large foam burst without popping the whole body; area blasts carve terrain and Foamers, push, and can pop (B05 and B06 mods, B07) | Stage 1 and 2 done 2026-11-06, reviewed by Claude (two fixes, one fix round), merged locally, not pushed (DeepSeek V4.1 Flash via Pi): the shot carries its id, muzzle and `chunk` block, `src/foamers/chunk.ts` judges the rule, the chunk carves, bursts and pushes, the range spawns weakened Foamers; the area blast half (B05, B06, B07) is still open | GAME-09 |
| GAME-11 | Leg loss (D11): a Foamer that loses a leg falls over (a short ragdoll fall, ENG-12) and then crawls, instead of tipping slightly and walking slower | Done 2026-11-03 (card: `tasks/GAME-11.md`; DeepSeek via Pi + Claude review) | ENG-12 |
| ENG-08 | (card: `tasks/ENG-08.md`) AI director (attack tokens), state machine base, grid navigation | Done 2026-11-03 (DeepSeek via Pi + Claude review) | GAME-03; stage 3 GAME-11 |
| ENG-10a | Foamer sandbox: greybox rigs per role, movement styles, `sandbox.html` | Claude (done) | ENG-09 |
| ENG-10 | Foamer parts: the F01 rig in game, per-part damage, break-off, handicaps, foam-core wounds, going down and popping (card: `tasks/ENG-10.md`) | Pi (done) | ENG-10a |
| ENG-11 | Test range page `range.html`: plain level, frame-time graph, system switches, test panel for darts and Foamers (card: `tasks/ENG-11.md`) | Pi (done) | ENG-10 |
| ENG-12 | Foamers go limp when killed: a jointed ragdoll pushed by the killing hit, then lie and sink (card: `tasks/ENG-12.md`) | Pi, finished by Claude (done 2026-11-02) | ENG-10, ENG-11 |
| GAME-10 | 3 Foamer types (fodder ranged, charger, heavy) | F | ENG-08, ENG-10, PRE-05 |
| GAME-10a | (card: `tasks/GAME-10a.md`) Foamer types from data (`data/foamers.json` base + per-type entries, `spawn(feet, facing?, type)`) and the F02 Roamer: keeps its ring, throws slow pink foam balls blocked by the disc; Pit wave 2 is 3 F01 + 2 F02 | Done 2026-11-04 (Qwen 3.8 Flash Next via Pi + Claude review, Paul approved) | ENG-08, ENG-10 |
| GAME-10b | (card: `tasks/GAME-10b.md`) The F05 Darter: a charger that telegraphs for 0.9 s, locks its line and runs at 11 m/s for up to 18 m with no steering, staggers for 1.2 s when it hits a wall (back open), hits and stuns the player it runs into, armour plates on chest and brow that shrug off darts, a weakpoint at 2.5 times, no charging with both legs gone, a shield charge into its front plates bounces off; the Ring arena (`data/levels/1-4-ring.json`, `arena.html?level=1-4-ring`) | Done 2026-11-04 (DeepSeek V4.1 Flash via Pi + Claude review, Paul approved) | GAME-10a, GAME-11, ENG-08 |
| GAME-10c | (card: `tasks/GAME-10c.md`) The F06 Floater: palette look, floats at a hover height over the nav grid, keeps its distance, spits bouncing blobs and one big parryable blob, the mouth a weak point only while open, fins lost make it sink | Done 2026-11-06 (Qwen 3.8 Flash Next via Pi, dgx-spark), reviewed and merged locally; the review fixed blobs that burst on the floor without bouncing (now lifted off the surface by their radius, test 2b). Seen on the range: the hover, the fins, the fan and the big blob. Not heard: the three sounds | GAME-10a, GAME-10e, BUG-08 |
| GAME-10f | (card: `tasks/GAME-10f.md`) The F07 Brawler: palette look, walk-in melee and a punch, a leap slam that lands a shockwave ring the player jumps or dashes through, legs lost end the leap. [Paul] sword or fists | Done 2026-11-07 (Qwen 3.8 Flash Next via Pi, dgx-spark), reviewed and merged locally; the review made the ring mesh only for shockwave types. Seen on the range: crouch, leap, ring and its hit. Not tried in play: the jump and dash through the band; not heard: the sounds | GAME-10a, GAME-10b, GAME-10c |
| GAME-10g | (card: `tasks/GAME-10g.md`) The F09 Crawler: palette look, keep-distance brain, a pellet stream that cover stops, the gun a weak point that can be shot off | Started 2026-11-07 (Qwen 3.8 Flash Next via Pi, dgx-spark, branch `game-10g`) | GAME-10c, GAME-10f |
| GAME-10d | (card: `tasks/GAME-10d.md`) The F03 Swarmer: palette look, a pack brain that nibbles hit and run, a `swarm` token pool, `spawnPack` and a live cap | Code done 2026-11-05 (DeepSeek V4.1 Flash via Pi), pending review; the look, the skitter and the nibble were not seen by eye and the frame time is headless only | GAME-10a, GAME-10b |
| GAME-10e | (card: `tasks/GAME-10e.md`) The F04 Blocker: a shield wall facing the player, parryable volleys over it, a shield that stops front darts until carved away, broken by the shield charge | Done 2026-11-06, reviewed by Claude (turn rate lowered), merged locally, not pushed (DeepSeek V4.1 Flash via Pi); the wall's look, the shield's read at 120 degrees and the volley spread were not seen by eye | GAME-10d, GAME-10b, GAME-05 |
| ANIM-01 | (card: `tasks/ANIM-01.md`) Procedural poses: F02 throw windup and release (ball back over the head, then through past the shoulder; the body turns away and swings through), F05 telegraph scrape (body dipped, a leg back and forward twice), charge run (25-degree forward pitch, short stride) and wall stun (rocks back, wobble, head shake); every number in a `motions` block in `data/foamer-rigs.json`; `npx tsx tools/render-rig.ts F02 --state windup --t 1 --attack throw` renders key frames to `design/foamers/poses/` | Stage 1,2 done 2026-11-04 (Qwen 3.8-27B via Pi); pose math verified numerically, key frames rendered, not watched by eye | GAME-10a, GAME-10b |
| ART-00 | (card: `tasks/ART-00.md`) Spike: Kimi K3.1 Pro through Pi builds B01 in Blender from its brief (script, `.glb`, renders) to the section 5.2 contract; record time, cost and quality. Go / no-go for the Blender route (was: Hunyuan3D) | Kimi via Pi (done 2026-11-01: go) | |
| ART-01 | Cards and design briefs for all 8 blasters (`design/blasters/Bxx.md`) from CONTENT-PLAN 4 and the reference photos, Paul approves | Claude + P | |
| ART-02 | Folded into ART-04: the Blender renders are the turnarounds Paul approves | | |
| ART-03 | (card: `tasks/ART-03.md`) Code-generated blocky voxel Foamers (3 types: F01, F02, F05 in the palette), Paul approves | Done 2026-11-03 (Kimi via Pi + Claude review, Paul approved) | PRE-05 |
| ART-04 | The 3 slice blasters modelled in Blender by script (Kimi), named moving parts, to the section 5.2 contract; the other 5 in Phase 3 | Kimi via Pi (slice 3 done 2026-11-01; other 5 in Phase 3) | ART-00, ART-01 |
| ART-05 | Procedural first person animations | F | ART-04 |
| LVL-00 | Level design concepts: pillars, space kit, Act 1 concepts, Acts 2 and 3 outlines, blockout format proposal (`design/levels/`) | Done 2026-11-03 (DeepSeek via Pi + Claude review, Paul approved) | CONTENT-PLAN 2 |
| ENG-13 | (card: `tasks/ENG-13.md`) One shared game module for the playable pages: renderer, physics, player, health, settings, HUD, menus, loadout, darts, carving, debris, pieces, Foamers, sounds, the fixed step, render and loop, and `?watch` on both pages; each page supplies only its geometry, its spawn rules and the hooks for what only it does | Done 2026-11-03 (DeepSeek via Pi + Claude review, Paul approved) | LVL-01, UI-01, AUD-01 |
| LVL-01 | (card: `tasks/LVL-01.md`) Level loader for the blockout format (format, validator, builder), arena lock-ins with waves from rifts, and the 1-1 Pit as the first arena on `arena.html`: banner, lock, two waves, exit pad, `?watch` mode | Done 2026-11-03 (DeepSeek via Pi + Claude review, Paul approved) | LVL-00, ENG-06, ENG-08, UI-01 |
| LVL-02a | (card: `tasks/LVL-02a.md`) Placed ammo pickups from the level file: an `ammo` pickup kind (a foam box on the floor, slow turn and bob, collected within 1 m) that adds its count to the reserve of every blaster that takes its dart type, never past `reserveMax` and staying put at a full reserve; the file's `darts-*` `pickups` entries spawn at load and on Try again / Play again; the validator rejects a dart type that is not in `data/darts.json`; the Pit keeps `pit-ammo` and gains one on the far side, the Ring one by each pillar; the watch shows the boxes on the floor; `PU-ammo` | In progress 2026-11-04 (Qwen 3.8-27B via Pi) | LVL-01, GAME-07 |
| LVL-02b | (card: `tasks/LVL-02b.md`) Levels with several arenas played in order, and Level 1-2 beats 1 to 4 (open, parry corridor, the Ring arena, breather) | Done 2026-11-06, reviewed by Claude, merged locally, not pushed (Qwen 3.8 Flash Next via Pi, dgx-spark) | LVL-01, LVL-02a |
| LVL-02c | (card: `tasks/LVL-02c.md`) Level 1-2 beats 6 to 9: the Crossroads arena, breather 2, the tiered bowl gauntlet and the lit exit, after a marked gap for the tower (beat 5, later) | Done 2026-11-06, reviewed by Claude, merged locally, not pushed (Qwen 3.8 Flash Next via Pi, dgx-spark) | LVL-02b |
| LVL-02d | (card: `tasks/LVL-02d.md`) The nav grid holds four walkable layers per cell; Level 1-2 beat 5, the tower climb | Done 2026-11-06, reviewed and merged locally (branch `lvl-02d`): stage 1 nav.maxLayers 4 / topMetres 17, tests; stage 2 the A5 tower filling the bay (four floors, three ramps both a player and a Foamer walk, two lock-free fights, a plug that drops as one slab), stage 3 docs (DeepSeek V4.1 Flash via Pi) | LVL-02c, BUG-01 |
| LVL-03a | (card: `tasks/LVL-03a.md`) Level 1-3 beats 1 to 5: the bay, the explore corridors, Arena 1 the Pit (A1), the catwalk breather, Arena 2 the Yard (A6), a temporary exit | Done 2026-11-06, reviewed and merged locally (DeepSeek V4.1 Flash via Pi, branch `lvl-03a`; review moved two Pit rifts out from under the north ramp; a first Spark run hit its output limit with nothing written): stage 1 the bay (three foam dummies, ammo) and explore 1 (one Slowmer and one Swarmer from the side seams), stage 2 the Pit (4 m floor, south and west ledges, two ramps, six then eight Swarmers then two Slowmers), the breather, the Yard (six islands with ramps, four gates, eight then ten Swarmers, three Slowmers) and the temporary exit, stage 3 docs. `data/levels/1-3.json` plus the test file; no change to shared game code | LVL-02c, GAME-10d |
| LVL-03b | (card: `tasks/LVL-03b.md`) Level 1-3 beats 6 to 9: the A4 hall chase into a 6 m drop that seals, breather 2, the A2 Ring gauntlet, the lit north exit | Started 2026-11-06 (DeepSeek V4.1 Flash via Pi, branch `lvl-03b`) | LVL-03a |
| BUG-01 | (card: `tasks/BUG-01.md`) Two Pit stalls: a player under the ring is pathed to 4 m up (the bake read the ring's top over the open floor), and a wave spawned in a clump beside the south ramp froze (two Foamers' capsules both asked the character controller to walk into the other). Fixed by a layered bake (ring top and floor both walkable), a walk that ignores other Foamers' bodies, a sidestep guard, and a step limit the walk can actually take. Round 2 review found the ring's top had been baked away and the ramp-side stall was hidden, not fixed: both are fixed now | Done 2026-11-05, round 2 (DeepSeek V4.1 Flash via Pi + Claude review) | ENG-08, GAME-10a, GAME-10b, LVL-01 |
| BUG-02 | (card: `tasks/BUG-02.md`) The `parryNext()` watch helper times a lobbed ball by straight-line distance over speed, so the raise lands out of the parry window and blocks instead of parries; `spawnPack()` puts a pack's ring spots without a walkability check so in the Pit members spawn inside the central block and get stuck. Fixed with a shared flight-time function (same gravity and step as the projectile's own update, the segment against the capsule spine) the watch helper uses instead of the line; `spawnPack` tests a ring spot's standability against the nav grid (a new `canStandAt` on the grid: the layer an agent's feet sit near, autostep up, full step down) before placing a member, steps a few in along the angle when the spot fails, and skips a member the steps cannot place | Done 2026-11-06, reviewed by Claude, merged locally, not pushed (Qwen 3.8-27B via Pi, qwen-machine; the parry helper lands 2 in 10, the Pit pack needs BUG-03) | GAME-04b, GAME-10d |
| BUG-03 | (card: `tasks/BUG-03.md`) The nav grid sees destructible blocks: it baked once at load, before the level's voxel pieces had their colliders, and a cell inside a solid block read as floor (the pieces collide as hollow trimeshes the shape cast only met). Fixed with a solid-voxel hook the bake probes per stand-able surface, a `piecesReady` rebake the shared frame fires once the level's mesher drains, and a volume-backed `solidAt` wired in by `makeLevelAI` (the range and gym maths build a grid without it). The cell inside the Pit's block is no longer a floor and the block's top is an obstacle; a carve that empties it passes again. The bake is not measurably slower (Pit: 55.8 ms without the hook, 45.4 ms with; the 40x40 budget test reads 36.4 ms bake, 1.158 ms query) | Done 2026-11-06, reviewed by Claude, merged locally, not pushed (Qwen 3.8-27B via Pi, qwen-machine; checked in the browser) | BUG-01, BUG-02 |
| BUG-04 | (card: `tasks/BUG-04.md`) Find why `parryNext()` parries 2 balls in 10 in the Pit and make it 9 in 10; the helper lowers the disc after its try | Stopped 2026-11-06 at 2 in 10 (branch `bug-04`, work in progress; a lead in HANDOFF); continued and merged as BUG-06 | BUG-02, BUG-03 |
| BUG-05 | (card: `tasks/BUG-05.md`) Swarmers reach the outside of a locked arena door too fast and then stand with no path: find why and fix | Not merged 2026-11-06 (branch `bug-05`, DeepSeek V4.1 Flash via Pi): the cause was the review's own test (the player still at the level start, beyond the open door, so the pack rightly chased them out); the leash fix would stop a range pack spawned 20 or 30 m out from reaching the player. Worth keeping from the branch: `tests/ai/pit-rig.ts` building the grid with the voxel pieces | GAME-10d, BUG-03 |
| BUG-06 | (card: `tasks/BUG-06.md`) A ball meets the player's capsule from behind, so a parry in the Pit reads as a hit: find why and fix, so BUG-04's Pit test parries 9 in 10 | Done 2026-11-06, reviewed and merged (DeepSeek V4.1 Flash via Pi, branch `bug-06` from `bug-04`): two causes, `ProjectileSystem.update` scaling the velocity by Rapier's `timeOfImpact` (metres, not seconds) so every ball overshot the capsule, and a fresh ball bursting on the foam chunks a parried ball left at the thrower's hand. Stage 2 of the Pit test: 2 of 10 before, 10 of 10 after | BUG-04 |
| BUG-07 | (card: `tasks/BUG-07.md`) A Roamer throws only when its ball's flight to the player is clear, and moves when it is not | Done 2026-11-06, reviewed and merged locally (DeepSeek V4.1 Flash via Pi, branch `bug-07`): `ProjectileSystem.flightClear` samples the launch's own arc in `ball.flightSegments` shape casts with the ball's own filters, `FoamerSystem` caches it on the Foamer, and the F02 brain withholds the ranged request while it is false. Pit case: 18 thrown, 0 reached, 17 burst before; 13 thrown, 13 reached after. Not checked by eye in a browser | BUG-06, LVL-02d |
| BUG-08 | (card: `tasks/BUG-08.md`) A Roamer blocked for too long leaves its ring and walks its path to the player until a throw is clear | Done 2026-11-06, reviewed and merged locally (DeepSeek V4.1 Flash via Pi, branch `bug-08`; browser: tower Roamers walk down, 10 thrown, 10 hit): the F02 brain counts the seconds it has held without a clear flight (`blockedSeconds`) and past `brain.blockedRepathSeconds` (3) stops sidling and walks its path to the player, backing off instead inside its retreat distance; a clear flight or arriving inside the retreat distance resets the count. Tower, player under the slab: 0 thrown, 0 reached before; 10 thrown, 10 reached after. Pit unchanged at 12 thrown, 11 reached. Not checked by eye in a browser | BUG-07 |
| BUG-09 | (card: `tasks/BUG-09.md`) `finisher.test.ts` test 1 fails now and then in a full run; find the cause and make it deterministic | Done 2026-11-07 (Qwen 3.8-27B via Pi, qwen-machine), reviewed and merged locally: two causes, both test-only. (1) The `settle` helper in all eight `tests/foamers/*.test.ts` waited one `setTimeout(0)` for the part mesh promise; under a loaded event loop the mesher's chain can take more than one macrotask, so the trimesh collider was missing or stale when darts were fired (proven by forcing the fake mesher one macrotask slower: the crossing shot misses and the flag never sets). Now a wait-until-`busy`-is-false loop (the pattern `tests/level/level-1-3.test.ts` already uses). (2) Test 1's crossing health was band + 2, which needs two effective dart damages (a body dart's 1.0 plus its bounce re-hit of 1.0 at 13.04 m/s over the 8 m/s floor); at band + 2 the test passed only when the bounce re-hit the body, but a probe running test 1 in-process for 80 repetitions failed 2 of 80, and in the failures the bounce dart kept hitting debris chunks or the floor (health stopped at 2.80, above the band 1.80). The crossing hit is now band + 0.5, decided by the single dart alone (60/60 in-process). Not checked by eye in a browser | BUG-07 |
| BUG-10 | (card: `tasks/BUG-10.md`) The nav bake, Pit bake and rig "never snaps" tests fail under a busy machine; make them pass without loosening what they check | Done 2026-11-07 (Qwen 3.8-27B via Pi, qwen-machine), reviewed and merged locally: the machine ran about 85 per-file forks on 12 cores, so each timing sample got little over 15 percent of a core and wall time measured the machine, not the work (bake 36 ms idle, 220-300 ms loaded; the rig test's ~700k one-argument expect calls plus no CPU time ran it past the 5000 ms timeout, 7.4 s wall). Fixes, same budgets: (1) `vitest.config.ts` `maxWorkers: 6` so each fork is well fed and wall time reflects the work's own cost (loaded runs: bake 68-95 ms, query 1.1-1.5 ms, suite still ~7 s); (2) the two timed bakes and the path query now assert on the minimum of 9 identical samples, not the mean (median of 9 was still 220-300 ms under load); (3) "never snaps" keeps every frame, rig and the 0.35 rad limit but collects the worst per-frame jump per rig and asserts once per rig with the frame named (1.43 s to 0.11 s idle, 0.11-0.17 s loaded). Five loaded full runs green after, 5 of 5 red before | BUG-09 |
| AUD-00 | Record Paul's blasters (session list in 8.3) | P | |
| AUD-01 | (card: `tasks/AUD-01.md`) Sound system: Web Audio mixer, sound bank in `data/sounds.json` keyed by the IDs in `design/SOUNDS.md`, code-made placeholders for every sound, spatial one-shots and loops, hooks for blasters, darts, Foamers and the player, a Sound panel on the range | Done 2026-11-02 (Pi + Claude review) | GAME-09 |
| AUD-01b | Paul's recordings (`design/SOUNDS.md`) edited, layered and dropped into the sound bank | Claude + P | AUD-00, AUD-01 |
| UI-01 | (card: `tasks/UI-01.md`) Player health and damage, HUD v1, pause menu, settings with difficulty presets | Done 2026-11-03 (Pi + Claude review) | GAME-09, AUD-01 |
| QA-02 | Playtest with players aged 10+ [Paul: who?], collect notes | P | all above |

### Phase 3 (P2): Content

| ID | Task | Owner |
|---|---|---|
| GAME-15 | Remaining blasters, mods and upgrades (was a second GAME-11, renumbered 2026-11-02) | F + B |
| GAME-12 | Remaining Foamers and elites | F |
| GAME-13 | Bosses | A + F |
| LVL-02 | Act 1 levels | F + P |
| LVL-03 | Act 2 levels | F + P |
| LVL-04 | Act 3 levels | F + P |
| ART-06 | Level kits per setting | 3D + F |
| AUD-02 | Music with dynamic layers | SND + P |
| AUD-03 | Voice lines | P |
| UI-02 | Menus, level select, upgrade screen, codex, title screen with logo | F |
| GAME-14 | Save system (local; cloud if Q3 says yes) | F |
| B-01 | Codex entries, barks, tooltips from Paul's story | Fable / B + P |

### Phase 4 (P3): Polish and release

| ID | Task | Owner |
|---|---|---|
| QA-03 | Performance pass across browsers and the low preset | A |
| QA-04 | Accessibility pass (section 10) | F + P |
| QA-05 | Content safety pass against section 2 rules | B + P |
| OPS-01 | Hosting at dart.contrapaul.com on Paul's Cloudflare setup (set up early, at PRE-09, so every push is playable) | A + P |
| OPS-02 | (card: `tasks/OPS-02.md`) Asset loading/streaming and caching: the physics WebAssembly as its own hashed .wasm file instead of 4.1 MB of base64 in a chunk | Done 2026-11-06, reviewed by Claude (three fixes), merged locally, not pushed (Qwen 3.8-27B via Pi, qwen-machine) |
| QA-06 | Final playtest round | P |

---

## 13. Open questions

All twelve answered 2026-10-29.

| # | Question | Answer |
|---|---|---|
| Q1 | Movement: fast with double jump (2016) or grounded and heavy (Dark Ages), or in between? | Hybrid: 2016 speed and dash, no double jump, Dark Ages weight |
| Q2 | Target age range, and is this for students/classroom use, public release, or both? | 10+, public release |
| Q3 | "Single player online": play-in-browser only, or also cloud saves / leaderboards / accounts? | Browser play only, local saves |
| Q4 | Target devices: which low-end machine do we benchmark on? Chromebooks? Tablets? | Mid-range laptop with integrated graphics (specific machine still to name) |
| Q5 | Engine: approve Three.js + Rapier + custom voxels? | Yes |
| Q6 | Foamer look: blocky voxels, or smoothed voxels that look more like foam? | Blocky voxels (changed from smoothed on 2026-10-31, after the sandbox) |
| Q7 | Music direction | Pop-punk / metal lite |
| Q8 | Free or ever sold? (affects which generation tools' licences we can use) | Free forever |
| Q9 | Which image, 3D, audio and coding models do you already have access to? | Coding agents only (names to list); assets generated by code for now |
| Q10 | Rough timeline or target date? | Vertical slice in about one month: P0 2026-11-12, P1 2026-11-29 |
| Q11 | Domain and repo name (public or private repo)? | dart.contrapaul.com, public repo |
| Q12 | What is the shield, physically, in the fiction? | Foam disc buckler, throwable like a frisbee |

### New questions raised by these answers

| # | Question | Answer |
|---|---|---|
| Q13 | Which laptop is the benchmark machine? | A base Apple Silicon Mac; plus a Windows iGPU check (Proposed) |
| Q14 | Which other coding agents do you use, so section 11.1 can assign them? | Pi |
| Q15 | Do you want to try an image or 3D tool later (for example Hunyuan3D run locally), or stay all-code for assets? | Try Hunyuan3D locally (spike ART-00) ; replaced 2026-11-01 by Kimi K3.1 Pro writing Blender scripts, section 5.2 |
| Q16 | Do you own any real foam blasters we could record for sound effects? | Yes, several |

---

## 14. Decisions log

| 2026-11-06 | BUG-08: the blocked timer is a system clock read by the brain, and it lives in the existing hold state (DeepSeek V4.1 Flash via Pi; `tasks/BUG-08.md`). BUG-07 left a Roamer holding with no clear flight sidling its ring, which finds a clear spot when one exists on the ring; the tower's floor 2 over a player under the slab has none, so it sidled for the whole fight (0 thrown, 0 reached in 30 s). The Foamer keeps the seconds (`Foamer.blockedSeconds`, reset on a clear flight and on arriving inside the retreat distance), the system fills `AgentInput.blockedSeconds`, and the brain reads it only in hold: under `brain.blockedRepathSeconds` (3 s, `data/ai.json`) it sidles, past it, it walks its path to the player, and inside its retreat distance it backs off, since there is nothing nearer to walk to. No new state: hold plus `followPath` already exists as a move, the state machine only cares whether the Foamer may attack (it may not: the flight is blocked), and a fifth state would need its own entry in every `F01State` consumer (the F01 and F04 brains, the system's state switch) for one extra move. Arriving at the retreat distance resets the clock, otherwise the Roamer would pace in and out of the ring forever: the ring takes over again and, if a spot has cleared, it throws. The 3 s is a compromise measured on both rigs: at 4 s the Pit keeps 13 thrown and 12 reached, at 5 and 6 s the tower still reaches (6 and 5 balls) but the Pit drops to 12 thrown and 11 reached, and a longer hold makes the Roamer dance its ring while the player stands still. Limits, not bugs: a Roamer on a floor whose ring is blocked and whose path the nav grid cannot join to the player keeps holding, and one still less than 3 s into a block looks like it did before BUG-08. | 4.3 |
| 2026-11-06 | BUG-07: the flight check sits at the windup's start and again at the release, and the F02 brain reads a cached answer rather than casting per step (DeepSeek V4.1 Flash via Pi; `tasks/BUG-07.md`). The sight ray runs chest to eye, but the ball leaves the ball hand lower and on a lofted arc (`ProjectileSystem.launch`), so a clear sight is not a clear throw: the Pit's wave 2 burst 8 of 10 balls 1.7 m from the hand. `flightClear(from, eye)` rebuilds that same velocity (`launchVelocity`, shared with `launch`) and walks `ball.flightSegments` (6) shape casts of the ball's radius along the arc, filtered by `ballIgnores`, the ball step's own test, so level geometry stops the check while the player's capsule, foam chunks and Foamer parts (the thrower's own hand included) do not. Both checks were kept: the start is the cheap one and saves a wasted token and an animated throw, and the release is the backstop because a 0.6 s windup is long enough for the player to step behind cover. The answer is cached on the Foamer for `brain.flightCheckSeconds` (0.25 s, four casts a second at most) because a shape cast per Foamer per step is not free; `handAt` and `launchVelocity` are shared with the launch so the check and the flight cannot disagree, and the arc's span is the flight time `launch` aimed with (flat distance over flat speed), not the speed vector's length, which was the first bug: it sampled 30 percent past the player and hit the floor behind them. A blocked thrower gives the token back with the new `noFlight` reason and its brain keeps sidling the ring or closing in, so it never freezes. A multi-shot volley is exempt (`singleBall`): F04's three-shot fan is many arcs and one centre arc is not what it fires, which is why its volley tests pass unchanged. Before: Pit 18 thrown, 0 reached, 17 burst; after: 13 thrown, 13 reached. Tower with the player under the slab: 5 thrown, none bursting above y 3; on floor 2, 22 thrown and 21 hits | 4.3 |
| 2026-11-06 | BUG-06: a ball's ray hit is a distance, not a time (DeepSeek V4.1 Flash via Pi; `tasks/BUG-06.md`). `ProjectileSystem.update` read Rapier's `castRay` `timeOfImpact` as seconds and did `b.pos.addScaledVector(b.vel, t)`, so a ball that hit the path 0.13 m along the ray moved a full second's flight, about 1.27 m, through the capsule's front; `onHitPlayer`'s `from` (0.5 m back along the velocity) then sat behind the capsule's centre and `shield.blocksAttackFrom` judged the throw as coming from behind, so a parry read as a hurt. The dart system already documents `timeOfImpact` as metres along the unit ray and the fix matches it: `addScaledVector(b.vel, t / speed)`. The card's four candidates were checked and none was it: the cast starts outside the capsule (ball at 1.70 y, 0.16 m out, hit at 0.13), the capsule collider and the timed centre are the same point (`cap` and `pc` both (0, 0.92, -8.00) on every hit), and nothing lands on the cap. Second cause, found with the same instrumentation: a parried ball bursts on its thrower and leaves foam chunks at the ball hand, and the next ball's ray stopped on them (collision groups `0x40001`, `DEBRIS_GROUPS`) 0.03 to 0.12 s after leaving the hand, so it never reached the player; the ball's ray now passes debris, as the darts do. What this changes by hand: a ball now meets the player where the ray says, so a block or parry from the side judges on the throw's real direction; the parry window and the shield's numbers are untouched. | 4.3 |
| 2026-11-06 | BUG-03: the bake asks the level's voxel volume, not the physics world, whether a point is solid, and it asks once the volume is filled. Solid voxels are voxels in `VoxelVolume`, and the meshed surfaces the bake tested against (the shape cast) are the trimesh colliders those voxels make: a hollow shell. The ray finds the shell's faces and the shape cast, which stands outside it, passes, so a cell dead centre in the Pit's block read as floor. `bakeCell` now has a `solidAt(x, y, z)` hook (set by `makeLevelAI` from the level's `VoxelVolume` and the voxel mesh's origin; a test world without level pieces builds a grid without it, so pages and the grid's own tests are unchanged). For every candidate the depth ray lands on, the hook probes the agent's column at heights 12.5%, 45%, 87.5% of its height above the surface, and a candidate the agent stands in solid voxels is not a layer: in the Pit's block the ray meets the top at 3.2 and the Pit's floor under it, the top is stand-able (the probe at 0.2 m above it is clear and the shape cast clears the block), and the floor is rejected because the agent's body is inside the block. A carve that empties it removes those voxels and the carve's own rebake walks it again. The level's pieces have their colliders a few frames after the load-time bake (the meshers run off the main thread), so the bake is wrong for them then; the shared game frame (`src/game/game.ts`) calls `levelAI.piecesReady()` (a rebake of the level's bounds) once the level mesher's backlog goes empty for the first time, so the first Foamer to path already sees the block as a solid. The hook is wired by `makeLevelAI` (not the grid's constructor): the grid stays free of voxel imports and every page gets the hooked grid through that one function. The hook's cost is a few array reads on top of what the bake already does; the 40x40 budget test reads 36.4 ms bake, 1.158 ms query, and on the Pit's own bounds a full bake runs 55.8 ms without the hook and a rebake through piecesReady 45.4 ms with it, so the budget is untouched. `src/ai/nav-grid.ts` touched only `bakeCell` and the hook plus a page field (the card's limit, LVL-02d's layer work runs on the same file). | 4.3 |
| Date | Decision | Section |
|---|---|---|
| 2026-11-07 | GAME-10f: the Brawler fights with the Roamer's brain and adds two states, not a brain of its own (Qwen 3.8 Flash Next via Pi; `tasks/GAME-10f.md`). Its one attack token is `melee`, so the system's brain pick already gives it `f01`: it walks in and punches in reach, which is stage 1 whole with a `punch` attack in the data. The leap is the F05's shape again: `crouch` and `leaping` are entries on `FoamerState` run by the Foamer system's state machine (as the Darter's `telegraph`, `charge`, `wallStun` are), the maths is a pure module (`src/foamers/leap.ts`: `landingPoint`, `leapFlight`, `stepShockwave`, `bandReaches`, no Three.js, no Rapier), and the one decision the brain side asks is `decideLeap` in `src/ai/f07-brain.ts`, the sibling of `decideCharge`. A `f07-brain.ts` with its own state machine would have been the F01 file with the leap bolted on. | 4.1, 7.5 |
| 2026-11-07 | GAME-10f: the arc's vertical speed is read from the state clock, not integrated, and the flight is stepped on the `vy = 0` line (Qwen 3.8 Flash Next via Pi). `leapFlight(metres, speed, arcMetres, gravity)` returns `seconds = max(2*sqrt(2*arc/g), metres/speed)` and `vy = g*seconds/2`, so the parabola leaves and lands on the ground it left and reaches `arcMetres` at its apex. In the step, `f.vy = f.leapVy - gravity * f.stateTime`: the character controller reports the Foamer grounded on the frames just after the launch (it is still within its snap distance of the floor) and zeroes a `vy` the step had accumulated, which held the Brawler at the apex for the whole flight (seen: `y` pinned at 2.43 from t 0.52 with `vy` reading 0.0). The horizontal part goes the way the charge's does, through `this._wish` at `leap.speed`, because `moveTowards` caps the wish at `f.speed()` (2.4 m/s) and the leap's 7 would never arrive. The landing fires at the end of the time whether or not the distance was covered: a leap blocked by a wall still lands its ring. | 4.1 |
| 2026-11-07 | GAME-10f: the shockwave is one torus per Brawler, grown by scaling, and the hit test is the band crossing, not a distance test (Qwen 3.8 Flash Next via Pi). The mesh is `TorusGeometry(shockwave.radius, shockwave.tubeMetres, 8, 48)` rotated flat, in the type's own colour from `linearColorTable()`, `depthWrite: false`, owned by the Foamer group like the glow group, parked `visible = false` until a landing. The geometry is rebuilt when a wave starts (once a leap, not per frame) and `scale.x/z` is `radius / shockwave.radius` as it grows. `bandReaches(w, playerMetres, spec)` is what makes the card's teaching work: the band is a ring with a hole, so a player who was inside the hole while it grew (in the air, or already inside when the edge passed) is missed for good (`passed`), and the one hit is marked on the ring (`hit`) inside `bandReaches` so no caller can forget it. The system asks `playerVulnerable()` (the pages: `player.grounded && !player.dashing`) before it even measures the distance, so a jump or a dash is what the card says it teaches. The page costs `shockwave.damage` itself, the same way it costs a bonk with `damageOf`: the system only reports, so the unit tests need no health system. The ring stays where it landed; the Foamer moves on under it. | 4.1, 7.5 |
| 2026-11-07 | GAME-10f: the sword or fists question is left open, as the card says (Qwen 3.8 Flash Next via Pi). The rig keeps CONTENT-PLAN 3.3's huge fists with knuckle nubs, coloured lime (`foam-lime`, the sword's colour), and `data/foamer-rigs.json` carries the `[Paul]` note, repeated in this log: sword or fists is Paul's to choose. Losing both legs ends the leap (`decideLeap` takes `onFeet`, and a legless Brawler crawls and punches as the F01 does); losing an arm does not stop it, which test 8 of `tests/foamers/brawler.test.ts` pins both ways. `F07-crouch`, `F07-punch` and `F07-land` are placeholder synth IDs in `data/sounds.json` and `design/SOUNDS.md`, and the hurt line is the shared `PL-hurt`. | 3.3, 5.3 |
| 2026-11-06 | GAME-10c: the Floater fights with the Roamer's brain (`decideF02`), it does not get a new one (Qwen 3.8 Flash Next via Pi; `tasks/GAME-10c.md`). Its one attack token is `ranged`, so the system's brain pick already gives it `f02`, and everything the card asks of a Floater brain (walk in, keep a ring, back off inside the retreat distance, only throw on a clear flight) is what `decideF02` does with the BUG-07 flight check and the BUG-08 blocked clock already in it. What is the Floater's own is the data: `preferredDistanceMetres` 12 (the ring it starts at), `retreatDistanceMetres` 8, and its attacks' `range` 14. A new `f06-brain.ts` would have been the F02 file with three numbers changed, and every number already lives in `data/foamers.json`. | 4.1, 7.5 |
| 2026-11-06 | GAME-10c: the Floater floats by data and by the nav grid's own ground, not by a new movement system (Qwen 3.8 Flash Next via Pi). The rig's `movement: "float"` already had a bob style in `rig-motion.ts`, and the rig `hover` field lifts the posed mesh, but it is a drawing height, not a physics height, and `rig.test.ts` pins the rig's lowest point to it: so the rig keeps no `hover` and the number that matters lives in the type's `float` block (`data/foamers.json`: `hoverMetres` 3, `bobMetres` 0.12, `damagedHoverMetres` 1.2, `damagedSpeedShare` 0.6, `fins`). The step reads it: while a fin is attached and it is not falling, gravity is zeroed and the feet are set to `navGrid.groundAt(x, z, y)` plus the hover each step (the query's `y` picks the walkable layer nearest the Floater, so one over the tower's floors floats over that floor), and it steers through the same `steerAgent`/`navigate` a walker uses, told to path from that ground (`Agent.navigate` takes the feet height, which for a walker is its own). No fins, or a fall: the block stops, gravity and the character controller take over, and the killed Floater goes down exactly as the ground types do. Its speed is `rig.speed`, not `f.speed()`: the no-legs handicap would otherwise hand a Floater 0.25 times (it has no legs to lose). | 4.1 |
| 2026-11-06 | GAME-10c: a blob is a ball of a kind, not a second projectile system (Qwen 3.8 Flash Next via Pi). `ProjectileSystem.launch` takes an optional `BallKind` (speed, gravity, radius, lifetime, chunks, colour material, bounce count, live cap, and the attack whose damage it costs), all read from the type's `blob` block by `src/foamers/blob.ts`; with none it throws the shared ball exactly as before, which is why F02 and F04 are untouched. Parryability stays what it was, material identity (`b.mesh.material === BALL_MATERIAL`, checked by both pages): the big pink blob is launched with the Roamer's own material, so the pages parry it and bounce it back at its thrower unchanged, and the small fan is lime and is not parryable. A small blob's bounce is the ball's own ray step reflecting about the hit normal (hence `castRayAndGetNormal`) and losing `BLOB_RESTITUTION` (0.75) of its speed, `blob.bounces` times, then bursting; the player is not a wall, a blob meeting them is hit and bursts. Review fix: after a bounce the blob is lifted off the surface by its radius along the normal; left touching, the next ray started inside the surface (a zero normal) and spent the next bounce at once, so in play it burst on the floor. The blob count, fan spread (12 degrees), bounce count, every-fourth big blob and the 12 live cap are data; the every-fourth counter turns on the Foamer (`blobTurn`) at the release, where the attack really fires, not in the brain. Each page prices a hit with `damageOf(b.attack, b.thrower.spec)`, so the spit costs 3 and the big blob 10 from the type's own attacks. | 4.1, 7.5 |
| 2026-11-06 | GAME-10c: the open mouth is a state test in `handleHit`, keyed by data (Qwen 3.8 Flash Next via Pi). The type carries `mouth: { part: "jaw", damage: 2.5 }`; a dart on that part while the Foamer's state is `windup` or `strike` (the jaw is down through the spit) takes the share, and shut it is an ordinary part with the ability kind. A separate timed window was not worth a field: the jaw pose (rig-states' `spit`/`bigBlob` windup and strike motions) and the weak point must agree, and the attack's own states are what move the jaw. The test drives one synthetic `darts.onHit` rather than a fired dart: a fired one ricochets and the hits it makes vary with the blended pose. | 3.1, 4.1 |
| 2026-11-06 | GAME-10e: the Blocker's slot is worked out by the Foamer system, not by its brain (DeepSeek V4.1 Flash via Pi; `tasks/GAME-10e.md`). One brain cannot see the other Blockers, so the wall would have no line: `FoamerSystem.assignSlots(player)` runs before the bids, sorts the live Blockers by agent id (so a slot never swaps owner), and writes `slotX`/`slotZ`/`slotDistance`/`shieldBroken` onto each one's `AgentInput`. The slots are `slots.spacingMetres` apart on a line across the player at `slots.holdMetres`, with an offset of `(i - (n-1)/2)` so one Blocker takes the middle and the line only grows. The brain then only chooses to walk to the slot or stand on it. | 3.4, 4.1 |
| 2026-11-06 | GAME-10e: reaching a slot needs its own movement intent. `Agent.navigate` always paths to the player (the nav grid has no goal other than the player), so a Blocker steered by `followPath` would walk past its slot. `MoveIntent` gains `toSlot`, and `steerAgent` builds a one-point path to the slot and hands it to the same `steer()` (arrival slowing, separation), reusing a `makePath(1)` kept on the system. | 3.4, 4.1 |
| 2026-11-06 | GAME-10e: a Blocker fires from approach, like a Roamer, not from hold. The state machine only starts an attack in approach or crawl, so a token in hand sends the brain from hold back to approach with `stand` when it is already on its slot; otherwise the token would sit in its hand and no volley would ever leave. Found by running the wall headless: it held the token with `windup` never entered. Choosing the attack is still `chooseAttack`, which picks the volley while the blaster is on, and the volley's `range` (16 m, pinned in the type) contains the 9 m slot, so `mayAttack` is satisfied where the wall stands. | 3.4, 4.1 |
| 2026-11-06 | GAME-10e: a broken shield is the Roamer's brain, not a second copy. `decideF04` hands the step to `decideF02` when `shieldBroken` is set (the shield part is gone from `f.parts`), so the Blocker keeps the throw distance and never goes back to a slot. The slot fields are read only by the F04 brain; the agent keeps one `Brain` field with an F02 context, and the system copies the slot fields only for an F04. | 3.4, 4.1 |
| 2026-11-06 | GAME-10e: the charge stagger is the type's own time, and the shield is down for free. `knockBack` in `src/player/shield.ts` reads `stagger.shieldChargeTime` (1.2 s) when it starts the short stagger; a staggered Blocker reports `f.state === "stagger"`, which `armour.ts` already treats as no cover, so a dart during the window hits from the front for full damage without a second rule. The charge itself (`plateStopsShield`, the bounce) is untouched: setting it would send the charge down a branch that never staggers. | 3.4, 4.1 |
| 2026-11-06 | GAME-10e: the range's F04 choice spawns the line of three (`FoamerSystem.spawnLine`), reading `line.count` and `line.inboundSteps` from the type, the way `spawnPack` reads `pack`. `spawnPack` stays swarm-only (its cap counts swarm tokens); a blocked line slot slides outward along the line before the member is skipped. The watch already lists any Foamer from `foamers.list`, so the Blockers appear with no extra range code. | 3.4, 4.1 |
| 2026-11-06 | BUG-02: the watch helper's timing is a flight, not a line (Qwen 3.8-27B via Pi; `tasks/BUG-02.md`). The helper asked straight-line distance over speed for a ball that flies a loft under gravity, so the raise landed out of the parry window and the ball burst on the disc as a block (the six-try, zero-parry from the GAME-06 and GAME-04b reviews). The fix is a shared pure function, `timeToImpact` in `src/foamers/ball-time.ts`: it steps a copy of the ball's position and velocity with the projectile's own gravity and the page's step, so the numbers stay the sim's, and returns the step at which the ball's flight segment first comes within reach of the player. The distance is the one that hits: the segment against the player's capsule spine (radius plus the ball's, the same shape the projectile's own raycast meets), not the centre, because a ball aimed at the eye arrives a full head above it. The capsule centre is read from the eye minus `eyeHeight`, the page's own read. `parryNext` waits that time minus the shield's `parryLead` (the raise lands inside the window, not before it and not after) and then holds the disc, on the game page through `fixedStep` and on the range through the loop's own step, which the helper cannot call. The helper's internals did not change the shield: no parry rule or number was touched. `tests/foamers/ball-time.test.ts` checks the straight ball against the real `update` loop's time (within two steps, the loft out by one), and `tests/shield/parry-next.test.ts` walks the helper's own wait, raises, and asserts the ball bounced and the shield parried; a companion test shows the old distance-over-speed wait lands out of the window on a 20 m loft (the gap is more than a window), which is the demonstrable fail the card asks for. | 3.2 |
| 2026-11-06 | BUG-02: `spawnPack` asks the grid before it places a member, and a member the grid cannot host is skipped, not stuck in a wall (the Pit's central block). With a nav grid, a ring spot is used only if an agent of the grid's size can stand on it: a new `canStandAt` on the grid asks the layer the feet sit near (not the lowest, because a block's top face is walkable and a stand must read it a top, not a floor) within the stand's own rules (autostep up, full step down). A blocked spot is stepped a few in along the same angle (data `pack.inboundStepMetres`, `pack.inboundSteps`) before the member is skipped (neither spawned nor counted), so a skipped member means no pack slot and the next pack is not filled against a ghost. Without a grid (the range, older tests) the placement is unchanged. The numbers are in `data/ai.json` `pack` (`inboundStepMetres` 0.5, `inboundSteps` 4). `tests/foamers/pack-walkable.test.ts` (a block whole under a pack: nobody spawns and the skipped members neither spawn nor count; a block off to a side: the full pack is stepped in past it and none stands on it) fails on the old placement and passes on the new. | 4.1, 4.3 |
| 2026-11-06 | OPS-02: the physics WebAssembly ships as its own content-hashed file (Qwen 3.8-27B via Pi; `tasks/OPS-02.md`). Route 1 of the card, chosen over keeping the compat package on a URL because it needs no copy of the engine in the repo and stays the same 0.21.0 upstream. The 58 files keep importing `"@dimforge/rapier3d-compat"`; a `resolve.alias` in `vite.config.ts` (and `vitest.config.ts`) points that name at `src/physics/rapier-shim.ts`, which re-exports the non-compat `@dimforge/rapier3d` (pinned exactly) with a no-op `init()`: the non-compat build has no `init` to await, its `.wasm` is an ES module import that resolves as soon as the import does, so the shim's `init` merely exists so the 38 `RAPIER.init()` call sites need no change. The non-compat package has no `"exports"` field, so a second alias maps `@dimforge/rapier3d` to its `rapier.js` entry; Vite's built-in wasm plugin (no extra plugin needed in Vite 8) then compiles the `.wasm` as a separate hashed asset with streaming in the browser and reads it from disk under Vitest. In Vitest the whole package must go through Vite's transform (`test.server.deps.inline`, not `server.deps.inline`): externalized, the raw Node ESM load and the inlined load end up as two module copies and the `.wasm` state lands on the copy the tests do not use; inlined, one copy is shared and the wasm plugin resolves the glue's `.wasm` import. A guard test (`tests/core/no-inlined-wasm.test.ts`) fails the suite if a built chunk ever carries the base64 magic again (`AGFzbQ`). `public/_headers` needed no rule: the `.wasm` sits under `/assets/` (immutable, one year) and the Worker serves `application/wasm` for that extension by default (checked by fetching it from `npx vite preview` for both the raw and the dev server). | 7.6 |
| 2026-11-06 | GAME-08: the foam vacuum (D09; Qwen 3.8-27B via Pi). The tool's numbers live in `data/vacuum.json` (reach 3 m eye to chest, cone cos 0.97, lock 0.9 s, one charge with a 15 s recharge, the nozzle puff) and `data/foamers.json` gains a per-type `vacuum: {allowed, ammoShare}` (F01, F02 and F05 allowed; a type with no entry is never a target, the heavies come later with their upgrades). `src/game/vacuum.ts` is the finisher's sibling: it spends the `use` key the way the finisher spends `melee` (a target and a charge take the press and start the lock; a target without the charge plays the empty sound and still takes it; with no target the press stays for the page's old use, the course's block throw). The lock holds the player as the finisher holds it (the shared step stops the controller, the melee and the shooting while it runs) and turns the view onto the Foamer; from halfway through the turn the Foamer is drawn to the nozzle and shrunk to nothing: a scale anchored on the feet plus a translate, set fresh each step on its world group (the part groups are local-to-world, so the whole rig rides the transform; no physics, the root stops driving them in its finish state). Removal is `FoamerSystem.suck`: no pop chunks, no pop stats, one capped white-foam puff at the nozzle. The reward is `Loadout.refillReserves(activeShare, otherShare)`: each blaster takes ceil(share times its own reserveMax), capped by its own space; it is the one credit path the ammo box's refill shares (the card's "both go through one function"), and no pickups are spawned (D08: Paul wants boxes placed, not dropped). The placeholder tool is a code-built foam tube and nozzle on the camera that rises while the blaster dips; the HUD adds one `#vacpip` recharge bar and reuses the finisher's crosshair prompt with the `use` key name (the two tools never offer the same target at once, so one element with the right key reads cleanly). The five placeholder sounds (`VC-start`, `VC-suck` a crossfading steady noise loop, `VC-done`, `VC-empty`, `VC-ready`) are in `data/sounds.json`; their IDs in `design/SOUNDS.md` replace the concept lines `VC-loop` and `VC-extract` (sound naming follows the data, not the design sketch, so the test that walks both keeps passing as the beds land). Watch helpers: `state()` reports the charge and each Foamer's `vacuumable` flag, and `vacuum()` presses `use` for one step. Tests in `tests/foamers/vacuum.test.ts`. | 3.1, 3.3 |
| 2026-11-05 | GAME-06: the melee key's order is fixed in `src/game/game.ts`: a staggered Foamer in the finisher's reach and view takes the press first (unchanged GAME-07 behaviour); with none finishable the press goes to `Melee` and is spent there (the bash is never nothing). The course page's old debug blast moved to its own binding (`debugBlast`, KeyB, `data/input.json`) on the course page only. A swing cannot start while the disc is raised or a shield charge runs (it reads the shield's public `state` and `charging` only, never its internals: GAME-04c owns that module); a swing with the disc thrown is fine. A charged swing blocks the blaster for its `swingTime` (`canFire` gains `!melee.swinging`). Charges: three, one back per parry (the shield's `parries` counter), one back per `rechargeSeconds` of fighting while below full, full at level start and retry. All numbers in `data/melee.json`; the hit reuses `parryDamage`, `startStagger` and `knockStep`, and carves voxel cover through the dart carve path with its own cap. | 3.2, 3.4 |
| 2026-11-05 | GAME-04c: the held and the flying disc are one `THREE.Group` (`discModel`), built once in the constructor and reparented between the camera's viewmodel group and a scene-level `flight` holder on the throw and the catch; `flight` carries the flight's position and the spin, and the old `discMesh` name is kept as a getter on `flight` so nothing that read it changed. The spin is about the disc's own axis (the face normal, along the flight), at `look.spinRevPerSec`, not edge over edge: the card says about its own axis and the bands and teeth are what the player should see turning. The look is data: `look.bands` (three concentric foam bands, each thinner and stepped forward by `domeDepth` so the face domes), `look.nubCount` rounded nubs on the rim, the factory palette in `look.colors`. The centre boss stays a plain placeholder with a `[Paul]` note. | 3.2 |
| 2026-11-05 | GAME-04c: the foam saw never kills (`saw.canKill` false), the same choice the throw already made: the tick keeps the throw's health floor (0.0001) and sets `finishWeakened` when the Foamer crosses the finishable band, so the saw's payoff is a finisher, not a kill (PLAN 3.2). Its plate share is 1.0 against a dart's 0.15, and it is measured on the part under the disc with `armourOf`, not on the dart's per-kind shares, because the saw's job is to be the Darter's counter: a flat tick, not the kind table's multipliers. The grind holds the Foamer in a stagger for the grind's length (via the existing `startStagger`), so it cannot attack out of the saw; a prone Foamer takes the grind without a stagger (it cannot attack anyway). The disc holds its point in the struck part's voxel frame, so it rides a Foamer that walks or is shoved; the grind ends on its time, on the Foamer going down, or on the part breaking away, and only the first Foamer struck in a flight is ground (the ricochet carries on as before, bounces and range unchanged). The debris is capped per tick by `saw.debrisPerTick`. | 3.2 |
| 2026-11-05 | GAME-04c: the saw's sounds are `SH-saw` (a loop, started on the lodge, followed to the disc each step, pitched by the remaining grind time and stopped when the grind ends or the disc comes home) and `SH-sawEnd`, both with placeholder synth recipes in `data/sounds.json` and rows in `design/SOUNDS.md`; the spin itself has no separate whirr (the card allowed it only if cheap, and the saw's loop already carries the spin's sound). `SH-saw`'s loop lives in the page, not `GameSounds`, because it is the shield's own state and `src/game/audio.ts` gains a `loop` pass-through with a no-op handle while the engine is still loading. | 4 |
| 2026-11-04 | GAME-10a: `data/foamers.json` keeps `test` as the shared base spec (the F01 unit tests read it directly, and one nested object shared by every spec keeps those tests honest: a `popTypes` push there applies to all types) and adds `types` with per-type overrides merged at spawn (`specFor` caches the merge; a type overrides `rig` and `attacks`, everything else is the base's). The F02's three ring distances (throw 12 m, preferred 8 m, retreat 5 m) are base fields so every spec has them; only a ranged type reads them. A ranged attack's reach is the type's preferred distance unless its override pins a `range`. | 4 |
| 2026-11-04 | GAME-10a: the F02 brain (`src/ai/f02-brain.ts`) is a sibling of the F01 one, not a subclass: same states, same `Brain` hooks, its own `decideF02`; `FoamerAgent` carries either by a `brain` tag on its setup. A thrower with a token stays in `approach` (the state machine starts attacks there) and gets a new `backOff` movement intent beside the circle ones. The circle stride keeps the agent's own `holdRange` (the bonker's hold ring, the thrower's preferred distance) instead of the one shared constant. | 4 |
| 2026-11-04 | GAME-10a: the foam ball is kinematic (raycast steps like a dart, no rigid body): cheap, capped (hard cap 8 live), and the parry (GAME-04 stage 2) will find balls by the one shared `BALL_MATERIAL` object. A throw does not call `onBonk`: the ball does the damage on arrival, once, and the disc's front-arc check is asked for the point the ball came from (position minus velocity direction), so the arc measures the ball's direction of travel as the card asks. Balls fly through Foamers and capsules (exact-group exclusion, as darts and the disc do). The throw sound event is the Foamer's own (`"throw"`, the windup is the windup-phase `"attack"` event picking `F02-windup` for a ranged attack); the system's own sound event is the burst. Ball look: pink glow is the shared material's emissive, approved provisional until Paul sees it (the glow colour is PLAN 3.2's "Proposed: glowing pink"). | 3.2, 3.3 |
| 2026-11-05 | GAME-10d: a pack Foamer gets its own token pool. `swarm` is a third `TokenKind` beside `melee` and `ranged`, with its own cap per difficulty (Story 2, Normal 3, Hard 4, Foam Fury 6) in `data/ai.json`, so a pack of Swarmers nibbling together cannot starve the F01s of melee tokens (the card's point) and a Slowmer still gets its turn in the same fight. `spawnPack(feet, facing?, count?)` places `pack` members on a ring round the point and skips anything past `pack.maxAlive` (12): the cap trims nothing, because removing the oldest would delete a Foamer the player was already fighting. | 3.4, 4.1 |
| 2026-11-05 | GAME-10d: the Swarmer is hit and run inside the existing state machine, not a new one. `src/ai/f03-brain.ts` is the F01 brain with a nibble clock: `sinceNibble` lives on `AgentInput`, the Foamer system restarts it to 0 on a landed nibble and adds `dt` every step, and the brain runs in (approach) only while `sinceNibble >= pack.nibbleGapSeconds` (1.2); the moment it has bitten it goes to hold, backs off when the player is inside `holdRangeMetres` (3.0) and circles the ring otherwise, then runs back in when the gap is over. The ring is the type's own `holdRangeMetres`, not the shared `BRAIN.holdRangeMetres` (2.2), so a Swarmer holds further out than a Slowmer; the numbers are in `data/foamers.json` and `data/ai.json` `pack`. | 3.4, 4.1 |
| 2026-11-05 | GAME-10d: the Swarmer's yip is a new Foamer sound event (`"alert"`), sent by the Foamer system only for a swarm member as it enters alert, so no other Foamer borrows it; the nibble is picked in `foamer-sounds.ts` from the attack's token (ranged winds up, swarm nibbles, anything else is the F01 swing) and the step sound from the rig id (F03 skitters with `F03-scurry`, the Darter keeps its charge loop, the rest thump). Placeholder IDs and synth recipes are in `data/sounds.json` and `design/SOUNDS.md` section 4.2. | 8.3 |
| 2026-11-04 | GAME-10b: the Darter's charge is a state machine extension, not a new movement system. `FoamerState` gains `telegraph`, `charge` and `wallStun`; the F05 brain (`src/ai/f05-brain.ts`) is a sibling of F01/F02 with those three extra states, and the Foamer system drives them (the brain stands in them): approach with the melee token and the player in `charge.rangeMetres` with sight starts the scrape, the run locks its line at the player's position when the telegraph ends, and the run moves through the Foamer's own `knockStep` so walls stop it (a wall ends it in the wall stun, the back open). `decideCharge` is a pure function so the test can ask it directly. The player stun is a number on the controller (`stunTime`), not a new state: the wish, dash and jump are zeroed, the look works, and the Foamer system reports the hit through `onChargeHit` so tests and the sandbox need no controller. The front-plate stop for the shield charge is a property of the Foamer (`charge.plateStopsShield`, arc `plateArcDeg`), read by the shield's charge step, which bounces the player back instead of staggering the Foamer. | 3.2, 4.1 |
| 2026-11-04 | GAME-10b: the F05 rig has no `head` part id (its body part's kind is `head`), so the no-head turn handicap applies to it and a Darter turns at half rate. Its chest and brow plates sit on the body's -z side while +z is forward, so armour is keyed by part id and the plate arc is measured from the Foamer's yaw forward, not from the part offsets: this needs Paul's eye on the rig before the arc can be called right. | 3.4 |
| 2026-11-04 | GAME-10b: arena levels are chosen by `src/arena/levels.ts` from `?level=` with the Pit as the default and an unknown name falling back to the Pit with a notice; files are imported, not fetched, because nothing is fetched and Vite bundles them anyway. The Ring's ceiling is at 9.5 m and its walls 9 m tall: the nav bake casts down from 8 m (`data/ai.json` `nav.topMetres`), so a ceiling at 8 m reads as ground and would make every cell unwalkable. | 7.5, 4.3 |
| 2026-11-05 | BUG-01 round 2, replacing round 1's bake decision: a cell may hold up to `nav.maxLayers` (2) walkable surfaces, lowest first, and the grid is a layered graph. "Lowest surface wins" (round 1) baked away the Pit's ring top, so a player standing on the ring drew Foamers under the slab, the original bug turned upside down. The round 1 candidate filter already tells a step from an overhang (a surface within a step above swallows the one below it; the ring is 3 m up, so the floor under it survives), so it is reused per candidate instead of keeping only the first. Lookups take an optional height and pick the nearest layer, so every existing caller that asks with no height still gets the lowest. A* nodes are `cell * maxLayers + layer`; a neighbour links to the layer within a step of the current one. `findPath` takes the agent's and the goal's feet heights, which the pages pass as the player's eye minus `player.eyeHeight`; a change of more than 0.5 m in the goal height re-paths. | 4.3, 7.5 |
| 2026-11-05 | BUG-01 round 2: the ramp-side stall was not the string pull. It was the step limit. Rapier's character controller autosteps a 0.2 m rise at a Foamer's walking cadence but refuses 0.25 m, whatever `maxHeight` says, because the autostep needs room ahead of the capsule and a 0.017 m frame move gives it none. The grid called any rise up to `maxStepMetres` (0.45 m) a step, and the Pit's south ramp rises 0.5 m per metre, so the rise between two neighbouring cells on its east side is 0.44 m: A* and the string pull both went that way, and the Foamer walked into a wall for ever. A climb is now capped by `nav.stepAutostepMetres` (0.2) for `stepOk`, `nodeNear` and `lineClear`, while a step's own footprint and a drop still use `maxStepMetres`. The bake is unchanged: a surface within a step above swallows the one below. Result: the path goes to the ramp's foot and the Foamer climbs it. `steer`'s waypoint skip also shrank from 0.5 m to 0.1 m, because at the foot it cut the dogleg and aimed the walk through the ramp's side again. | 4.3 |
| 2026-11-04 | BUG-01: a Foamer's walk ignores the other Foamers' root and part bodies. Every Foamer's movement capsule is deliberately a world-group member (`CAPSULE_GROUPS` includes `GROUP_WORLD`, so darts, aim and the shield all skip it), so no collision-group filter can exclude it, and the filter predicate may not read a collider's groups or shape either: Rapier refuses the nested borrow, the callback throws, and every collision stays in place. Handles can be read inside the predicate, so the system keeps two handle sets, its own and the others', and the walk checks both. The steering's separation keeps them apart, and knockback still stops at a Foamer. | 4.3 |
| 2026-11-04 | BUG-01: the stall guard lives in the steer step, not the brain, and its numbers are in `data/ai.json` `steer` (`stallWindowSeconds` 1.5, `stallDistanceMetres` 0.2, `sidestepSeconds` 0.5, `sidestepShare` 0.8). A `followPath` Foamer that covers less than the distance in the window sidesteps across the line to its goal, on a side chosen from its agent id so two in one corner do not undo each other, then walks at the path again. Only a walking Foamer: idle, alert, hold, circle and knockback are not nudged. The rule it enforces is the card's: a stuck Foamer never stands still for more than about two seconds. | 4.3 |
| 2026-11-04 | GAME-04 stage 2: the parry and bounce-back (`tasks/GAME-04b.md`; Qwen 3.8-27B via Pi). Numbers live in the `parry` block of `data/shield.json`, as every other shield act's do. The decision is in the pages, as every ball hit already is: in `projectiles.onHitPlayer` a ball the raised disc covers (`blocksAttackFrom`, asked for the point the ball came from, so the arc is the ball's direction of travel) is parried when it is a `BALL_MATERIAL` ball (PLAN 3.2: one colour always means parryable) and `Shield.canParry()`: the raise must be younger than the window (a private `raiseAge` since the state turned raised, reset when the disc drops); a raise older than the window only blocks, as before. A parry takes no player damage and calls `projectiles.bounce(b)`: the ball is not burst but is marked `bounced`, takes 1.6x its incoming horizontal speed and a steering time; while it steers each step re-aims at the thrower's chest as a solved arc (like `launch`'s loft) and within a step's width of it it stops steering and flies straight, so it cannot tunnel past the body. The bounced ball's rays are the ordinary ball's minus the capsules, and plus one more named exclusion, the player's own collider (those capsules' groups are the world's, so a group test cannot name them, and it is named by identity): every Foamer and part box can stop it (the thrower, and any other on the way), the world bursts it, and the player is never hit, so a bounced ball can hurt a Foamer but not the player. That hit goes through `FoamerSystem.parryDamage` (health, the damage record, a short `startStagger`, the finishable `finishWeakened` band; it never pops, a bounce is not a popping hit). The feedback: `SH-parry` (not positioned, the player's own act), `SH-parry-hit` (positioned at the hit), a bright flash disc over the viewmodel, the kick into the view (with the blaster's climb and the block's), and the tiny hit-stop: the shield's `slowed(dt)` hands back `dt * parry.slow` while it runs and the pages step the foamers, the projectiles, the darts and the pickups with it (the world steps slow). The presets scale the window as a multiplier (`DifficultyPreset.parryWindow`, read off the active preset as `director` is): Story 1.5, Normal 1, Hard 0.75, Foam Fury 0.6. Watch helpers in the pages: `state()` reports the parry count and `parryNext()` steps until the nearest not-yet-bounced ball is `parryLead` seconds away and then holds the disc up (the range page holds it up on the step it sees a ball, its loop is not callable). Tests: `tests/shield/parry.test.ts`. Reviewer needed; not pushed or merged. | 3.2, 10 |
| 2026-11-04 | ANIM-01: a per-rig `motions` block in the rig data (JSON, per rig, angles in degrees) is the home for state pose numbers: `poseNums` in `src/foamers/rig-states.ts` reads `motions.<state>` (the `throw` block is nested in `wind` and `strike` phases), and a missing block reads zero so a rig that never got one keeps its old poses. The throw's ball arc is verified against the rig's part pivots by `tools/pose-check.ts` and sketched by `tools/pose-ascii.ts`; `tools/render-rig.ts --state <state> --t <k> [--attack <id>]` renders key frames to `design/foamers/poses/`. A `turn` field on `RigMotion` carries the body's in-place yaw so the throw reads as the body swinging through. | 7.3, 7.5 |
| 2026-11-04 | GAME-05 shield charge (Qwen 3.8-27B via Pi). The charge's numbers (range 14 m, cone 24 degrees, 24 m/s, 0.7 s, 3 m knockback, 2 damage, 2 s cooldown, stop 1 m short of the chest) live in the `charge` block of `data/shield.json`, as the other shield acts do. The lock is the nearest non-down Foamer inside the range and half-cone of the view and in sight of the player's eye (the eye's own capsule is excluded, as the throw's rays exclude theirs); it refreshes while the disc is up and drops when it lowers. The dash press goes to the shield before the player controller, so a charge takes the press (the page consumes it) and a target-less dash stays the normal dash. The charge drives the player through the player's own character controller (walls stop it; it leaves the player at rest), and on contact knocks the Foamer back along the line through the Foamer's own movement controller (never through walls), starts a long stagger for the data's time, takes the data's small damage, and a charge never kills (floor at 0.0001 health, as the throw). Mid-charge the player's own step and the melee are suspended (the shared step's order holds both directions of the rule: no charge during a finisher, no finisher while charging); the disc stays raised and blocks as normal. The lock marker is a ring at the crosshair in the HUD, not in the world. | 3.2 |
| 2026-11-03 | GAME-07 Pop finishers and health drops (Qwen 3.8-27B via Pi). A hit that crosses below `finisher.weakenShare` (30%) of max health marks the Foamer `finishWeakened` and gives it one long stagger (`staggerLong`, 2.5 s) so the finisher has time; the mark is one-way for the life, and a part break always keeps its short stagger. Staggering while weakened, the Foamer shows a per-Foamer additive glow shell and wobble (the shared foam material cannot pulse per Foamer, so the glow is its own mesh on a world-space group, not under the Foamer's group). A melee on a weakened stagger in reach (2.5 m eye to chest) and in the view cone (cos 0.98) is a finisher: the player is held for 0.8 s, the view turns onto the Foamer, it squeezes and stretches in a new `finish` rig-motion, then pops and sprays health. The `Finisher` and a generic `PickupSystem` live in `src/game/` and `src/pickups/`, not the pages; health is the first pickup kind (all tuning in `data/pickups.json`, consumed blobs fill the player back to max but never past, stay on the floor at full health, capped at 24 and 30 s lifetime). The finisher spends the melee key (`consumePress`) when it lands so the course's debug blast does not also fire; a melee with no finishable target in reach keeps the page's existing behaviour. | 3.1 |
| 2026-11-03 | GAME-04 stage 1: the shield lives in `src/player/shield.ts` with every number in `data/shield.json`; pages own only wiring. A blocked bonk costs the data's `damageShare` and is not a hit (no HUD flash, `SH-block` instead of the hurt sound). The disc's own rays treat a Foamer's movement capsule as neither cover nor sight block (exact-match exclusion, as darts do): the disc leaves a struck body's capsule sitting inside it. The ricochet takes the nearest Foamer in sight each time, so it may strike one again with another between: the card's rule is never the same one twice in a row. A throw does not kill (a killed floor at 0.0001 health); the kill stays with darts and finishers. | 3.2 |
| 2026-11-03 | Darts pass a Foamer's movement capsule (it is not drawn; the parts take hits), and a shot aims from the muzzle at the first solid thing under the crosshair, not at a point 50 m out, so darts land where the crosshair is at any range (Claude, ENG-13 review follow-up). | 3.3 |
| 2026-11-03 | LVL-01 loads levels from `data/levels/*.json` through `src/level/`: a pure validator (no Three.js, so it runs in Node) refuses a level with errors and the page shows the list; the builder makes the shell (fixed colliders, ramps as rotated slabs) and one voxel volume for every piece with a bedrock row under each, so loose foam still breaks off the anchor (ENG-06 rule). A door may sit in a shell wall: the format has no doorway opening field, so validator rule 9 skips doors when testing overlap with the shell (rule 10 compares shell boxes only). `checkpointPos` was added to BLOCKOUT.md because an arena needs a restart point that is not its own lock trigger. |
| 2026-11-03 | LVL-01 arena zones: the voxel budget of an arena is counted over the bounding box of its trigger, doors and rifts grown by 4 m, not over the trigger box alone, because `README` pillar 3 puts cover behind the trigger and a strict trigger box would count none of the Pit's block. |
| 2026-11-03 | LVL-01 page: the arena owns its spawns (`FoamerSystem.spawnCount = 0` on `arena.html`, foamers spawn at rifts facing the player, `spawnState` alert) so the old spawner never disagrees with the wave count. A player who pops restarts at the arena checkpoint with the arena back to `waiting` and Foamers cleared; carved voxels stay carved, because rebuilding them was not in the card. |
| 2026-11-03 | LVL-01 page: `arena.html` gets its own renderer settings (fog 40 to 130 m, 40 m shadow radius, 2048 shadow map) through a `SceneOptions` argument on `createRenderer`; `index.html` passes nothing and renders exactly as before. Shared wiring moved to `src/game/` (`attack.ts` for the damage table, `shared.ts` for `carveBounds` and `FALL_LIMIT`), the smallest split that stops a copy of main.ts. The waves, rift delays and holds are in the level file, not in code. |
| 2026-11-03 | Levels are semi-open linear (Paul): one critical path from start to exit, never a maze, with each stretch opening into wide multi-level spaces, optional side areas, vertical routes, overlooks and secrets off the path, as in the modern Doom games. Arenas lock until cleared, then open the way on; the next goal is always visible; backtracking is short and optional. Concepts and a space kit with sizes taken from `data/player.json` are in `design/levels/`. | 9 |
| 2026-11-06 | LVL-02b: several arenas in one level is a `LevelRunner` in `src/level/level-runner.ts` that owns one `ArenaRunner` per arena and steps only the current one, so a later arena's trigger does nothing until every earlier arena cleared. Every arena's runner is built at construction, which puts every door in the file in its file state from the start: a player cannot run ahead through a later arena's open door. The page acts on the same `ArenaEvents` plus `onArenaStart` (banner, rift glow) and `onLevelCleared`; `ArenaRunner` itself is unchanged, so one arena levels play exactly as before. | 4.2, 9 |
| 2026-11-06 | LVL-02b restart rules: Try again restarts the current arena from its own `checkpointPos` with the earlier arenas still cleared (the card's checkpoint rule), and Play again or a fall out of the world resets every arena. The exit pad only ends the level once the last arena has cleared (the runner's phase is `complete`); in a one arena level the locked door in front of the pad already kept the player out, so the Pit and the Ring are unchanged. | 9 |
| 2026-11-06 | LVL-02b Level 1-2 beats 1 to 4: the parry corridor's lone Roamer spawns at a rift at the corridor's far end rather than being placed at load, because the blockout format has no placed Foamer field and the wave machine is the only thing that spawns. A one wave arena that locks on entering the corridor is otherwise the card's beat 2; a reviewer may prefer a `placed` field in the format. The level's rooms share one floor slab, one ceiling and one perimeter wall with the walls between them as pinches, because validator rule 10 forbids two shell boxes sharing volume; the store's window onto the ring is a foam piece over a gap in the north ring wall, not glazing (the format has no window field). The Ring is a half scale A2 (a 30 x 30 m arena would not fit a corridor level): a 26 x 30 m ring around a 12 x 10 m centre block. | 9 |
| 2026-11-06 | LVL-02c Level 1-2 beats 6 to 9: both new arenas are scaled down (the Crossroads is a 14 x 16 m hub with four 6 m spokes, not the design's 32 x 32 m with 8 m spokes; the bowl is 31 x 25 m inside the 33 m perimeter, not 36 x 30 m), because the whole level is one north bound corridor 31 m wide and a full size arena would not fit beside the Ring LVL-02b already built; the tiers stay at 0, 1.2 and 2.4 m as the design says. The tiers are walked up by shell ramps (1.2 m rise over 3 m, 22 degrees), not the design's 1.2 m steps: the nav grid only lets an agent step up `data/ai.json` `nav.stepAutostepMetres` (0.2 m), so 1.2 m steps are walkable for the player and not for a Foamer, and a bowl the Foamers cannot climb stalls (KIT 3, the ledge climb note). The Crossroads' way on is the spoke opposite the entry (the north spoke), not the design's "the way back is the south spoke": the runner would allow either, but the breather, the bowl and the exit are all north of the hub, and a south exit would send the player back down the whole connector; README pillar 2 stays unbroken. The level's exit pad moved out of the beat 4 store to the lit door on the bowl's far wall, so the store is a plain room now. The beat 5 tower bay, the U2 station, the S3 ledge and the dropping floor island are marked empty with `_note`s and foam-yellow floor markings. | 9 |
| 2026-11-06 | LVL-03a the level is one straight north line at a single floor height except the Pit: bay at 0, Pit floor at -4 with both ledges back at 0, then the Pit's north door leads on at the pit floor's height, so the breather and the Yard are at -4 (review: corrected from "at 0"). The Pit's ramps are the only climb. The Yard's east and west gates are `sealed` (they exist in the concept, the card's waves use the ends only) so a player cannot leave the arena mid fight. | 5 |
| 2026-11-06 | LVL-03a a wave's F03s already arrive one at a time at its rifts and every spawned Swarmer is backed by the pack's swarm token (data/foamers.json F03, "token": "swarm", pack 5), so nothing in `src/level/` needed a `spawnPack` change. The page's spawn event is `FoamerSystem.spawn(feet, facing, type)` at the rift facing the player, one per wave tick; `spawnPack`'s ring spread is for a group that arrives together and would have put a wave's members inside each other. The card's question is answered here instead of in code. | 3 |
| 2026-11-06 | LVL-03a review: a rift must stand on walkable ground. The Pit's north rifts sat on the floor under the north ramp's slab (a ramp is a tilted slab, not a solid wedge), so a Swarmer spawned in the pocket under it and stood in approach for good. `pit-rift-n1` moved to the ramp's head on the west ledge, `pit-rift-n2` to just past its foot; test 4d checks `canStandAt` for every rift in the level. | 5 |
| 2026-11-06 | LVL-03a the Pit's centre block is 3.2 m tall, not the concept's 3.5: a voxel zone may not exceed 3.2 m on any side (KIT 5), and the block is four 3.2 m zones. Its footprint stays 6 x 4 m. | 5 |
| 2026-11-06 | LVL-03a the Yard islands are 3.2 m square, not the concept's 4 to 6 m, for the same zone cap: six islands at one zone each fits the arena's six zone budget, and 3.2 m still splits the pack (the card's own test asks for reachability, not size). Each has a 2.5 m ramp up its inner face at 26.6 degrees, inside the nav grid's 40 degree slope, so a Foamer chases the player up and back down; the nav test walks both ways on all six. | 5 |
| 2026-11-06 | LVL-03a the U1 and S2 marks are 0.1 m shell slabs, not voxel pieces: both arenas are already at the KIT 6 zone cap, and a 10 cm slab is stepped over and reads as a floor mark. They are `foam-yellow` and `foam-lime-light` and carry the [Paul] note. The bay's three dummies are voxel pieces as the card asks (no dummy type exists). | 5 |
| 2026-11-06 | LVL-03a wave gaps: every wave keeps its Swarmers under 12 alive (six, eight, ten) and the two concept fights that build up (8 then 10) use waves, not one wave with a long hold, so the run clears between them and the cap is never at risk. `holdSeconds` is 1.5 to 2.5 s. | 4 |
| 2026-11-06 | LVL-02d Level 1-2 beat 5, the tower: it fills the bay as built, not the design's free-standing 20 x 20 m block, because the bay is the only space off the corridor's main line and the level is one 31 m wide north bound corridor (the same reason LVL-02c scaled the Crossroads and the bowl). The four floors stay 5 m apart as the design says, and the tower carries its own roof at 19 m with the level's ceilings left at 9.5 m and cut back to its walls, rather than floors closer together: 5 m of floor spacing is what gives the 5 m of clear headroom, and the tower's fights read by height (a Roamer above shooting down). The extra roof is three boxes (`tower-roof`, `ceil-spur`, `ceil-conn`), and no floor of the tower reaches `nav.topMetres` 17. | 5 |
| 2026-11-06 | LVL-02d the way up: three side-by-side ramps (5 m of rise over a 12 m run, 22.6 degrees) in their own 3 m bands, not the design's 1.5 m ledge chains. The nav grid's autostep is 0.2 m per 0.25 m cell, so 1.5 m ledges are walkable for the player (mantle 1.5 m, step 0.4 m) and strand a Foamer, and a tower whose Foamers cannot follow stalls the fight (the bowl's tiers took ramps for the same reason). Each upper slab is a ring with a 3 m hole over the ramp under it, so flights never stack and every floor keeps its headroom. | 5 |
| 2026-11-06 | LVL-02d the two fights are lock-free as the design asks: `tower-low` and `tower-high` have no doors at all, so the runner's `lock()` has nothing to shut and the player may retreat a floor mid fight. They are also on the route rather than a detour: the connector's north end is shut (`conn-n-end`) and the way on to the Crossroads is through the tower's ground floor, in at the connector doorway and out at the north neck. A detour would have let a player walk to the exit with arenas uncleared, and the exit pad would never open. | 4.2 |
| 2026-11-06 | LVL-02d the ceiling plug is 3.0 m square in plan, not the design's 3.2. It is a ceiling anchored piece with no bedrock row, so a dart's island search takes the whole slab and it falls as one: that only works while the slab is under `destruction.maxSearchVoxels` 6000, and 3.2 x 0.6 x 3.2 m at 0.1 m voxels is 6144. At 3.0 it is 5400 and drops (checked in a test). | 5 |
| 2026-11-04 | LVL-02a: placed ammo is a `PickupSystem` kind, not a system of its own: one `ammo` kind in `data/pickups.json` (0.35 m box, no hop, a slow turn and bob, collected within 1 m of the feet, 16 live, the oldest trimmed first) and `loadLevelBoxes` on it, so the page's level file (`pickups` with a `darts-*` type) is the only source of placed ammo and the validator's new check is that the type slice after `darts-` is in `data/darts.json.types`. A box refills `reserve` for every blaster in `PickupSystem.blasters` (set by the arena page to the loadout's blasters) that takes its dart type, capping each at `reserveMax`; the overage is not held and a box that would give nothing stays on the floor, like a health blob at full health. Box positions (the Pit's far-side box at `[-12, 0.4, 7]`, the Ring's at the two pillars) are first guesses to tune on the range; the Ring replaces its GAME-10b single centre box with one per pillar, as the card asks. | 3.3, 9 |
| 2026-10-29 | Project created. Name: DART. Browser 3D FPS, Nerf-inspired dart blasters, Foamers from the Foam dimension, no blood or gore, combat modelled on DOOM (2016) and DOOM: The Dark Ages. | 1 |
| 2026-10-29 | Paul writes weapons, story, Foamer designs and the logo; AI models assist and build. | 0 |
| 2026-10-29 | Hybrid movement: sprint, dash, mantle, no double jump. | 3.1 |
| 2026-10-29 | Audience 10+, public release, free forever. | 2 |
| 2026-10-29 | Browser play only, no server or accounts; local saves. | 7.6 |
| 2026-10-29 | Minimum spec: mid-range laptop with integrated graphics, 60 fps low/medium. | 7.1 |
| 2026-10-29 | Engine: Three.js + Rapier + custom voxel layer. | 7.2 |
| 2026-10-29 | Foamers use smoothed voxels. | 7.4 |
| 2026-10-29 | Music: pop-punk / metal lite. | 7.7 |
| 2026-10-29 | Coding agents only for now: assets generated by code. | 8.2, 11.1 |
| 2026-10-29 | Schedule: P0 2026-11-12, P1 vertical slice 2026-11-29. | 12 |
| 2026-10-29 | Hosting: dart.contrapaul.com, public repo; `reference/` kept out of git. | 7.6, 8.2 |
| 2026-10-29 | Shield is a foam disc buckler. | 3.2 |
| 2026-10-29 | Benchmark machine: base Apple Silicon Mac. | 7.1 |
| 2026-10-29 | Pi is the second coding agent (review and parallel work). | 11.1 |
| 2026-10-29 | Try Hunyuan3D locally for blaster meshes, gated by spike ART-00. | 11.1, 12 |
| 2026-10-29 | Blaster sound effects recorded from Paul's own blasters. | 8.3 |
| 2026-10-30 | PRE-09 done: public repo contrapaul/dart, live at dart.contrapaul.com, push to `main` deploys. Code licence MIT (confirmed). | 7.6 |
| 2026-10-30 | Pi runs Qwen 3.8-27b: given long tasks with detailed task cards. | 11.1 |
| 2026-10-30 | Placeholder blaster crater size approved (standard dart carveRadius 0.12 m). Larger carve radius comes per blaster, set in blaster data at GAME-09. | 12 |
| 2026-10-30 | Foam look v1 (ENG-07): voxel AO baked into vertex colours by the greedy mesher (faces merge only with equal AO), and a foam patch on MeshStandardMaterial (pores, tint, glow, rim). Pore noise is in local voxel units and wraps every chunk, so pore size follows voxel size. Tuning in `data/render.json`. | 7.4 |
| 2026-10-31 | Smoothing (ENG-09): surface nets with relaxation for Foamers only; walls and falling pieces stay greedy blocks. Foamer painted details must be about 3 voxels wide to survive smoothing. | 7.4 |
| 2026-10-31 | Everything that moves on the 60 Hz step is drawn interpolated between steps (fixes stutter on 120 Hz displays). A dart push changes a body's speed by at most 4 m/s. | 7.3 |
| 2026-10-31 | Foamers have damage zones: parts (head, arms, legs, ability parts) with their own health that break off and handicap the Foamer (Paul). | 4.1 |
| 2026-10-31 | Frames are timed from the rAF timestamp and snapped to the display refresh (Firefox's rounded timer caused a hitch about once a second). | 7.3 |
| 2026-10-31 | Foamers can look menacing (angry eyes, toothless grins, visible toy weapons) and take "foamy gore": wounds show a foam core colour, parts break off, most go down and dissolve, only a catastrophic hit pops them (Paul). Section 2 rewritten to match; rating target under review (CONTENT-PLAN D13). | 2 |
| 2026-10-31 | Reference photos in `design/referenceimages/` are gitignored like `reference/`: they carry other companies' logos. | 2 |
| 2026-10-31 | Foamer movement styles blend over 0.15 s so no joint snaps between phases; a test enforces it. | 7.3 |
| 2026-10-31 | Foamers are blocky voxels, not smoothed (Paul, after comparing both in the sandbox). Surface nets (ENG-09) removed; replaces the 2026-10-29 and ENG-09 smoothing decisions. Painted details no longer need to be 3 voxels wide. | 7.4 |
| 2026-10-31 | The game's test Foamer is rig F01: a root body carries only the movement capsule (radius half the wider of the body part's x and z size, height the rig's, on the body centre line), and each rig part is its own voxel volume and kinematic body posed from `solvePose` (ENG-10 stage 1). A dart that hits the capsule counts whole-Foamer damage until stage 2. | 7.3 |
| 2026-11-01 | A downed Foamer sinks at `down.sinkSpeed` (0.35 m/s) only until its top is under the floor, not a further rig height, so it is gone in about 2 s after lying (ENG-10 review). | 4.1 |
| 2026-11-01 | The player asks for no downward move while grounded; snap-to-ground holds it to the floor. Pressing into the floor made Rapier stall the whole move now and then (Paul's movement hitch). | 7.3 |
| 2026-11-01 | Only dart types listed in `catastrophic.popTypes` can pop a Foamer; none of the starter types are listed (Paul: the starter blaster should not pop). | 4.1 |
| 2026-11-01 | A killed Foamer becomes a ragdoll: hinges with limits at the rig joints, parts collide with the level only, and the killing shot tips it over about its feet (each part gains `killSpeed` scaled by its height) so it falls away from the shot without being thrown (ENG-12). | 4.1, 7.3 |
| 2026-11-01 | Blasters are modelled by Blender Python scripts written by Kimi K3.1 Pro through Pi, from a written brief (not the photo), to a `.glb` contract with named moving parts (Paul added Kimi and Blender). Replaces the image model and Hunyuan3D route, pending spike ART-00. | 5.2, 8.2, 11.1 |
| 2026-11-01 | ART-00 passed: the Blender script route is adopted for every blaster. B01 took 5 rounds, about 50 minutes of Kimi time and $2.34. Every build also renders a close-up of fiddly parts (the trigger), and grip texture is a small normal map, not modelled ribs (Paul). | 5.2, 8.2 |
| 2026-11-01 | D1: 3 acts x 4 levels, about 4 hours; new blasters in the first 7 levels, the last 5 are about challenge and story (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D2: a boss per act plus mid-act mini-bosses; colour variants promote enemies (D5) (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D3: 12 Foamer types plus 3 bosses (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D4: 8 blasters, one per level in order: level 1 B01, level 2 B04 (Shredder), level 3 B03 (Leviathan), and so on (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D5: size and shape show class, not colour; all Foamers read as one species; colour variants mark boosted versions for bosses and late challenges (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D6: two upgrade layers, blaster mods and player upgrades from hidden tokens (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D7: upgrades are bought at stations inside levels (not a between-level screen) (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D8: no ammo from floor darts; ammo is placed at set points (a new blaster's first find, before a gauntlet) (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D9: a foam vacuum: weakened Foamers are stunned, E locks on and extracts darts (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D10: four difficulty presets plus sliders (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D11: losing a leg makes a Foamer fall over, then crawl (GAME-11) (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D12: catastrophic deaths vary by weapon (for example a close B03 blast blows a huge chunk out and finishes it in a foam burst), not only whole-body pops (GAME-09b); no starter dart pops (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D13: unrated, aiming between E10+ and T (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D14: five ammo types: standard, precision, mega, foam ball, launcher round (B07) (Paul). | CONTENT-PLAN 1A |
| 2026-11-01 | D15: B03 is a break-action double barrel (Paul). | CONTENT-PLAN 1A |
| 2026-11-02 | B04's flywheels are internal: the housing is closed, no window; the brief asked for one in error (Paul). | 5.2, B04 brief |
| 2026-11-03 | ENG-08: grid navigation, not recast-navigation. 7.2 proposed a recast navmesh, but the level is destructible and a navmesh would need re-baking around every carve, which is exactly what 4.3 buys us. A walkable grid baked from the Rapier world (0.25 m cells, ray for ground plus a standing-space shape cast per cell) has no extra dependency, re-bakes a small rectangle in well under a millisecond, and paths with A* plus string pulling. Flyers steer without the grid. | 4.3, 7.2 |
| 2026-11-02 | Foamer names and looks (Paul, CONTENT-PLAN 3). Foamer colours: purple, orange and lime are the primaries, each Foamer wears all three with the primary varying, shades on one ladder so they look like one factory; accents ink, cream and the core colour; pink, blue and yellow stay off Foamers (parry and darts). Claude assigned the per-Foamer colours (Paul). | CONTENT-PLAN 3.4 |
| 2026-11-03 | ART-03 uses the real voxel rigs and rest poses for deterministic turnaround PNGs, with no new dependencies. Slowmer keeps its original combat volumes after larger limbs and body nubs broke gameplay tests; shaggy nubs live on its head. Darter uses a paint-only gape scale so armour does not hide its mouth. | 3.4, ART-03 |
| 2026-11-03 | ART-03 round 2 keeps Slowmer's body shag as light surface paint because body geometry and mixed-material paint changed deterministic hit behaviour. Darter armour is two curved ellipsoid plates intersecting the body. Turnaround faces use uniform shading and slight raster overlap for solid surfaces. | 3.4, ART-03 |
| 2026-11-03 | GAME-11 stage 2: the crawl pulls itself at the player at `rig.speed * crawlSpeed` (0.3) and turns at half its turn rate; a prone Foamer attacks from the ground with whatever its arms allow (no arms: headbutt) and its reach is measured from the prone head's box centre (`Foamer.headPos`), not its feet; `crawlMotion(rig, gait, out)` in `rig-states.ts` adds to the prone pose `proneMotion` already set (so the tilt split with the fall's own `sideShare` is shared and no part turns over at the transition), and its body rock goes in pitch because `poseParts` fits the prone body to the floor and would undo a `y` bob. A prone Foamer cannot stagger. `Foamer.prone` is set at the fall and outlives the `crawl` state, so the attack states stay posed prone. | 4.1, 7.3 |
| 2026-11-06 | GAME-09b: a shot's darts carry one id per trigger pull (B03's two barrels are one shot) plus the muzzle, and the rule measures the muzzle's distance to the shot's mean hit point, not the player's; "already finishable" is judged when the shot's first dart lands, so a volley cannot weaken a Fodder into a chunk it was not weak enough for. The chunk carves the larger of the Foamer base's and the blaster's `carveRadius`, goes down with `chunk.push` scaling the ragdoll's kill push, and never pops. | 2, GAME-09b card |
| 2026-11-02 | GAME-11 stage 1: a leg break below `handicaps.fallBelowLegs` (2) tips the Foamer over as an inverted pendulum about the standing foot (bounce once, settle, then a prone crawl that holds still until stage 2), instead of a stagger plus a 0.15 rad per missing leg roll; a lost left leg rolls it left. A live Foamer's part colliders moved to `FOAMER_GROUPS` so a fresh debris piece passes through the body it left (it spawned inside it and the falling hips crushed it into the floor). | 4.1, 7.3 |
