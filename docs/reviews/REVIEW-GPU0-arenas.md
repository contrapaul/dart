# Review: arena templates and arena formulas (R3-07, R3-08)

Scope: `src/editor/arena-templates.ts`, `data/arena-templates/*.json`,
`src/editor/arena-formulas.ts`, `src/editor/arena-build.ts`, the Arena dialog
in `src/editor/main.ts` (the `arenaDialog` function), plus the supporting
read: `src/editor/clipboard.ts`, `src/level/validate.ts`,
`src/level/arena-to-triggers.ts`, `src/editor/asset-panel.ts`,
`data/editor.json`, `src/editor/doc.ts`. Cards: `tasks/R3-07.md`,
`tasks/R3-08.md`. Tests run: `npx vitest run tests/editor/arena-templates.test.ts tests/editor/arena-formulas.test.ts tests/editor/arena.test.ts` (26 pass), plus the em-dash check (clean).

## Summary

The templates build and validate (tested, green). The formula store and file
format look sound. One real UI bug in the Arena dialog (delete stays
disabled after picking a formula), one data/format asymmetry in the
reader (`unlockOnClear` reads as false when a file omits it), two small
cosmetic notes, and one unrelated data smell I noticed while reading
`data/editor.json`.

## Findings (real)

### 1. The "Delete" button stays disabled after picking a formula

`src/editor/main.ts`, Arena dialog (~line 2825, handler; ~line 2792,
`refreshFormulas`).

`refreshFormulas()` is the only code that sets `deleteBtn.disabled`, and it
is called from the load, save, delete and import paths, never from the
`formulaSelect` change handler. The change handler only fills the dialog
(`applyFormula`).

Concrete case: open the Arena dialog, pick "gap" from the formula select.
The waves fill in. The Delete button is still disabled (last refresh left
it disabled with an empty select), so the user cannot delete the formula
they just picked. It only enables again after a save, a delete or an
import.

Same class of bug after "Save as formula": `refreshFormulas()` runs before
`formulaSelect.value = name`, so `deleteBtn.disabled` is computed for the
pre-save selection and never re-evaluated after the new formula is picked.

The same handler is the only writer of `deleteBtn.disabled` in the
change path, so the button's state is wrong by default.

Confidence: sure (read the DOM code; the disabled attribute persists
because nothing re-enables it).

Smallest fix: in the `formulaSelect` change listener, add
`deleteBtn.disabled = !formulaSelect.value` after the pick; in the save
handler, set `deleteBtn.disabled = !formulaSelect.value` after
`formulaSelect.value = name`.

### 2. `unlockOnClear` reads as false when a file omits it, while the
  dialog and `buildArena` treat omission as true

`src/editor/arena-formulas.ts` line 141:
`unlockOnClear: Boolean((raw as { unlockOnClear?: unknown }).unlockOnClear)`

`formulasFileText` always writes the field, so a file this editor wrote
round-trips fine. But a hand-written or older file that leaves
`unlockOnClear` out is read as `false`, which builds a fight that leaves
the doors shut at clear. The dialog and `buildArena` treat a missing
`unlockOnClear` as true (`spec.unlockOnClear === false ? [] : ...`, and
`let unlockOnClear = true` in the dialog). Same pattern for `lockDoors`
(default false), where the file-omitted read happens to agree with the
dialog default.

A file that a previous editor version wrote without `unlockOnClear`
(never existed as a writer, but the format is public) or an importer that
drops unknown fields silently flips the fight's clear behaviour.

Confidence: likely (the logic is plain to read; only the file-omitted
path is affected, and the writer always writes the field).

Smallest fix: in `readFormulasFile`, preserve the field as
`(raw as { unlockOnClear?: unknown }).unlockOnClear !== false` (or
default it to true like the dialog does), keeping `lockDoors` at `false`
on omission. Worth an explicit test.

### 3. `data/editor.json` has a duplicate `paint` key

`data/editor.json` (the file R3-08 edited): two `"paint"` objects, the
first (no `bucketMax`) and a later one (with `bucketMax: 500`). The last
key wins under JSON.parse, so the first block is dead data. Not caused by
R3-07/R3-08, but it is the file both cards touch.

Confidence: sure (visible in the file; `src/editor/bucket.ts` reads
`bucketMax` off the second block).

Smallest fix: delete the first `paint` block (keep the one with
`bucketMax`). Not a blocker for this review.

## Findings (small)

### 4. `open-yard.json` blocker is wider than the door gap it sits in

`data/arena-templates/open-yard.json`: the north gap is x in [-1.5, 1.5]
(3.0 m), the hidden blocker is 3.5 m wide (x in [-1.75, 1.75]). When it
shows, its edges clip the wall faces by 0.25 m each side. The other three
templates fit (square room 3.0/3.0, long hall 3.0/3.0, ring 5.0/3.5).
Cosmetic, validator passes.

Confidence: sure (arithmetic from the file).

Smallest fix: make the open-yard blocker 3.0 m wide, or widen the gap.

### 5. The delay field's title is wrong for wave 1

`src/editor/main.ts` Arena dialog: the per-wave "delay" field is titled
"seconds after the previous wave", but wave 1 has no previous wave; its
delay runs off the lock trigger (in `buildArena`, `firstDelay` runs the
wave through an after of the lock). The help text says the same. A user
reading the title for wave 1 will not understand what 2 seconds buys them
there.

Confidence: sure (read the code; the mismatch is with the comment at
`arena-build.ts` line 96).

Smallest fix: title the field (and the help row) "seconds after the fight starts / after the previous wave", or special-case wave 1.

### 6. `_note` in `data/editor.json` does not mention `arenaFormulas`

`data/editor.json`: the `_note` describes every tuning section except
`arenaFormulas`, which the file gained in R3-08. Minor doc inconsistency.

Confidence: sure.

Smallest fix: add a clause to the `_note`.

## What looks right

- Templates place and validate: all four files pass `readAssetsFile` with
  no errors, pass `validateLevel` with no errors, and rename ids on paste
  (ids inside triggers included). `tests/editor/arena-templates.test.ts`
  covers this and passes.
- `buildArena` trigger shapes: the delayed first wave runs wave 1 through
  an `after` of the lock; delayed middle waves run through an `after` of
  the empty-`do` killed trigger, and the validator's timed exception
  (`src/level/validate.ts` line 769-770) allows that empty `do`. A fight
  with no blockers and no doors produces a lock with an empty `do` plus an
  `after` wait, which also passes; the clear trigger is omitted when there
  is nothing to do, matching the validator's empty-do rule.
- The Arena dialog formula row: choosing a formula fills waves and the
  two toggles, and leaves level-specific state (blockers, spawn points,
  doors) untouched, matching the card's "zone, spawn points, blockers and
  doors are level specific".
- The formula store: own IndexedDB database, keyPath `name`, import renames
  with `freeFormulaName` so an import never replaces an existing formula,
  cap enforced both on the file reader and on the dialog (`formulaProblem`),
  `fitImport` leaves a count of what did not fit. Round trip
  `formulasFileText` → `readFormulasFile` is tested.
- No em dashes (`node tools/check-no-em-dash.mjs`), no fetch-from-host, no
  `Math.random` in the arena code paths, tuning numbers come from
  `data/editor.json` (`arena.holdSeconds`, `arena.defaultCount`,
  `arenaFormulas.max`; the template files carry explicit `holdSeconds: 0.5`
  copies of the default, consistent with `buildArena`'s own output).
- The Arena dialog: `say()` status text, `arenaProblem` gating the Build
  button, the trigger cap guard, undo through `addMany`/`addMixed` (one
  step per build, per paste), all present.

## Not verified

- The dialog itself in a browser (waves UI, the formula select / save /
  delete / export / import path, the IndexedDB round trip, the delay
  `after` triggers firing in play). The card says the same; this review is
  headless.
- The Arena dialog's `Delete`/`Export`/`Import` buttons and the
  asset-panel Templates section were read but not clicked.
- `formulaProblem` at cap: saving an existing formula at the 40-formula
  cap is also refused (the cap message fires regardless of whether the
  name is taken). That is defensible behaviour, but worth a look.
