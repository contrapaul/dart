# ART-03: the first three Foamers in colour

Written 2026-11-02 from Paul's names, looks and the colour palette
(`design/CONTENT-PLAN.md` sections 3, 3.3 and 3.4).

```
ID:          ART-03
Title:       The slice Foamers (F01 Slowmer, F02 Roamer, F05 Darter) as
             blocky voxel rigs in the factory palette, with turnaround
             renders for Paul to approve
Owner:       Kimi K3.1 Pro (via Pi)
Reviewer:    Claude Opus 5.5, then Paul approves the looks
Depends on:  PRE-05 (done)
Branch:      art-03, in its own worktree
```

## Read first

1. `CLAUDE.md` (every rule applies to you; note "No blood, foam only" and
   the looks rules)
2. `design/CONTENT-PLAN.md` section 3: the roster table (Name, Look,
   Colour columns for F01, F02, F05), 3.1 (parts), 3.3 (the menace pass
   rules: faces, posture, weapons you can see, foam nubs), 3.4 (the
   palette and the colour rules)
3. `data/foamer-rigs.json` (the format is in its `_note`) and the current
   F01, F02 and F05 greyboxes
4. `src/foamers/rig.ts` (`PartSpec`, `buildPartVolume`: the shapes, eyes,
   mouths, nubs, tips) and `data/materials.json`
5. `tests/foamers/` (what they assume about F01)

## How to work (important)

Keep each reply's thinking short and act through tools. Never write more
than about 100 lines in one tool call. After each change run
`npx tsc --noEmit` and the tests.

## What to build

### 1. Palette materials

Add the palette to `data/materials.json` as new entries (new ids, after
the existing ones; do not renumber anything): `foam-purple-light`,
`foam-purple-deep`, `foam-orange-light`, `foam-orange-deep`,
`foam-lime-light`, `foam-lime-deep`, with the hex values in CONTENT-PLAN
3.4. The mid shades are the existing `foam-purple`, `foam-orange`,
`foam-lime`; ink is `foam-ink`, cream is `foam-white`, core is
`foam-core`. Update the file's `_note`: the foam colours are now the
Foamer palette.

### 2. A turnaround renderer: `tools/render-rig.ts`

Kimi cannot see the sandbox, and Paul approves from pictures. Write a
small Node script (run with `npx vite-node tools/render-rig.ts F01`, or
`npx tsx` if vite-node is not available; no new dependencies) that
builds each part's voxels with `buildPartVolume`, poses them at rest with
`solvePose`, and renders four views to PNG in `design/foamers/`:
front, side, back and three-quarter, each about 512 px square.

- Orthographic, one cube per voxel, painter's order (far to near), flat
  shading per face (top lighter, sides darker), voxel colours from
  `data/materials.json`, a neutral grey background and a ground line.
- PNG written with Node's built-in `zlib` (a minimal encoder: signature,
  IHDR, IDAT, IEND, CRC32). No npm packages.
- Also write one sheet per Foamer, `design/foamers/<ID>-sheet.png`, with
  the four views side by side and the name under it.

### 3. The three rigs

Rebuild F01, F02 and F05 in `data/foamer-rigs.json`. Interpret Paul's
Look notes (quoted from CONTENT-PLAN 3) with the 3.3 rules. Designs must
be original: the notes name characters and games as a feel reference
only; do not copy any of them.

**F01 Slowmer** (Fodder). Paul: "Like a foam zombie, low menace, sort of
like a mildly scary 2 legged cookie monster." Colour: lime body, purple
limbs, orange club.
- Round, shaggy-looking body (foam nubs for the shag), big round eyes
  (mildly scary, not angry: round eyes with a heavy lid if the rig can
  do it), a wide toothless grin, long arms, shuffling bent legs, the
  club in the right hand.
- **Gameplay constraints (the game uses F01 now):** keep all nine part
  ids, kinds and the parent tree exactly as they are (the attacks need
  `foreArmL` and `foreArmR`, the tests count nine parts); keep the
  overall height and each part's size within 20% of today's, and
  `speed` and `health` unchanged. Shapes, nubs, rests, eyes, mouth and
  materials may change.

**F02 Roamer** (Fodder). Paul: "a more 'fit' version of the Slowmer, a
bit more menace, looks competent even if not a real threat." Colour:
orange body, purple limbs, lime satchel.
- Clearly the Slowmer's relative (same factory: shared shapes, same eye
  and mouth style family) but leaner, taller, standing better, angry
  eyes. The satchel of foam balls on its back and a ball held ready, as
  in the greybox.

**F05 Darter** (Heavy, charger). Paul: "A larger, bipedal mob like a
squig in warhammer but made out of foam." Colour: deep purple body, lime
armour plate, orange back (the weak point).
- Rebuild as a biped (the greybox is a quad bull): one big round
  body-head on two stout legs, a huge toothless gaping mouth, small angry
  eyes on top, the lime armour plate across its front and brow (it
  charges armour first), and the orange weak point on its back that must
  be easy to read from behind. Keep the parts breakable as section 3.1
  says (legs, plate, horns if any).

**All three:**
- Follow 3.4 exactly: primary about 60%, secondary about 30%, third
  about 10%; weak points in the third colour at light or mid shade;
  fodder in mid shades, the heavy leaning deep; eyes in cream with ink
  pupils, mouths ink; no pink, blue or yellow anywhere.
- Update `label` to the name (Slowmer, Roamer, Darter).
- Voxels are 5 cm; painted details 2 to 3 voxels so they read at a
  distance.
- Toy-like: rounded shapes, no teeth, no pointed claws, nubs not spikes.

Leave the other ten rigs as they are (greybox).

### 4. Notes for Paul

`design/foamers/README.md`: one short section per Foamer: the sheet
image, what you did with Paul's note and why, the colour split, and
anything you want Paul to decide. Plain prose, no em dashes.

## Tests

1. `tests/foamers/rig.test.ts` (extend): every rig part's material and
   tip material exist in `data/materials.json`; no rig of F01, F02, F05
   uses pink, blue, yellow or greybox materials; each of the three uses
   at least one purple, one orange and one lime material.
2. The F01 constraints above: same part ids, kinds, parents; height and
   part sizes within 20% of the values before this task (write the old
   values into the test).
3. The renderer: rendering F01 produces a PNG with a valid signature and
   the expected width and height, and is identical when run twice.

All existing tests must still pass unchanged.

## Done when

- [ ] `npm test`, `npx tsc --noEmit` and `npm run build` pass.
- [ ] `design/foamers/` has the four views and a sheet for F01, F02, F05.
- [ ] No em or en dashes anywhere you wrote (check with
      `perl -CSD -ne 'print "$ARGV:$.\n" if /\x{2014}|\x{2013}/' $(git ls-files | grep -vE '\.(png|glb|webp|jpg)$')`).
- [ ] A dated `HANDOFF.md` log entry at the top of the Log (`date +%F`).
      Set the ART-03 row in `PLAN.md` to "Kimi (review)".
- [ ] Committed on `art-03`, each message ending with
      `Co-Authored-By: Kimi K3.1 Pro via Pi <noreply@local>`. **Do not
      merge and do not push.**

## If something is unclear

Stop and write the question at the top of `design/foamers/README.md`
rather than guessing. Do not change any file under `src/` except
`src/foamers/rig.ts`, and only to add a small new paint option you need
(say so in the README, with a test).
