# ART-00: Spike, B01 modelled in Blender by script

Written 2026-11-01. Paul approved the B01 brief and asked for Kimi to build
it. This is the trial of the blaster pipeline in PLAN.md section 5.2: if
it gives a good model at a sensible time and cost, every blaster goes this
way (ART-04).

```
ID:          ART-00
Title:       B01 "The Dartman" built by a Blender Python script, exported
             to .glb to the PLAN 5.2 contract, with turnaround renders
Owner:       Pi running Kimi K3.1 Pro (moonshotai provider)
Reviewer:    Claude Opus 5.5, then Paul approves from the renders
Depends on:  design/blasters/B01.md (approved by Paul 2026-11-01)
Branch:      art-00, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies: no em or en dashes, no trademarks,
   no text or logos on the model)
2. `design/blasters/B01.md`: the card and the brief. **This is what you
   model.** Do not look for or use any product photo.
3. `PLAN.md` section 5.2, "The `.glb` contract"

## Tools

Blender 5.2.3 LTS, run headless (the path has spaces, quote it):

```bash
BLENDER="$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender"
"$BLENDER" --background --factory-startup --python art/blasters/B01/build.py
```

## Files

Create:

- `art/blasters/B01/build.py`: one script that starts from an empty scene,
  builds B01, exports the `.glb`, and renders the turnaround. Running it
  twice gives the same result. All sizes and colours as named constants
  at the top, so "make the barrels longer" is a one-line change.
- `art/blasters/check_glb.py`: a Blender script that imports a `.glb`
  given after `--` on the command line and prints: overall size in
  metres, triangle count, material count, every node name with its parent
  and origin, and PASS or FAIL for each contract rule. Reused for every
  blaster.
- `public/models/blasters/B01.glb`: the export.
- `art/blasters/B01/renders/side.png`, `three-quarter.png`, `top.png`,
  `first-person.png`: 1024 x 768, plain light grey background, soft light,
  Eevee. First person: camera at eye height looking forward, the blaster
  low on the right as a player holds it.
- `art/blasters/B01/NOTES.md`: how long it took (start and end times from
  `date`), how many build and render rounds, what you changed after
  looking at renders, anything in the brief you could not do and why.

## Modelling

- Toy plastic look: bevel every hard edge (about 2 to 4 mm), so nothing
  looks sharp or real. Flat colours from the brief, slightly glossy
  (roughness about 0.4). The magazine is see-through (alpha blend about
  0.5) with simple dart shapes inside.
- Use primitives, bevel and solidify modifiers, booleans for the vent
  holes, and curves or simple extrusions for the grip and stock. Apply
  every modifier before export.
- Join static pieces into `body`; keep each moving part and each mod its
  own object named exactly as the brief's Node column, with its origin on
  its pivot or its rest centre as the brief says.
- Empties `muzzle_1` to `muzzle_3` at the barrel tips (and `muzzle_4` to
  `muzzle_6` under `mod_double`), pointing forward.
- Export glTF binary with +Y up; the barrels point along -Z in the glTF
  (check with `check_glb.py`). Origin of the whole model at the grip.
- Budget: at most 20,000 triangles, 1.5 MB, 8 materials, no image
  textures.

## How to work

1. Write `build.py` in parts (never more than about 200 lines per tool
   call), run it, fix errors.
2. Run `check_glb.py` on the export until every rule passes.
3. Look at your four renders (read the PNG files) against the brief: sizes,
   proportions, the originality list, colours. Fix and re-render. Two or
   three rounds is normal; stop when it matches the brief.
4. Write `NOTES.md`.

## Done when

- [ ] `build.py` runs from scratch with no errors and writes the `.glb`
      and four renders.
- [ ] `check_glb.py` passes every rule on `B01.glb`.
- [ ] The renders match the brief, including all seven originality
      points and no text anywhere.
- [ ] No em or en dashes in anything you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files) art/blasters/*.py art/blasters/B01/NOTES.md`).
- [ ] A dated `HANDOFF.md` log entry at the top of the Log: "ART-00:
      B01 in Blender (Kimi via Pi)", what was built and what is
      unverified. Do not edit other entries.
- [ ] Committed on `art-00`, message starting `ART-00:` and ending with
      `Co-Authored-By: Kimi K3.1 Pro via Pi <noreply@local>`. **Do not
      merge and do not push.**

## Not in this task

- Loading the model in the game (GAME-09) and animating it (ART-05).
- The other seven blasters.

## If something is unclear

Write the question at the top of `NOTES.md` and make the choice the brief
points to most; do not stop the whole task for it.
