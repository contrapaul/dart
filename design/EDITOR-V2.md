# Level editor, round 2: Paul's 13 items (plan, 2026-11-27)

Paul's list, 27 Nov 2026, written up by Claude Opus 5.5 as lead. Paul was
asleep when this was written: every decision below is the lead's, made to
keep work moving, and is marked **Decided** so Paul can overturn it.

## The items and where each lands

| # | Paul's item | Card | Who |
|---|---|---|---|
| 1 | Collapse and expand the outliner's groups | ED-30 | Inkling |
| 2 | Triggers become unselectable when their text is long | fixed by the lead | Claude |
| 3 | Lock geometry | ED-30 | Inkling |
| 4 | Import 3D models, breakable like other geometry | ED-35 | DeepSeek |
| 5 | Terrain: raise, lower, flatten, smooth | ED-34 | Claude |
| 6 | Placeable lights with settings | ED-32 | Inkling |
| 7 | Texture and material painting | ED-36 (things), ED-34 (terrain) | Inkling, Claude |
| 8 | An asset turns and scales as one object | ED-37 | DeepSeek |
| 9 | Can triggers move things? (they could not) | ED-31 | DeepSeek |
| 10 | A button that sets off triggers, placed on things | ED-31 | DeepSeek |
| 11 | The player start only faces one way | ED-30 | Inkling |
| 12 | Rotation snaps to 15 degrees | ED-30 | Inkling |
| 13 | Physics objects: weight, damage, breakable | ED-33 | DeepSeek |

Item 2's cause: in a trigger's outliner row only the name was clickable, and
the one-line summary beside it was allowed to squeeze the name to zero
width. The whole row now picks, and the summary gives way first.

Item 9's answer: no, triggers could show, hide, open, close, spawn, wake,
message and checkpoint, but not move. ED-31 adds a `move` action.

## Decisions

- **Decided: GLB only for model import.** It is one file with its
  textures inside, Blender and every modelling tool export it, and three.js
  already has the loader (bundled, nothing fetched). The GLB is kept inside
  the level file as a data: URL, the way a sky image is. Caps:
  `data/editor.json` `models` (3 MB a model, 12 MB a level).
- **Decided: an imported model breaks two ways.** Hit points, then it
  shatters into foam chunks (the ED-06 Breakables path), or `voxel`: the
  model's inside is filled with voxel foam and carves like any foam wall.
  Voxel is the "like the other geometry" Paul asked for; it costs voxels, so
  it is a tick box, not the default.
- **Decided: one terrain per level,** a heightfield of square cells
  (`Terrain` in `src/level/format.ts`), up to 256 cells a side. A
  heightfield is what Rapier collides fastest with, and the nav grid bakes
  from colliders, so Foamers walk on it with no new code. Overhangs and
  caves stay prims and models.
- **Decided: terrain paint blends up to four surfaces** with a weight per
  vertex, drawn in one material.
- **Decided: surfaces are drawn in code** (`src/render/surfaces.ts`,
  `data/surfaces.json`): brick, tiles, planks, metal, concrete, grass, sand,
  rock, stripes and plain, each tinted by the thing's colour. No image
  files, nothing fetched, and they follow the foam palette.
- **Decided: lights are point and spot,** with a level-wide ambient and
  sun (`LevelLighting`). At most 32 lights and 4 shadow casters
  (`data/editor.json`), because every shadow is a render pass.
- **Decided: `move` moves by an offset and a turn about Y,** over seconds,
  eased. A repeat trigger moves again from where things are. A moving thing
  keeps its collider; a button mounted on it (`on`) rides with it.
- **Decided: a placed button needs no action of its own;** its `pressed`
  triggers act. It can be mounted on any face, and can be set to need the
  use key instead of a step or a dart.
- **Decided: a group turns and scales as one** about the middle of its
  bounds. Scaling a group is uniform (one number), because a box turned at
  an angle cannot be stretched along another axis and stay a box.
- **Decided: locking applies to prims, props, models, physics objects and
  the terrain.** A locked thing is drawn and listed, a click in the view
  passes through it, and the outliner's lock button unlocks it.

## Contracts (written by the lead before any builder started)

All in commit "feat(editor): ED-30 to ED-37 contracts", on `main`:

- `src/level/format.ts`: `Button.action` optional, `Button.on`,
  `Button.use`; `Prim.locked`, `Prim.surface`; `Prop.locked`; the `move`
  trigger action; `LevelLight`, `LevelLighting`, `PhysicsObject`,
  `ModelAsset`, `PlacedModel`, `Terrain`; `Level.lights`, `lighting`,
  `physics`, `modelAssets`, `models`, `terrain`.
- `src/level/validate.ts`: the shape rules for every new type and the caps.
- `src/editor/doc.ts`: entry kinds `buttons`, `lights`, `physics`,
  `models`.
- `src/editor/markers.ts`: a placeholder marker for those kinds, each card
  replaces its own.
- `src/level/triggers.ts`: `TriggerHost.move` (optional until ED-31).
- `src/render/surfaces.ts`: `surfaceMaterial(surface, colour)`, plain until
  ED-36.
- `data/editor.json`: the caps; `data/surfaces.json`: the surface list.

## How the work is split

Each card owns new files of its own and adds short hook lines to the shared
ones (`src/editor/main.ts`, `view.ts`, `help.ts`, `editor.css`,
`editor.html`, `src/level/build.ts`, `src/arena/extras.ts`). The lead merges
and resolves the hook lines. Builders do not edit `HANDOFF.md` or
`PLAN.md`; each writes a `## Result` section at the end of its own card,
and the lead writes the log.

The worked example for "a new kind of thing in the editor and the game" is
the props commit, `git show 5ea5211`: the format type, the validator, the
editor's kind, marker, tool button, picker, inspector fields, and the game
side in `src/level/build.ts` and `src/arena/extras.ts`.

Merge order: ED-30, ED-36, ED-32, ED-31, ED-33, ED-37, ED-35, ED-34.
