# ED-10a: Make a level and Play a level on the title menu

Written 2026-11-13. Paul wants the level editor to ship with the game so
players make their own levels (design/EDITOR.md section 5: "The title
menu gains Make a level (the editor) and Play a level (My levels, or
import a file)"). The editor (`editor.html`) and the store
(`src/editor/store.ts`) exist, and `arena.html?level=local:<key>` plays a
stored level. A short card.

```
ID:          ED-10a
Owner:       Pi (strata-dsv41 on dgx-spark, thinking medium)
Reviewer:    Claude Opus 5.5
Branch:      ed-10a, in its own worktree
```

**Your files:** `index.html` and `arena.html` (the title menu block only),
`src/game/title.ts`, a new `src/game/my-levels.ts`, `src/style.css` (only
new rules for the list), new tests in `tests/game/`. Do NOT touch
`src/editor/`, `src/level/`, `src/arena/`.

## Read first

`design/EDITOR.md` section 5, `src/game/title.ts`, `index.html`,
`src/editor/store.ts` (`listLevels`, `putLevel`, `LOCAL_PREFIX`),
`src/level/validate.ts` (`validateLevel`), `src/style.css` (the title
menu's look).

## What to build

1. Two buttons under Continue on the title menu: **Make a level** opens
   `editor.html`; **Play a level** opens a small panel in the same style
   as the settings panel.
2. The panel (`src/game/my-levels.ts`, `wireMyLevels(root)`): lists the
   levels in this browser (`listLevels`, newest first: the level's
   `meta.name` and when it was saved), each with Play
   (`arena.html?level=local:<key>`) and Edit (`editor.html?open=<key>`;
   the editor learns that parameter in another card, so say so in
   HANDOFF). An **Open a level file** button takes a `.json` file, checks
   it with `validateLevel`, refuses it with the first three errors shown,
   otherwise stores it with `putLevel` and plays it. Back closes the
   panel. An empty list says there are no levels yet and points at Make a
   level. A browser that refuses the store says so instead of the list.
3. Keyboard: every button is a real `<button>`, Esc closes the panel.

## Done when

- Tests (jsdom, with the store functions stubbed): the panel lists two
  stored levels newest first; Play goes to the local URL; a bad file is
  refused with its errors and stores nothing; a good file is stored and
  played; an empty store shows the empty message.
- `npm run check` and `npm run smoke` pass.
- PLAN.md: an ED-10a row in section 12. HANDOFF.md: a dated entry directly
  under `## Log`.

## Rules

No em dashes anywhere (`node tools/check-no-em-dash.mjs`). Nothing fetched
from another host. Commit on `ed-10a` (include `tasks/ED-10a.md`); do not
push.
