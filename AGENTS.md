# AGENTS.md: DART, for builder agents

Read `CLAUDE.md` first: its rules apply in full and win over anything else.
The short version of what goes wrong most:

- No em dash or en dash characters anywhere (code, comments, docs, commit
  messages). Check: `node tools/check-no-em-dash.mjs`.
- Nothing is fetched from another host. Libraries come from npm and are
  bundled by Vite; three's loaders and helpers are imported from
  `three/examples/jsm/...`.
- Tuning numbers live in `data/*.json`, not as literals in code.
- No `Math.random` in game code that must be repeatable; use a small seeded
  PRNG.
- Paul writes names and story: leave `[Paul]` where a name is needed.
- Foam only, ages 10 and up, no trademarks.

Build and test:

- `.swarm/preflight.sh` runs the type check, the unit tests and the dash
  check. It must be green before every commit.
- Tests are Vitest under `tests/`, headless. Rapier runs in tests (see
  `tests/level/` for how a world is made). There is no browser for you:
  keep logic in pure modules you can test, and list what a person should
  look at in the browser.

Commits: Conventional Commits with your card as the scope, for example
`feat(ED-31): the mover`. Never merge, rebase, push, switch branches, or
edit `HANDOFF.md` or `PLAN.md`. Write your results at the end of your own
card in `tasks/`.

The plan for this round is `design/EDITOR-V2.md`. The worked example of a
new placed kind (editor and game) is `git show 5ea5211`.
