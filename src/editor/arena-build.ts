import type { Level, Trigger } from "../level/format";
import { EDITOR } from "./doc";

// ED-08 stage 4: the usual fight, built as three or more ordinary triggers,
// the same shape data/levels/ed-07.json uses by hand:
//
//   enter the zone:  show the blockers, spawn wave 1
//   wave 1 all dead: spawn wave 2        (one trigger per further wave)
//   every wave dead: hide the blockers, open the doors picked
//
// No message text is written here: the words are Paul's, so a level that
// wants a line adds it in the inspector.

/** What the Arena dialog asks for, as ids and waves. */
export interface ArenaSpec {
  /** The zone whose entry starts the fight (a zone id). */
  zone: string;
  /** Prims that come in as the fight starts and go when it is won. */
  blockers: string[];
  /** Spawn points the waves come in at, in turn. */
  spawnPoints: string[];
  /** Each wave: a rig id (data/foamer-rigs.json) and how many. */
  waves: { foamer: string; count: number }[];
  /** Doors opened when the last wave is down. */
  doors: string[];
}

const ARENA = EDITOR.arena;

/** Why a spec cannot be built, or null when it can. The dialog shows this
 *  rather than building triggers validateLevel would reject. */
export function arenaProblem(spec: ArenaSpec): string | null {
  if (!spec.zone) return "Select a zone first: the fight starts when the player enters it.";
  if (!spec.waves.length) return "Add at least one wave.";
  if (!spec.spawnPoints.length) return "Tick at least one spawn point: a wave needs somewhere to come in.";
  if (spec.waves.some((w) => !w.foamer || !(w.count >= 1))) return "Every wave needs a Foamer and a count of one or more.";
  return null;
}

/** The triggers for one arena, in the order the fight happens. `nextId` gives
 *  fresh ids out of the level's own id space, so nothing collides with what is
 *  already there (a spawn action's id is an id too: a killed condition counts
 *  Foamers by it). */
export function buildArena(spec: ArenaSpec, nextId: (prefix: string) => string): Trigger[] {
  if (arenaProblem(spec)) return [];
  const triggers: Trigger[] = [];

  // Wave 1 comes in when the player enters; each later wave when the one
  // before it is down, so the fight is paced and cannot be rushed past.
  const waves = spec.waves.map((wave) => ({
    trigger: nextId("arena-wave"),
    spawn: nextId("wave"),
    foamer: wave.foamer,
    count: Math.max(1, Math.round(wave.count)),
  }));

  const lock: Trigger = {
    id: nextId("arena-lock"),
    when: { kind: "enter", zone: spec.zone },
    do: [
      ...(spec.blockers.length ? [{ kind: "show" as const, ids: [...spec.blockers] }] : []),
      {
        kind: "spawn", id: waves[0]!.spawn, foamer: waves[0]!.foamer, count: waves[0]!.count,
        at: [...spec.spawnPoints], holdSeconds: ARENA.holdSeconds,
      },
    ],
  };
  triggers.push(lock);

  for (let i = 1; i < waves.length; i++) {
    triggers.push({
      id: waves[i]!.trigger,
      when: { kind: "killed", ids: [waves[i - 1]!.spawn] },
      do: [{
        kind: "spawn", id: waves[i]!.spawn, foamer: waves[i]!.foamer, count: waves[i]!.count,
        at: [...spec.spawnPoints], holdSeconds: ARENA.holdSeconds,
      }],
    });
  }

  // Winning does something only when there are blockers to take away or a door
  // to open; with neither, the clear trigger would have an empty do, which a
  // level rejects, so it is left out.
  const reply = [
    ...(spec.blockers.length ? [{ kind: "hide" as const, ids: [...spec.blockers] }] : []),
    ...spec.doors.map((door) => ({ kind: "open" as const, door })),
  ];
  if (reply.length) {
    triggers.push({
      id: nextId("arena-clear"),
      when: { kind: "killed", ids: waves.map((w) => w.spawn) },
      do: reply,
    });
  }

  return triggers;
}

/** The blockers a level already offers the builder: prims that start hidden
 *  are the ones a fight brings in (design/EDITOR.md 3). */
export function blockerChoices(level: Level): { id: string; label: string }[] {
  return (level.prims ?? []).map((p) => ({
    id: p.id,
    label: `${p.id} (${p.shape}${p.hidden ? ", hidden" : ""})`,
  }));
}
