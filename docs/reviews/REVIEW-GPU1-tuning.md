# Review: the tuning system (R3-13, R3-14, R3-15)

Scope: `src/core/tuning.ts`, `data/tuning.json`, the merge points
(`specFor` / `rigFor` / `tunedOne` in `src/foamers/foamers.ts`,
`resolveSpec` in `src/weapons/blaster.ts`, `src/level/placed.ts`), the
editor panel (`src/editor/tuning-fields.ts`, `src/editor/tuning-panel.ts`),
the range panel (`src/range/blaster-fields.ts`, `src/range/tune-panel.ts`,
`Loadout.rebuild` in `src/weapons/loadout.ts`), the arena's pause panel
(`src/game/ui.ts`), `tests/level/placed-tuning.test.ts`. Cards:
`tasks/R3-13.md`, `tasks/R3-14.md`, `tasks/R3-15.md`.
Tests run: `npx vitest run tests/core/tuning.test.ts tests/editor/ tests/range/ tests/level/placed-tuning.test.ts` (452 pass) plus the em-dash check (clean).

No em dashes, no new `Math.random` in the new code, tuning numbers are
not literals in the new code (only panel field bounds, which the card
asks for). The headless tests pass. The real issues are in the range
panel's mod handling, in the workspace rebuild wiring, and in one
freeze-the-array side effect in the editor panel.

## Summary

The store (`src/core/tuning.ts`) is sound: deep merge, storage event,
cache invalidation, export, reset all behave and are tested. The editor
panel and the placed-Foamer path work and are tested. Two findings are
worth fixing before this ships: the range panel reads the unmodded
spec (real mismatch with the game) and the arena/game never re-resolve
blasters on a tuning change. One design side effect (the attack-list
freeze in the editor) deserves a decision.

## Findings (real)

### 1. The range Tune panel reads the unmodded spec, so edits are
    shadowed by active mods

`src/range/blaster-fields.ts` (`valueInForce`, `committedValue`,
`isChanged`, `patchFor`), and `src/range/tune-panel.ts` (the rows, the
reset button).

`valueInForce` calls `resolveSpec(id)` with no mods; `committedValue`
merges the committed tuning file over the raw data. `isChanged` reads
the override directly. The mod layer in `resolveSpec` is applied AFTER
the tuning merge, so a mod override always wins over the tuned value.

Concrete case: in `range.html`, B06 (the explosive blaster) with the
"rate" mod on (`fireInterval: 0.12`). The Tune panel shows "Fire
interval (s)" at the base value with the range slider, e.g. 0.5s. Paul
drags the slider to 0.3s. `tuneBlaster` writes `{ fireInterval: 0.3 }`;
`resolveSpec` then returns the modded spec with `fireInterval: 0.12`.
The blaster keeps firing at 0.12s while the panel and the readout say
0.3s, and the changed-mark/reset machinery (`isChanged`) compares the
override to the committed base, not to what the blaster uses. Same
class for B01 with "double" (magSize 12), B04 with "suppress"
(recoil.spreadPerShot 0.12), B02 with "heavy" (fireInterval 0.45), B08
with "control" (fireMoveShare 0.85). `loadout.rebuild` resolves with
`this.mods[i]`, so the blaster and the panel disagree by construction.

Confidence: sure (read the code paths; the mod merge order is in
`resolveSpec`).

Smallest fix: resolve and read with the held blaster's mods (pass
`Loadout.modsOf(i)` through to the panel, mirroring `rebuild`), or
filter/hide the fields the active mods override. Either way `isChanged`
and the reset target have to use the modded spec.

### 2. The arena and play never re-resolve blasters on a tuning change

`src/range/main.ts` (the `onTuningChange` that rebuilds every blaster)
is the only place that does this. `src/game/ui.ts` (the pause panel
note), `src/game/game.ts` (boot), `src/arena/main.ts`: no rebuild on
tuning change.

Concrete case: Paul tunes B01's magSize in the range, closes the range,
opens the arena. The arena's `Loadout` was built at boot with the
old spec, so B01 still fires at the old magSize for the whole session.
The "Tuning changed on this browser" note in the pause panel shows and
the Reset button clears the override, but the already-loaded blasters
still keep the old spec until the page is reloaded. The foamers pick up
the change at the next spawn (the cache is cleared in
`foamers.ts`), so a page can show two different "tuned" worlds at once.
The card (R3-14, step 1 and 2) says the editor, the arena and play use
the same numbers; only the editor and the range honor that today.

Confidence: sure (no rebuild call anywhere in the arena or game pages;
the only one is in `src/range/main.ts`).

Smallest fix: in the arena/game pages, add the same `onTuningChange`
listener that rebuilds the loadout (`for (i) loadout.rebuild(i)`),
same as `src/range/main.ts`.

### 3. Attack edits and resets freeze the whole attack list, in both
    modes

`src/editor/tuning-fields.ts` (the attack patches) and
`src/editor/tuning-panel.ts` (`commit`, `mergeTune`).

The attacks field patch is built from the *merged* spec:

```ts
(s, _r, v) => ({ spec: { attacks: s.attacks.map((a) => (a.id === atk.id ? { ...a, damage: v } : a)) } })
```

and `deepMerge` replaces array values wholesale, so the patch stores the
full attack list into the override (type mode: `tuneFoamer`) or into
the placed Foamer's own tuning (`mergeTune`). Arrays cannot be merged
key by key, so this is the shape the design forces; but it means every
attack edit and every reset bakes the *current* list into the patch.

Concrete case: F01 has two attacks (`bonk`, `headbutt`). Paul tunes the
type with "Every F01": damage bonk 20, headbutt stays at the committed
value, and the full list is stored in the override. He then edits the
placed Foamer's own tuning in "This Foamer" mode (windup 0.9). The
own tuning written is `{ id, damage, windup, strike, ... }` for every
attack at the type-tuned values. He then hits "Reset this type" in
"Every" mode (or undoes the type edit): the type returns to committed,
but the placed Foamer keeps `bonk.damage = 20` forever, because its
own tuning carries a frozen snapshot, not a patch over the type. The
"reset" button on one attack field does not undo the type-level change
either: it writes the committed value for that one field into a
snapshot of the full list, which still carries every other field's
current value.

Confidence: sure (the code and the `deepMerge` array semantics; the
tests only assert the merged shape, not that later type changes reach
the placed Foamer).

Smallest fix: make the reset patch rebuild the attack list from the
committed base (via `committedValue`-style base spec, like
`baseSpec` does for other fields), so a reset restores the full
committed attack list rather than a frozen snapshot; or have the placed
Foamer store only the changed attack's delta and have `tunedOne` merge it
over the live type (the doc on the format says tuning is a patch over
the type, which this patch does not do).

### 4. A promoted placed Foamer shows the unpromoted numbers

`src/editor/tuning-panel.ts` (`buildTuningPanel`, `tunedOne(type, own, false)`)
and `src/editor/tuning-fields.ts` (`fieldsFor`).

The panel and the fields file always pass `promoted = false`. The game
does not: `src/level/placed.ts` (`spawnOne`) passes `f.promoted`. For a
promoted placed Foamer the type-tuned rig is health-scaled (`rigForSpawn`
multiplies `rig.health` by `PROMOTED.healthMultiplier` and swaps part
materials), so the placed Foamer in play spawns with
`round(health * healthMultiplier)` (1.5, so F01 shows "6 hp" in the panel
but spawns with 9 in play), its own health field shows the unpromoted
number (the committed health, e.g. 6 for F01) with no changed mark, and a
health reset writes the committed value, which would put the promoted
copy back at a number neither the panel nor play reads.

Confidence: sure (the hardcoded `false` in both call sites; the only
place that passes `f.promoted` is `src/level/placed.ts`).

Smallest fix: make `fieldsFor` and `buildTuningPanel` take the
promoted flag (`f.promoted`) and pass it through to `tunedOne`, so the
reported value and the changed-mark match what play spawns.

### 5. `preferredDistanceMetres` is shown for every type, but the base
    spec declares it (8.0) for all types

`src/editor/tuning-fields.ts` (the `if (spec.preferredDistanceMetres !== undefined)` guard), `data/foamers.json` (`test.preferredDistanceMetres: 8`).

The card says the field appears "where the type has it". The base
declares it, so the merged spec always has it and the guard never
hides the field: every type gets a "preferred distance (m)" row, but the types whose
attacks are not ranged read it by the type's own brain and ignore it:
F01, F03, F05, F07, F11, F12 and F14. Their brains pick `holdRange` by
type, not `preferredDistanceMetres` (the bonker's brain reads
`holdRange: BRAIN.holdRangeMetres`). The ranged types (F02, F04, F08,
F09, F10, F06, F13) do read it.

Concrete case: F01 box, the panel lists "preferred distance (m)" at 8.0
and Paul drags it to 12. The Foamer keeps the bonker ring (its brain
uses `holdRange`), so the number does nothing while looking live.

Confidence: likely (the base file and the f01 brain; not every brain was
checked, but the bonker's `holdRange` is explicit).

Smallest fix: gate the field on the type actually using it (ranged /
pounce / leap brains) rather than on the merged spec having the key,
matching the card's wording.

### 6. The arena's "Tuning changed on this browser" note and the
    per-field reset both key off the override being non-empty, which is
    not the same as "is changed"

`src/game/ui.ts` (`syncTuningNote`), `src/range/tune-panel.ts` (the
reset button), `src/range/blaster-fields.ts` (`isChanged`).

`isChanged` is false when a field's override equals the committed value,
but the per-field reset writes the committed value back into the
override rather than deleting the key:

```ts
reset.addEventListener("click", () => tuneBlaster(id, patchFor(field, committedValue(id, field))));
```

so after one reset the override still contains the field, the arena's
note (`Object.keys(t.blasters).length > 0`) stays visible for the whole
session, and `exportTuning()` carries a no-op entry (e.g. `{ "B01":
{ "magSize": 8 } }`). The note says "Tuning changed on this browser"
when nothing is changed any more.

Confidence: sure (the code paths; the note and the export both key off
the override's existence).

Smallest fix: after a per-field reset, remove the key (or the blaster
entry) from localStorage via a remove/reset-one-field path in
`src/core/tuning.ts`, or have `exportTuning` and the arena note skip
fields whose override equals the committed value.

## Things I checked and found clean

- `src/core/tuning.ts`: `deepMerge` (arrays replace, objects merge,
  values replace, no mutation of the input), the storage listener,
  `exportTuning`, `resetTuning` scopes, the empty file today, and the
  cache-invalidation listener in `src/foamers/foamers.ts` all behave.
- `tunedOne` / `specFor` / `rigFor` / `rigForSpawn`: fresh objects for
  the placed own tuning, shared cached spec/rig for the type, and the
  promotion cache is cleared on tuning change.
- `src/level/placed.ts`: `f.tuning` reaches the spawn unchanged, the
  waiting/wake flow is unchanged, and the level file carries `tuning`
  (plain JSON round-trip, `validateLevel` checks only that it is an
  object).
- `Loadout.rebuild` (range): the fresh blaster keeps reserve and shots,
  caps mag by the new magSize, and preserves the dart type; the lost
  `firing` flag and the missing `spec.show`/`spec.hide` hand-off are
  not issues (they are re-applied right after the rebuild).
- `tests/level/placed-tuning.test.ts`: placed own tuning and a type
  tuning reached a wave spawn through `src/level/arena.ts` /
  `src/level/placed.ts`.
- The em-dash check is clean; `Math.random` does not appear in the
  new tuning code; tuning-number literals in the new files are field
  bounds the card asks for.

## Not verified (no browser)

- The range panel with a mod on (findings 1, 2): I read the code and
  the tests but did not see the page running. This is the one worth a
  person opening `range.html` in.
- A promoted placed Foamer through the inspector (finding 4):
  untested here.
