# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project rules: DART

A browser first person shooter: foam dart blasters against Foamers, monsters
from the Foam dimension, with combat modelled on DOOM (2016) and DOOM: The
Dark Ages. Read `PLAN.md` (the plan, open questions and decisions log) and
`HANDOFF.md` (where things stand) before changing anything.

## Rules that are easy to break

- **Nothing is fetched from another host, ever.** Libraries are npm
  dependencies bundled by Vite; fonts, models, textures and sounds are
  committed. No CDNs, no Google Fonts, no analytics. Why: part of the
  audience is in China.
- **No em dash characters.** Not in the UI, comments, docs or commit
  messages. Use a comma, a full stop or a colon. Why: Paul reads them as a
  tell of AI writing.
- **No blood, foam only.** Foamers are foam all the way through: wounds
  show a foam core colour, parts break off as foam, most go down and
  dissolve, a catastrophic hit pops them into chunks. Menacing looks are
  fine (angry eyes, toothless grins, toy weapons); horror is not (no teeth,
  no fluids, no faces in pain). No demonic or religious imagery. Blasters
  look like toys. The audience is 10+. Full rules: PLAN.md section 2.
- **No trademarks.** Never use the words Nerf or DOOM in the game, and never
  copy a real blaster's design or the DOOM logo.
- **This repo is public.** `reference/` and `design/referenceimages/`
  (blaster photos) and raw audio recordings are gitignored and must stay
  that way. Nothing copyrighted that is not ours to publish.
- **Paul writes the content.** Blasters, story, Foamer names and looks, and
  the logo are his. Leave `[Paul]` placeholders; never invent them.
- **Performance is a feature.** Target: 60 fps on a mid-range laptop with
  integrated graphics. Benchmark on a base Apple Silicon Mac with headroom
  (about 90 fps). Anything that spawns objects has a hard cap.

## Keep HANDOFF.md current

After every change that works, add a dated entry to the top of the log in
HANDOFF.md: task ID, what was built, what was decided and why, and what is
still unverified. Update the status section if it changed. Do this before
saying you are finished. Record decisions in PLAN.md section 14.

## Working on it

- `npm install`, then `npm run dev` (Vite, http://localhost:5173).
- `npm run build` type-checks and builds to `dist/`. `npm test` runs the
  Vitest unit tests in `tests/`.
- Deploy: push to `main`. Cloudflare runs `npm run build` and serves
  `dist/`. `npm run deploy` also works from a machine logged in to wrangler.
- Work is split into task cards (PLAN.md sections 11 and 12). One owner per
  module at a time; code from one model is reviewed by another.
- Layout follows PLAN.md section 7.5. Tuning numbers belong in `data/` JSON,
  not in code.
