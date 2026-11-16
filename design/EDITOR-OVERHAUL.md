# DART level editor: review and overhaul plan

Status: **Paul chose Plan S only, 2026-11-16** (PLAN.md section 14).
Cards ED-11 to ED-14 are written in `tasks/`; none is built. Plans M and
L and the extras in section 5 are not going ahead; they stay here as a
record. Paul has not yet answered questions 2, 3 and 5 in section 7, so
the cards use what this file recommends and say so.
The plan that was built is `design/EDITOR.md` (cards ED-00 to ED-10a).
This file is the next round: a review of where the editor stands, then
three sizes of plan to pick from. Questions for Paul are in section 7.

Paul's brief: the editor must be **easy and fun to use, visual over
text, and have a quick playtest**.

## 1. How the review was done

- Read `design/EDITOR.md`, the editor entries in `HANDOFF.md`, and the
  code in `src/editor/` (about 4,600 lines of TypeScript) and `src/arena/main.ts`.
- `npm test`: 1408 pass, 2 skipped.
- Opened `editor.html` on the dev server: a new level, then built-in 1-2
  as a copy, selected a trigger, pressed Play.
- Not done: no building session with a real mouse. Feel (camera, handles,
  dragging) is judged from the code and the 2026-11-14 handoff notes, not
  from use.

## 2. Where it stands

### 2.1 Sound, keep it

- **The level file and its validator** (`src/level/format.ts`,
  `validate.ts`). One format for the game and the editor. Old levels load.
- **The document** (`src/editor/doc.ts`): every change is one undo step,
  autosave to the browser, export and import of one file.
- **What you see is what you play**: the view draws with the game's own
  geometry code.
- **Placing** since 2026-11-14: ghost preview, drag out a footprint, drag a
  thing along surfaces, a camera without pointer lock.
- **Scripting model**: when/do triggers, and one runtime for arenas and
  triggers. Paul chose when/do lists (EDITOR.md Q2). This plan keeps that
  and changes how the lists look, not what they are.
- Hard caps, the Problems list, 11 test files for the editor.

The trouble is the surface, not the foundations. That decides section 4.

### 2.2 Playtest is not quick

Seen in the browser:

1. Play saves, then **leaves the page** for `arena.html`.
2. The game page loads and shows the **title card**. A click starts it.
3. Coming back is Esc, then "Back to the editor" in the pause panel.
4. That **reloads the editor**. The undo list, the camera spot and the
   selection are gone. The camera does not return to where you were
   building.

So one test costs two page loads, two or three clicks, and your place.
People stop testing small changes when it costs that much.

### 2.3 It is text first

Seen in the browser:

- **Outliner**: a long list of ids (`ring-ammo-sw darts-standard`,
  `tower-r2-a`, `prim-12`). No icons, no colour. The hide button is the
  letter "o". With 1-2 open it runs off the screen.
- **Triggers**: a form. Drop-downs of ids, and a tick list of every spawn
  point in the level (15 rows in 1-2) for each spawn step. Up, Down and
  Out are words.
- **Arena builder**: a dialog of tick lists of ids. You pick walls by
  name, not by clicking them.
- **Foamer and pickup type**: a `<select>` beside the tool button.
- **Open**: level names and dates. No pictures.
- **Top bar**: eleven text buttons and a counts line.
- **Logic is invisible** in the 3D view until you select a trigger.

### 2.4 Things do not look like themselves

- A Foamer is a capsule with a nose. A pickup is a small box. EDITOR.md
  asked for "the game's own models"; `markers.ts` loads none.
- A built-in level's shell is one grey mass, and **its boxes cannot be
  edited** (open item in EDITOR.md). 1-2 opens with "0 of 2000 prims".
- On open the **camera is not framed**. 1-2 opened with the camera
  pressed against a wall (open item in EDITOR.md).

### 2.5 Building is slower than it should be

- No box select (a left drag on empty space does nothing).
- No copy and paste, so nothing moves between levels. Ctrl+D only.
- No groups, and no way to save a piece you built and stamp it again.
- Resize is the three.js scale handle, which grows a box from its centre.
  Making a wall 2 m longer on one side takes a scale, then a move.
- No size readout while dragging, and nothing that shows player height,
  so scale is guessed.
- Colour is set per thing in the inspector. There is no paint tool.

### 2.6 Smaller things found

- **Empty levels pile up.** Opening the editor with nothing saved, or
  pressing New, writes a level to the store before anything is placed.
- `src/editor/main.ts` is 1,544 lines and wires everything. Two cards
  cannot work in it at once (CLAUDE.md: one owner per module).
- Every change rebuilds every prim mesh, every marker and all three
  panels. Fine today. At the 2,000 prim cap it will be felt. Measure
  before fixing.
- The game has no teardown (`createGame` has no dispose). This matters
  for how playtest is built (section 3).

## 3. Quick playtest: the design

**Goal: press Tab, be in the level in about a second, press Esc, be back
exactly where you were.** Undo list, camera and selection untouched.

Two ways to build it:

| | A. Play in a frame (recommended) | B. Play in the same page |
|---|---|---|
| How | The editor stays loaded. Play puts `arena.html` in an `<iframe>` over the view. Esc removes it. | The editor page starts the game itself on the same canvas. |
| Editor state | Kept. The editor never unloads. | Kept. |
| Cleanup | Free. Removing the frame frees the physics world, the GPU memory and every listener. | The game has no teardown today. Rapier, Three.js, audio and input would all need one, and a leak means the editor slows down with every test. |
| Speed | One page load per test. Scripts and the physics engine come from the browser cache. To be measured in ED-11. | Fastest once it works. |
| Risk | Low. The round trip (`play.ts`) already exists. | High. Touches `src/game/game.ts`, which every page uses. |
| Size | One card. | Several, plus soak testing. |

Recommendation: **A**. If a measured test start is still too slow, the
next step is keeping one frame alive and sending it the new level, not B.

What A needs:

- `arena.html?...&from=editor` skips the title card and starts on the
  first click inside the frame (the browser needs one click for mouse
  look anyway).
- Esc in the frame tells the editor to close it (`postMessage`, same
  origin). No pause panel in a test run.
- **Tab** plays from the player start. **Shift+Tab**, or right click a
  spot and "Play from here", plays from that spot. P and Shift+P stay.
- A large Play button, top centre, drawn as a play triangle.
- Later, and only if wanted: when a test ends, the editor draws the path
  you ran and where you fell or were knocked out. Visual feedback from a
  test with no text.

## 4. Three sizes of plan

### Plan S: tune-up (about 4 cards)

Fix what gets in the way and stop there.

- ED-11 Quick playtest in a frame (section 3).
- ED-12 Open items: frame the player start on open; a built-in level's
  shell boxes become prims on open so they can be edited; no save until
  the first change.
- ED-13 Select and copy: box select, Ctrl+C and Ctrl+V (within and
  between levels), group and ungroup.
- ED-14 One-sided resize: drag a face to push or pull it, with the size
  shown in metres while dragging.

Gets: quick playtest and faster building. Does not get: visual over text.

### Plan M: overhaul the surface (recommended, about 13 cards)

Plan S, then replace the text panels with pictures and direct handling.
The file format, the document, the validator and the game stay as they
are.

**See it**

- ED-15 Split `main.ts` into modules (tools, selection, panels, files,
  dialogs). No behaviour change, tests green before and after. This goes
  first so the cards after it can run side by side.
- ED-16 Picture palette. Small pictures of every Foamer, pickup, blaster
  and shape, drawn once at start from the game's own models into
  canvases (in code, nothing generated, nothing fetched). The tool bar
  opens a tray of picture cards. The `<select>` lists go.
- ED-17 Real models in the view. A placed Foamer is its rig standing
  still, a pickup is its model. Capped: one shared mesh per type.
- ED-18 Panels pass. Outliner rows get an icon, a colour dot and a plain
  name ("Box 12", "Roamer 3"), groups fold, an eye icon replaces "o".
  Inspector: behaviour is four icon buttons, fewer number boxes, sliders
  where a number has a sensible range. Top bar: icons with short labels.
- ED-19 Level pictures. Each save keeps a small picture of the view. Open
  and My levels show a grid of pictures, not a list of names. The picture
  lives in the browser store, not in the level file.

**Logic you can see**

- ED-20 Wires. Every trigger is drawn in the view: an icon where it
  listens (its zone, button or Foamers) and coloured lines to what it
  acts on. Click a line or an icon to select the trigger. A toggle hides
  them all.
- ED-21 Trigger cards. The same when/do list, drawn as a sentence of
  picture chips: a zone chip, a Foamer portrait with a count, wall chips.
  Click a chip, then click the thing in the view (the Link code already
  does this). Spawn points are picked by clicking them, not from a tick
  list. Steps reorder by drag.
- ED-22 Arena builder in the view. Drag out the zone, click walls to turn
  them into blockers (they light up), click the spawn points, then set
  the waves on a strip of Foamer portraits with plus and minus. No dialog
  of ids.

**Build faster**

- ED-23 Stamps. Save a selection as a stamp with a picture; stamp it
  again in any level. Stored in the browser, exported and imported as a
  file. Paul builds his own kit; none ships unless he makes it.

### Plan L: rebuild (not recommended)

Throw the editor page away and write a new one, or bring in a UI
framework for the panels.

Why not: the parts under the surface are sound and covered by tests
(section 2.1). A rebuild spends weeks getting back to today before
anything improves, and a framework breaks "check what exists before
adding a package". Plan M reaches the same screen by replacing one panel
at a time, with the editor usable throughout.

## 5. Fun extras (after Plan M, each small, each optional)

- **Room and wall tools**: drag out a room (floor and four walls), or
  click a line of points to draw a wall.
- **Paint tool**: pick a colour, click things to paint them. Alt+click
  picks a colour up.
- **Reach guides**: select a ledge and see how far a jump and a dash
  carry from it, from the player's real numbers in `data/`.
- **Player figure**: a player-height outline on the ghost while placing.
- **Test trail**: the path of the last playtest drawn in the view
  (section 3).
- **Sounds**: a soft pop on place and delete, from the game's own audio.
- **Starter rooms**: New offers a few plain starting shapes (a flat
  floor, a walled room, a two-level room) as pictures. Geometry only.

## 6. Build order for Plan M

Each card is a run in its own worktree, reviewed by another model and
tried in the browser before it merges, as before.

| Order | Cards | Note |
|---|---|---|
| 1 | ED-11 | Quick playtest first. It pays back on every card after it. |
| 2 | ED-12, ED-15 | ED-15 owns `main.ts` alone, so ED-12 keeps to `view.ts`, `builtin.ts` and `store.ts`. |
| 3 | ED-13, ED-14, ED-16, ED-19 | Side by side: different modules after the split. |
| 4 | ED-17, ED-18 | Both need ED-16's pictures. |
| 5 | ED-20 | |
| 6 | ED-21, ED-22 | Both need ED-20. |
| 7 | ED-23 | Needs ED-13 (groups) and ED-19 (pictures). |

Checks for every card: `npm run check` and the smoke check green, the
card's feature seen in the browser, a handoff entry. ED-11 also records
the measured time from Tab to a playable frame. ED-17 records the frame
rate with 150 Foamers placed (the cap).

## 7. Questions for Paul

1. **Which size: S, M or L?** I would do M, starting with ED-11.
2. **Playtest in a frame (A) or in the same page (B)?** I would do A.
3. **Tab for play?** Tab is free today. P stays as well.
4. **Outliner**: keep it open on the left, or fold it away by default
   once the view shows everything? I would fold it.
5. **Shell boxes become prims** when a built-in level is opened as a
   copy. The copy then plays the same but is a different file shape from
   the original. Fine?
6. **Wires for triggers**: on by default, or only while a trigger or its
   things are selected? I would show them faintly always and brightly
   when selected.
7. **Which fun extras** from section 5 do you want, if any? The room and
   wall tools are the biggest time saver; the rest are small.
8. **Who is it for first?** If players come soon, starter rooms and
   first-run hints move up. If it is Paul's tool for now, they wait.

## 8. Not in this plan

Unchanged from EDITOR.md section 9: moving floors and lifts, custom
Foamers, blasters or textures, online sharing, phone and tablet editing.
Also not here: a node graph for scripting (Paul chose lists, Q2).
