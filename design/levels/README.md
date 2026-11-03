# DART level design: pillars and rhythm

Status: **proposal, LVL-00, 2026-11-03**. Design notes only, no game code.
Paul's direction: "Levels will be semi-open but follow a linear path as in
the modern Doom games."

Read with `PLAN.md` 9 (level design), `PLAN.md` 7.3 (destruction),
`design/CONTENT-PLAN.md` 2 (the level table) and `KIT.md` (spaces and
sizes). Names, settings and story are Paul's: every concept here is
written so it works in any setting, and each names [Paul] where a place
or a beat goes.

---

## 1. What semi-open linear means

One critical path from start to exit. You can always see the next goal,
and you can always leave the path for a while and come back to it. You
never have to find a switch in a room you have already cleared to open a
door you have already seen.

The shape of a level is a **spine with rooms hanging off it**:

- The spine is the critical path. It is 1 to 3 minutes of walking at walk
  speed from end to end if nothing is in the way.
- Every arena on the spine has one way in and one way on, and the way on is on
  the far side from the way in, so the player crosses the space.
- Side rooms hang off the spine and never off each other more than one
  deep. A secret inside a secret is fine if it is short.
- The spine is never a corridor for more than 20 m at a time. Corridors
  are joins, not content.

Why: the audience is 10+, many will play on a school laptop with a small
screen, and a maze reads as "lost" before it reads as "clever".

## 2. Pillars (six rules a builder can check)

Each rule has a check, not a vibe.

1. **The goal is visible from the arena exit.** Check: stand at the point
   the arena's lock releases. The next door, lift, or bright space must be
   in the view frustum within 30 degrees of forward, and no further than
   35 m (Foamer sight is 20 m, so at 35 m the goal is a shape, not a
   target).
2. **One way on, and it is not the way you came in.** Check: the arena
   has exactly two openings on the critical path, and its door frame faces
   the exit. Players should never walk back through the fight they just
   finished to find the way on.
3. **Every fight is entered by choice or by a door you can see close.**
   Check: the lock trigger is 6 to 10 m inside the arena, past the first
   piece of cover, so the player is standing in the space when it seals.
4. **One new thing per level, taught by a space, not a text box.** Check:
   the new mechanic is used once in a safe pocket where failing costs
   nothing, then once under pressure.
5. **The floor is a tool.** Check: every arena has at least two heights,
   and the height difference is 1.2 m (a jump), 1.5 m (a mantle, the
   player's limit) or 3 to 4 m (a drop you can take and a stair you can
   climb back up).
6. **Destruction changes the route, not just the look.** Check: each
   arena has one destructible piece on the critical path (a plug or a
   wall), and one optional destructible that opens a shortcut or a secret.

Two more that are easy to break, so they get their own line:

7. **No dead ends longer than 15 m off the spine.** Check: measure the
   walk from the spine to the end of the side room. A secret is a 5 to 15
   m detour, not a wing.
8. **Nothing the player cannot solve with the kit they have.** There is
   no crouch and no double jump. Check: every gap is 6.5 m or less (a
   sprint jump), or has a dash pad of 9 m, and every ledge is 1.5 m or
   less, or has a step.

## 3. The rhythm of a level

A 15 to 20 minute level is 8 to 10 beats. The order below is the default.
Vary it once per act, not once per level.

| Beat | How many | Length | What happens |
|---|---|---|---|
| Open | 1 | 1 to 2 min | No combat or one easy kill. Blaster in hand, one landmark in view |
| Explore 1 | 1 | 1.5 min | Corridor plus one side room. First secret hint |
| Arena 1 | 1 | 2 min | Teaches the level's new thing in a low-pressure wave |
| Breather | 1 | 1 min | Station, ammo, a sight line back over what was cleared |
| Arena 2 | 1 | 2.5 min | New thing combined with an older one |
| Set piece | 1 | 1.5 min | The signature space: the tower climb, the bridge, the drop |
| Arena 3 | 1 | 2.5 min | Highest pressure before the gauntlet. Mid-level mini-boss lives here or in Arena 4 |
| Breather 2 | 1 | 1 min | Ammo cache, station, last secret window |
| Gauntlet | 1 | 3 min | Two waves back to back, no lock release between them, ammo on the floor |
| Exit | 1 | 0.5 min | Door, lift or drop. Nothing to fight |

Total: 17 to 19 minutes at Normal. A player who hunts secrets adds 3 to 5
minutes. A player who runs past fights saves 2 to 3.

**Time comes from walking, not from wave size.** At walk speed 7 m/s a
40 m arena crossing is under 6 seconds. A wave of 6 Slowmers takes 25 to
40 seconds to clear. So a 2 minute arena is 1 wave of 6 plus a wave of 8,
not one wave of 14. More than 12 Foamers alive at once (KIT.md 6) fights the
director (2 melee tokens at Normal) and the 64 agent cap, and reads as
mush on a small screen.

### Where the pieces go

- **Secrets:** 2 to 3 per level, one per third of the level. Never in the
  arena you are locked into: a secret found during a lock-in is lost if
  the player dies. Put secrets in explores and breathers.
- **Upgrade stations (U, D07):** one after Arena 1 and one before the
  gauntlet. A station is a 2 m alcove off the spine, lit, with the player
  facing it as they walk past. It is the level's save point, so it must
  never sit inside an arena.
- **Ammo (A, D08):** placed, never random. Three fixed jobs: first find of
  a new blaster (a full reserve beside the pickup), the floor of every
  gauntlet (two caches, one at each end, so a player who backs up is not
  stranded), and one cache per arena on the side the player enters from.
  No ammo in secrets unless the secret is ammo itself.
- **New blaster pickup:** in the Open beat or at the end of Explore 1,
  never mid-arena. The player gets 20 to 30 seconds of empty space to try
  it before anything shoots back.
- **Foam rifts (R):** the wave spawn. A rift is a 2.5 m glowing seam in a
  wall, floor or ceiling, placed in the third of the arena furthest from
  the door the player entered by. Rifts are visible before the lock so
  the player learns the room's shape; they open when the lock closes.
  Every wave needs its own rift or set of rifts, and two rifts 12 m apart
  are better than one, so Foamers arrive from two directions.

## 4. Wayfinding rules

1. **Light is the arrow.** The critical path is the brightest surface in
   the room. Side rooms are dimmer, secrets are a single colour accent.
2. **One accent colour means "this way on".** Pick it per act and never
   use it for anything else, including enemies. [Paul] picks the colour.
   The parry pink is reserved and must not be used.
3. **Open doors are holes with light behind them. Closed doors are solid
   and dark.** A door that unlocks changes both: the panel slides and the
   light behind it comes on.
4. **The next goal gets a silhouette, not a sign.** A lift shaft, a
   bridge, a lit doorway, a big prop. Children read shape before text.
   Any text is a second cue, never the first.
5. **Lock-in is loud and visible.** The door shuts with a sound and a
   colour pulse, and the rifts glow. Never seal a player without showing
   where the Foamers come from.
6. **Arena exits are on the far wall, opposite the entrance, and lower or
   brighter.** One glance from the middle of the fight tells you where
   the fight ends.
7. **No same-looking doors on the spine.** Every critical door is a
   different width or colour from the secret doors near it.
8. **Vertical routes are lit from below.** A climbable ledge or a ladder
   gets an uplight so it reads as "up" from a distance.
9. **The way back is never the way on.** If a player turns around, the
   room behind is darker and quieter than the room ahead. This is the
   cheapest cue in the game and the one that stops backtracking.
10. **Nothing on the critical path can be destroyed into an unwinnable
    state.** A plug can block the path; a load-bearing wall that is part
    of the shell cannot. Floors on the spine are shell meshes, never
    voxel chunks.
