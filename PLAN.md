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

**Rating target:** equivalent to ESRB E10+ / PEGI 7. Cartoon action, no blood, no gore, no realistic weapons, no frightening imagery.

**Hard rules for every model working on this project:**

- No blood, gore, dismemberment, bones, organs or corpses. Foamers burst into foam chunks, confetti, bubbles or goo-free foam crumbs, which then fade or bounce away.
- Foamers are not scary. Big eyes, rounded shapes, bright colours, goofy sounds. Menace comes from their behaviour (speed, numbers, attacks), never from their looks.
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
- Weak points (for example an antenna, a backpack, a glowing core) can be shot off to change behaviour, like DOOM's destructible Mancubus cannons and Revenant jetpacks.
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

**[Paul]** will detail every blaster. Reference images go in `reference/blasters/` (one folder per blaster), and each blaster gets a card in `design/blasters/<id>.md` using this template:

```
ID:            B01
Name:          [Paul]
Reference:     reference/blasters/B01/ (list images)
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

| ID | Name | Role | Ammo | Reference images | Status |
|---|---|---|---|---|---|
| B01 | [Paul] | Starter | | | Not started |
| B02 | | | | | |
| B03 | | | | | |
| B04 | | | | | |
| B05 | | | | | |
| B06 | | | | | |
| B07 | | | | | |
| B08 | | | | | |

### 5.2 From reference image to in-game blaster (pipeline)

1. Paul collects photos/renders in `reference/blasters/Bxx/`.
2. A vision-capable model writes a **design brief**: silhouette, key parts (priming handle, flywheel cage, magazine, tactical rail), proportions, colour breakdown, and what to change so it is original (section 2 IP rule).
3. An image model makes **concept art**: side view, three-quarter view, first-person view.
4. Paul approves or redirects.
5. A 3D generation model produces a **base mesh** from the approved concept art (section 8.2).
6. Cleanup: decimate, fix normals, separate moving parts (slide, priming handle, trigger, magazine, flywheel cage) so they can animate, set the origin and a muzzle socket. Export glTF (`.glb`).
7. Code-generated first-person animations (recoil, priming, reload) using the separated parts. Procedural animation is cheaper than hand animation and easier for models to tune.

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
- **Smoothed voxels for Foamers (decided, Q6):** Foamer voxel data is meshed with surface nets (or marching cubes) in the worker, so they look soft and rounded. Damage still removes voxels, and the carved hole re-smooths. Destructible props may stay greedy-meshed blocks if smoothing costs too much; decide in P0.
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
| Blasters (first person, high detail) | Reference images, then concept art (image model), then image-to-3D model, then cleanup and part separation | `.glb`, separated moving parts |
| Foamers | Concept art (image model), then either: (a) voxel models authored by code (an LLM writes a generator script per Foamer) or (b) image-to-3D mesh, voxelized by our tool | `.vox` or our own voxel JSON/binary |
| Destructible props (crates, cover, furniture) | Voxels generated by code, or meshes voxelized | voxel volumes |
| Level shell | Modular kit pieces (meshes) generated by image-to-3D or by code, assembled in a level tool | `.glb` + level JSON |
| Textures | Procedural shaders where possible; image model for decals/signage | `.ktx2` / `.webp` |
| Pickups, UI icons | Image model or code (SVG) | `.webp` / `.svg` |

Notes:

- **Code-generated voxel models** suit this project unusually well: a Foamer is simple rounded shapes, and an LLM can write and iterate a script ("make the eyes bigger, add a second antenna") faster than any 3D tool. Recommend trying this first for Foamers (task ART-03).
- Every generated asset gets a row in `assets/MANIFEST.md`: source tool/model, prompt, date, licence terms of the tool. DART is free forever (Q8), but the repo is public, so each tool's terms must still allow public release and redistribution of its output.
- **Tool access (Q9, 2026-10-29):** Paul currently has coding agents only, no image, 3D or audio generation tools. Until that changes, the default is **assets generated by code**: voxel Foamers and props from generator scripts, blasters built from code-generated primitives (rounded boxes, cylinders, lathe and extrude shapes), procedural textures in shaders, and procedural sound effects synthesized with Web Audio. Image-to-3D and AI audio are added later if Paul picks tools (see 11.1).
- **Reference images stay out of the public repo.** Product photos of real blasters are other people's copyright, so `reference/` is listed in `.gitignore` and kept locally. Design briefs written from them (text) are committed.
- Asset size budgets: blaster under 1.5 MB, Foamer under 300 KB, prop under 100 KB (compressed). Use meshopt/Draco compression and KTX2 textures.

### 8.3 Audio assets

| Asset | Method (Proposed) |
|---|---|
| Sound effects | Blasters: recordings of Paul's own foam blasters (pump, flywheel, spring), one session per blaster: prime, fire, dry fire, reload, mag in/out, flywheel rev. Raw files stay local; edited, layered `.ogg`/`.m4a` files are committed. Everything else: procedural Web Audio |
| Music | [Paul: AI music generation, commissioned, or licensed] |
| Voice | [Paul: AI voice, own recordings, students?] |

---

## 9. Level design

- **Structure (Proposed):** DOOM-style levels: exploration corridors with secrets, connecting combat arenas that lock until cleared, a key or switch puzzle, an exit. 15 to 25 minutes each.
- **Destruction in level design:** cover that wears down, walls that can be blasted through to secrets, Foam growths that block paths until destroyed.
- **Building levels (Proposed):** start with code-authored blockout levels (JSON of boxes, arenas, spawn points) so models can build and edit levels as text. Later, a simple in-browser level editor if needed (post P2).
- **Level list:** [Paul], see section 6.1.

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
| Concept art | None yet (Q9). Fallback: code-drawn SVG/canvas turnarounds from the design brief | Blaster and Foamer concepts |
| Image to 3D | **Hunyuan3D, run locally (Q15).** Open weights, no outside service. Must first be proven to run on Paul's Mac (task ART-00); fallback is blasters modelled in code | Blaster and prop meshes |
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
| PRE-05 | Name and describe Foamers (section 4.2) | P | |
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
| ENG-06 | Island detection and break-off rigid bodies | A | ENG-05 |
| ENG-07 | Foam shader v1 | F | ENG-04 |
| ENG-09 | Smoothed meshing (surface nets) for Foamer volumes, same worker pool (PLAN 7.4) | A | ENG-04 |
| GAME-01 | Projectile system: visible darts, arc, sticking, pooling (card: `tasks/GAME-01.md`) | Pi | ENG-02 |
| GAME-02 | One placeholder blaster (pump action) end to end (card: `tasks/GAME-02.md`) | Pi | GAME-01 |
| GAME-03 | One voxel test Foamer that walks at you and pops into chunks | F | ENG-05 |
| QA-01 | Performance test on Paul's low-end target machine; record numbers in HANDOFF.md | P + A | all above |
| **Gate** | Go / no-go on the voxel approach (fall back to pre-fractured meshes if it fails) | P | QA-01 |

### Phase 2 (P1): Vertical slice, due 2026-11-29. Goal: "One arena that feels like DOOM with foam."

| ID | Task | Owner | Depends on |
|---|---|---|---|
| GAME-04 | Shield: block, parry (bounce-back), throw | A / F | P0 gate |
| GAME-05 | Shield charge | F | GAME-04 |
| GAME-06 | Melee weapon + charges | F | GAME-04 |
| GAME-07 | Stagger + Pop finishers + health drops | F | GAME-03 |
| GAME-08 | Ammo-for-kills tool | F | GAME-07 |
| GAME-09 | Weapon framework from JSON data, 3 blasters from Paul's cards | F (B for data) | PRE-04 |
| ENG-08 | AI director (attack tokens), state machine base, navmesh | A | GAME-03 |
| GAME-10 | 3 Foamer types (fodder ranged, charger, heavy) | F | ENG-08, PRE-05 |
| ART-00 | Spike: install Hunyuan3D locally on the Mac, generate one test blaster from an image, record time per model and quality. Go / no-go for the 3D route | A + P | |
| ART-01 | Reference to design brief for 3 blasters | Vision model | PRE-03 |
| ART-02 | Concept turnarounds for 3 blasters (code-drawn until an image tool is chosen), Paul approves | F + P | ART-01 |
| ART-03 | Code-generated smoothed voxel Foamers (3 types), Paul approves | F | PRE-05 |
| ART-04 | 3 blasters with separate moving parts, exported to `.glb`: Hunyuan3D base mesh plus cleanup if ART-00 passed, otherwise modelled in code | A/F | ART-00, ART-02 |
| ART-05 | Procedural first person animations | F | ART-04 |
| LVL-01 | One arena blockout with destructible cover and a lock-in | F + P | ENG-06 |
| AUD-00 | Record Paul's blasters (session list in 8.3) | P | |
| AUD-01 | Core sfx set: blaster sounds edited from AUD-00 recordings; pops, parry and shield procedural | F + P | AUD-00 |
| UI-01 | HUD v1, pause, settings with difficulty sliders | F | |
| QA-02 | Playtest with players aged 10+ [Paul: who?], collect notes | P | all above |

### Phase 3 (P2): Content

| ID | Task | Owner |
|---|---|---|
| GAME-11 | Remaining blasters, mods and upgrades | F + B |
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
| OPS-02 | Asset loading/streaming and caching | A |
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
| Q6 | Foamer look: blocky voxels, or smoothed voxels that look more like foam? | Smoothed voxels |
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
| Q15 | Do you want to try an image or 3D tool later (for example Hunyuan3D run locally), or stay all-code for assets? | Try Hunyuan3D locally (spike ART-00) |
| Q16 | Do you own any real foam blasters we could record for sound effects? | Yes, several |

---

## 14. Decisions log

| Date | Decision | Section |
|---|---|---|
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
