# Editor round 3: Paul's wishlist (28 Nov 2026)

Paul's words, grouped. The lead (Claude) decides the final plan from the
planners' documents. Read `AGENTS.md`, `CLAUDE.md`, `design/EDITOR.md`,
`design/EDITOR-V2.md` first.

## Bugs

1. Lights: the spread of a light seems to matter little or not at all.
2. The Paint tool's brush size is the terrain brush's. Paint needs its own
   brush size and strength.

## Painting and textures

3. A paint bucket.
4. Upload new textures and tilesets (the drawn ones are a good start, but
   too many do not match well). Generate more of them too.

## Light

5. Global illumination options.

## Arenas

6. Pre-built arena templates.
7. Write and save arena "formulas" (a reusable recipe for an arena fight).

## Editor basics

8. Rename elements.
9. A save and load screen that shows the maps being worked on.
10. A "reset camera" button that snaps back to the level's opening view.

## Tuning

11. Foamer behaviour options when a Foamer is selected: every existing
    setting (movement speed, health, damage multipliers, damage dealt,
    attack speed, size, all of it), set for one Foamer or for every Foamer
    of that type ("toggle to global").
12. Player weapon details tunable too.
13. Settings and changes made in one workspace carry over to the others
    (the editor, the range, the arena, play) unless "reset" is clicked.
14. Export the tuned settings and use that data to update the live game,
    so students making maps use the same configured toolset, the same
    enemy data, the same weapons, and later the same added assets and
    custom configurations.

## Constraints that always hold

- Nothing is fetched from another host. Uploaded textures live in the
  level file or the browser's own storage, never a server.
- Tuning numbers live in `data/*.json`. The live game reads them at build
  time (Vite imports the JSON). A browser cannot write the repo, so the
  path from "Paul tuned it" to "the live game uses it" goes through a file
  Paul exports and a commit (or a tool that applies the file to `data/`).
- Students are 10 and up, and may share school computers.
- Paul writes names, story and look decisions: leave `[Paul]`.
- No `Math.random` in game simulation; seeded PRNGs.
