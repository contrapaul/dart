# DART level editor: plan

Status: **draft, 2026-11-13**. Nothing built yet. Paul answered the four
main questions in section 10 the same day; the smaller ones (5 to 10)
stand as written unless he changes them.

Paul (2026-11-13), after playing Act 1: "I really need to build these
levels myself." He wants a proper level builder, shipped with the game so
players can make their own levels.

## 1. What it is

- A new page, `editor.html`, in the same Vite build as the game. It is
  served from dart.contrapaul.com like the other pages, and nothing is
  fetched from another host.
- It edits the **same level file** the game plays (`src/level/format.ts`),
  grown with new optional parts (section 3). Old levels keep loading, so the
  Pit and Act 1 open in the editor as they are.
- The editor draws the level with the game's own builder
  (`src/level/build.ts`), so what you see is what you play.
- A **Play** button drops you into the level from the player start, or from
  where the camera is. Esc brings you back to the editor where you were.
- Desktop only: mouse and keyboard, like the game (PLAN.md 7.1).

## 2. What you can place

| Thing | What it does | Exists in the game today? |
|---|---|---|
| **Primitive** | A box, ramp, wedge, cylinder or stairs (Paul, Q4). Move, rotate, scale, colour. Each one is set to **solid**, **breakable**, **hazard** or **decor**. | Boxes and ramps only (the `shell`) |
| Solid | Walls, floors, platforms. The player and Foamers collide with it. | Yes |
| Breakable | A box is voxel foam that darts carve and blasts break. Any other shape, or a freely rotated box, takes a set number of hits and then shatters into foam chunks (Paul, Q3: both). | Voxel boxes yes, as `pieces`, typed by hand; hit points no |
| Hazard | See-through, so you can walk into it. Hurts by a damage per second you set, with an optional slow (wading). One cube scaled up makes a toxic lake, lava or molten metal. Look presets with their colours and glow are in `data/hazards.json`. | No |
| Decor | Drawn, no collision (signs, trims, light strips). | No |
| **Player start** and **exit** | One each. | Yes |
| **Foamers** | Placed by hand, facing a way. They wake when they see you, or when a trigger wakes them. | Only through arena waves |
| **Spawn points** | Where scripted waves come in (the rifts). | Yes |
| **Pickups** | Blasters, hand weapons, every ammo type, health, armour, tokens, **keys**. | All but keys |
| **Doors** | Slide open. Each is open, locked until a trigger opens it, or locked to a key colour. | Arena doors only |
| **Zones** | Invisible boxes that a trigger listens to ("the player entered"). | Arena triggers only |
| **Existing kit** | Buttons, presses, barrels, mod stations. | Yes |
| **Sky** | A colour gradient (top, horizon, bottom), or an uploaded image. | No |
| **Level settings** | Name, what the player starts with (blasters, hand weapon, health) for a level played on its own. | No |

## 3. Simple spawn scripting

Scripting is **when this happens, do that**, set in the inspector, never
code. Every trigger fires once unless it is set to repeat.

**When** (one per trigger):

- the level starts
- the player enters a zone
- N of a linked set of Foamers are killed (or all of them)
- a button is pressed
- a pickup is taken (a key, say)
- another trigger fired, after a delay in seconds

**Do** (a list, in order):

- spawn Foamers: a wave at spawn points, or wake placed Foamers
- show or hide primitives (this is how a blocker works)
- open, close or lock a door
- show a message on the HUD
- set the checkpoint
- (later) change the music intensity

**Blockers** are ordinary primitives that start hidden. The usual arena
is then three triggers:

1. The player enters zone A: show blocker walls, spawn wave 1.
2. Wave 1 is all killed: spawn wave 2.
3. 12 of the linked Foamers are killed: hide the blockers.

An **Arena** button in the editor builds that set in one go: drag out the
zone, click the walls that become blockers, pick the waves. The editor
links things by clicking: select a trigger, press Link, click the
Foamers or walls.

Today's `arenas` block in the level file keeps loading. Later the runtime
can treat an arena as these triggers, so there is one system, not two.

**Keys and doors**: a key pickup has a colour (red, blue, yellow). A door
locked to that colour opens when the player walks up to it holding the
key, and the HUD shows the keys held. Keys are lost at the level exit.

## 4. The editor screen

- **Centre**: the 3D view with a floor grid.
- **Left**: the outliner, a list of everything in the level grouped as
  Geometry, Hazards, Foamers, Pickups, Logic. Click to select, eye to hide
  while editing, lock to stop clicks.
- **Right**: the inspector for what is selected: position, size,
  rotation, colour, behaviour (solid, breakable, hazard, decor), the
  hazard's damage, a trigger's when and do.
- **Bottom**: the palette of things to place.
- **Top**: New, Open, Save, Export, Import, Undo, Redo, Play, the problems
  count.

Controls, copied from editors people already know (Hammer, Unity,
Roblox Studio), so nothing is invented:

| Key | Does |
|---|---|
| Hold right mouse + WASD, Q/E | Fly the camera |
| F | Frame the selection |
| Click, Shift+click | Select, add to the selection |
| W, E, R | Move, rotate, scale handles (three.js `TransformControls`, bundled) |
| G | Grid snap on or off (default 0.5 m, 15 degrees) |
| Ctrl+D, Delete | Duplicate, delete |
| Ctrl+Z, Ctrl+Y | Undo, redo (every change goes through one command list) |
| P | Play from the start; Shift+P plays from the camera |

Placing: pick a thing in the palette, click in the world, and it lands on
the surface under the cursor, snapped to the grid.

Colour: a colour picker, with the game's foam palette as swatches and the
last colours used.

A **Problems** panel runs the game's own validator
(`src/level/validate.ts`) on every change: no player start, a trigger
linked to nothing, a door no key opens, a level over a limit. Click a
problem to select the thing.

## 5. Saving and sharing

- Every change autosaves to the browser (IndexedDB). A **My levels** list
  opens them again.
- **Export** writes one file (`name.dart.json`) with everything in it,
  an uploaded sky image included. **Import** opens one. That is how Paul
  moves a level into the repo, and how a player sends a level to a friend.
- The title menu gains **Make a level** (the editor) and **Play a level**
  (My levels, or import a file).
- A custom level is played on its own, with what its settings say the
  player starts with. It is not part of the campaign save.
- Paul's own levels go into `data/levels/` through export, and the
  campaign plays them as today.

Uploaded images stay inside the level file and the player's browser. They
are scaled down on upload (start: 2048 by 1024, JPEG) so a file stays
small.

## 6. Limits (hard caps, in `data/editor.json`)

Anything that spawns objects has a hard cap, and the editor shows how
near a level is to each one.

| Limit | Start value | Why |
|---|---|---|
| Primitives | 2000 | Draw calls and colliders |
| Breakable volume | the voxel budget the Act 1 levels fit in | Voxel memory and meshing |
| Placed Foamers | 150 | Total in a level |
| Foamers up at once | 40 | Frame rate (PLAN.md 7.1) |
| Triggers | 200 | Easy to read |
| Level size | 512 m a side (1-4 is already 304 m long) | Nav grid and float precision |
| Sky image | 2048 by 1024 | File size |

At play time solid and decor primitives that share a colour are merged
into one mesh each, so a big level is not thousands of draw calls. The
editor keeps them apart so each one can be clicked.

## 7. Limits of the engine that the editor must respect

- **Breakable** primitives become voxel pieces: boxes only, no rotation
  except in 90 degree steps, cut into blocks of at most 3.2 m. The editor
  does the cutting. Other shapes, or a rotated box, can be solid, hazard
  or decor, or breakable by hit points (Q3).
- **Foamer paths** come from a grid baked from the physics world
  (`src/ai/nav-grid.ts`). It already handles floors over floors (the
  Pit's ring), up to `nav.maxLayers` layers. A bridge over a lake is fine;
  a steep cylinder or a narrow wedge may not be walkable. Foamers walk
  round hazards; one knocked into one takes its damage.
- A hazard has no floor of its own. A lake is a hazard box sitting on a
  solid floor, and the player wades through it.

## 8. Build order (task cards)

Each card is a Pi run in its own worktree, reviewed and played before it
merges, like the cards so far. The first card is the contract; after it,
the cards on the same line run in parallel.

| Card | What | After |
|---|---|---|
| ED-00 | The level format grows: primitives with behaviour, hazards, decor, Foamers placed, zones, triggers, keys and locked doors, sky, start loadout. Types, the validator, tests. No drawing. | none |
| ED-01 | The game plays the new parts that need no logic: primitives (solid, decor), the sky, placed Foamers, the start loadout. `arena.html?level=` loads a file from My levels. | ED-00 |
| ED-02 | The editor page: fly camera, grid, place, select, move, rotate, scale, colour boxes; undo and redo; autosave, export, import. | ED-00 |
| ED-03 | Hazards in the game (damage, slow, the look, Foamers avoid them). | ED-01 |
| ED-04 | Every shape, the outliner, the inspector, multi-select, duplicate. | ED-02 |
| ED-05 | Placing Foamers, spawn points, pickups, keys, doors, start, exit, with the game's own models. | ED-04 |
| ED-06 | Breakable primitives in the game and the editor: boxes cut into voxel pieces, other shapes by hit points. | ED-01, ED-04 |
| ED-07 | Triggers and actions in the game; blockers, keys and doors. | ED-03 |
| ED-08 | Triggers in the editor: the inspector, Link, the Arena button, the Problems panel. | ED-05, ED-07 |
| ED-09 | Play inside the editor (P and Shift+P, Esc back). | ED-05 |
| ED-10 | Players: title menu entries, My levels, play a custom level, a help page in the editor. | ED-08, ED-09 |

ED-00 is small and is the contract every other card reads, so I write and
review it closely. Paul can start building simple levels after ED-02,
ED-04 and ED-09, before the scripting lands.

## 9. Not in this plan

- Moving floors and lifts (Q18 paused them).
- Custom Foamer, blaster or texture making.
- Online sharing (Paul, Q1: files only).
- Phone and tablet editing (PLAN.md 7.1).

## 10. Questions for Paul

Asked in chat on 2026-11-13. Paul's answers are in bold.

1. **Sharing.** Level files that players export and import (no server,
   as decided in Q3), or an online gallery later? A gallery needs a
   server, accounts or codes, and moderation, because players are 10+
   and can upload images.
   **Files only.**
2. **Scripting style.** When/do lists in the inspector (section 3), a
   node graph with wires, or a small text script?
   **When/do lists.**
3. **Breakable.** Real voxel foam (carves, boxes only, section 7), a
   simpler "takes N hits, then shatters" that works on any shape, or both?
   **Both.**
4. **Shapes.** Which primitives besides the box and ramp: wedge,
   cylinder, stairs, sphere, arch?
   **Wedge, cylinder and stairs.** No sphere or arch.

Smaller ones, with what I would do unless Paul says otherwise:

5. Full rotation on every axis for solid, hazard and decor. Breakable
   only in 90 degree steps.
6. Hazards hurt Foamers too (set per hazard, on by default).
7. A sky image is a panorama (2:1) wrapped around the level. Any other
   shape is stretched to fit.
8. Free colour for everything, with the foam palette as the first
   swatches. PLAN.md section 2 rules out blood and fluids coming from
   Foamers; I read a lava or toxic lake as fine, since it is the level, not
   a wound.
9. The Act 1 levels open in the editor so Paul can rework them, or he
   starts from empty: his choice per level, nothing is deleted.
10. The editor goes live on the site only once ED-10 is done. Until then
   it is reachable only by its URL, as the test pages are.
