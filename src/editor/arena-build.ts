import type { Level, Trigger, TriggerDo } from "../level/format";
import { EDITOR } from "./doc";

// ED-08 stage 4: the usual fight, built as ordinary triggers:
//
//   enter the zone:  show the blockers, close the doors when locked,
//                    spawn wave 1 (or an after trigger of the lock runs it)
//   wave k all dead: spawn wave k + 1 (or an after trigger of that start)
//   every wave dead: hide the blockers, open the doors when unlocked
//
// No message text is written here: the words are Paul's, so a level that
// wants a line adds it in the inspector.

/** One wave as the Arena dialog holds it. */
export interface ArenaWaveSpec {
  /** A rig id (data/foamer-rigs.json). */
  foamer: string;
  count: number;
  /** Spawned as promoted Foamers. */
  promoted?: boolean;
  /** Seconds between one Foamer of the wave arriving and the next. */
  holdSeconds?: number;
  /** Seconds after the previous wave clears (after the lock for wave 1)
   *  before this wave starts. 0 starts it straight away. */
  delaySeconds?: number;
}

/** What the Arena dialog asks for, as ids and waves. */
export interface ArenaSpec {
  /** The zone whose entry starts the fight (a zone id). */
  zone: string;
  /** Prims that come in as the fight starts and go when it is won. */
  blockers: string[];
  /** Spawn points the waves come in at, in turn. */
  spawnPoints: string[];
  /** Each wave: a rig id, how many, and how it arrives. */
  waves: ArenaWaveSpec[];
  /** Doors closed when the fight starts (when `lockDoors`) and opened when
   *  it is won (when `unlockOnClear`). */
  doors: string[];
  /** Close the picked doors at the fight's start. */
  lockDoors?: boolean;
  /** Open the picked doors at the fight's clear. The default is true. */
  unlockOnClear?: boolean;
}

const ARENA = EDITOR.arena;

/** Why a spec cannot be built, or null when it can. The dialog shows this
 *  rather than building triggers validateLevel would reject. */
export function arenaProblem(spec: ArenaSpec): string | null {
  if (!spec.zone) return "Select a zone first: the fight starts when the player enters it.";
  if (!spec.waves.length) return "Add at least one wave.";
  if (!spec.spawnPoints.length) return "Tick at least one spawn point: a wave needs somewhere to come in.";
  if (spec.waves.some((w) => !w.foamer || !(w.count >= 1))) return "Every wave needs a Foamer and a count of one or more.";
  if (spec.waves.some((w) => w.holdSeconds !== undefined && (!Number.isFinite(w.holdSeconds) || w.holdSeconds < 0))) return "Every wave's hold seconds must be 0 or more.";
  if (spec.waves.some((w) => w.delaySeconds !== undefined && (!Number.isFinite(w.delaySeconds) || w.delaySeconds < 0))) return "Every wave's delay seconds must be 0 or more.";
  return null;
}

/** The spawn action for one wave. */
function spawnDo(wave: ArenaWaveSpec, id: string, spawnPoints: string[]): TriggerDo {
  return {
    kind: "spawn",
    id,
    foamer: wave.foamer,
    count: Math.max(1, Math.round(wave.count)),
    at: [...spawnPoints],
    holdSeconds: wave.holdSeconds !== undefined ? Math.max(0, wave.holdSeconds) : ARENA.holdSeconds,
    ...(wave.promoted ? { promoted: true } : {}),
  };
}

/** The triggers for one arena, in the order the fight happens. `nextId` gives
 *  fresh ids out of the level's own id space, so nothing collides with what is
 *  already there (a spawn action's id is an id too: a killed condition counts
 *  Foamers by it). */
export function buildArena(spec: ArenaSpec, nextId: (prefix: string) => string): Trigger[] {
  if (arenaProblem(spec)) return [];
  const triggers: Trigger[] = [];

  // Each wave is pre-allocated, the way ED-08 stage 4 did: its trigger and its
  // spawn id are ids too, so nothing collides with what is already there.
  const waves = spec.waves.map((wave) => ({
    wave,
    trigger: nextId("arena-wave"),
    spawn: nextId("wave"),
  }));
  const lockId = nextId("arena-lock");

  // Wave 1 comes in when the player enters. Its delay runs off the lock
  // trigger through an `after`, the same shape arena-to-triggers uses.
  const first = waves[0]!;
  const firstDelay = (first.wave.delaySeconds ?? 0);
  const lockDo: TriggerDo[] = [
    ...(spec.blockers.length ? [{ kind: "show" as const, ids: [...spec.blockers] }] : []),
    ...(spec.lockDoors ? spec.doors.map((door) => ({ kind: "close" as const, door }) as TriggerDo) : []),
  ];
  if (firstDelay <= 0) {
    lockDo.push(spawnDo(first.wave, first.spawn, spec.spawnPoints));
  }
  triggers.push({
    id: lockId,
    when: { kind: "enter", zone: spec.zone },
    do: lockDo,
  });
  if (firstDelay > 0) {
    triggers.push({
      id: nextId("arena-wave"),
      when: { kind: "after", trigger: lockId, seconds: firstDelay },
      do: [spawnDo(first.wave, first.spawn, spec.spawnPoints)],
    });
  }

  for (let i = 1; i < waves.length; i++) {
    const { wave, trigger, spawn } = waves[i]!;
    const prev = waves[i - 1]!.spawn;
    const delay = wave.delaySeconds ?? 0;
    if (delay > 0) {
      triggers.push({
        id: trigger,
        when: { kind: "killed", ids: [prev] },
        do: [],
      });
      triggers.push({
        id: nextId("arena-wave"),
        when: { kind: "after", trigger: trigger, seconds: delay },
        do: [spawnDo(wave, spawn, spec.spawnPoints)],
      });
    } else {
      triggers.push({
        id: trigger,
        when: { kind: "killed", ids: [prev] },
        do: [spawnDo(wave, spawn, spec.spawnPoints)],
      });
    }
  }

  // Winning does something only when there is a blocker to take away or a
  // door to open; with neither (and unlocked doors), the clear trigger would
  // have an empty do, which a level rejects, so it is left out.
  const reply: TriggerDo[] = [
    ...(spec.blockers.length ? [{ kind: "hide" as const, ids: [...spec.blockers] }] : []),
    ...(spec.unlockOnClear === false ? [] : spec.doors.map((door) => ({ kind: "open" as const, door }) as TriggerDo)),
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
