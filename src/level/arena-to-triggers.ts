// ED-07c: turn an arena block (a trigger box, doors, rifts, waves,
// `unlockOnClear`) into the editor's when/do parts. The Act 1 levels
// describe their fights with `arenas`; the editor scripts fights with
// triggers, spawn points and doors. This is the bridge: it turns one
// into the other so Paul can open an Act 1 level in the editor and
// rework it.
//
// Plain data: no Three.js, no DOM, no Math.random. It is tested
// headless against the types in src/level/format.ts.

import type {
  Level,
  LevelDoor,
  Trigger,
  TriggerDo,
  Vec3,
  Wave,
  WaveSpawn,
  Zone,
} from "./format";

export interface ArenaConversion {
  level: Level;
  warnings: string[];
}

interface SpawnInfo {
  wave: Wave;
  /** Ids of the spawn actions this wave's triggers own, one per spawn. */
  spawnIds: string[];
}

function spawnDo(info: SpawnInfo, s: WaveSpawn, idx: number): TriggerDo {
  return {
    kind: "spawn",
    id: info.spawnIds[idx]!,
    foamer: s.foamer,
    count: s.count,
    at: info.wave.rifts,
    holdSeconds: info.wave.holdSeconds,
    promoted: s.promoted,
  };
}

/**
 * Turns every arena into editor parts. The input is not changed; a new
 * level object with `arenas` emptied is returned, the parts appended to
 * any existing zones, doors, spawn points and triggers.
 *
 * One arena named `a` with waves `w1`, `w2` becomes:
 *
 *   zone `a-zone`, the arena's trigger box;
 *   a `LevelDoor` per arena door (state "open": lock "none", "locked"
 *     and "sealed": lock "trigger");
 *   a spawn point per rift, same id, pos and facing;
 *   `a-lock`: when enter `a-zone`, close every door that started open
 *     (skipped when `noLock`), do the checkpoint (yaw 0) when
 *     `checkpoint` and `checkpointPos` are set, then run wave 1:
 *     directly, or through `w1-after` (an `after` on `a-lock`) when
 *     wave 1's `delaySeconds` is above 0;
 *   `wk-start` (k > 1): when `killed` all of the previous wave's
 *     spawn ids; runs wave k directly when its `delaySeconds` is 0,
 *     otherwise `wk-after` (an `after` on the start) runs it;
 *   `a-clear`: when `killed` all of the last wave's spawn ids, open
 *     every door in `unlockOnClear`. A wave's spawn ids, one per
 *     `spawns` entry, are `<wave id>-0`, `-1`, and so on.
 *
 * What it cannot express goes into `warnings` as a short string:
 *   - a wave's `startsWithHealthShare` (the wave still starts on
 *     "cleared"; the share is dropped);
 *   - an arena's `escape` (not converted at all);
 *   - a `noLock` arena's wave 1 delay (dropped, because the lock
 *     trigger would have no other do to run).
 */
export function arenaToTriggers(level: Level): ArenaConversion {
  const warnings: string[] = [];
  const zones: Zone[] = [];
  const doors: LevelDoor[] = [];
  const spawnPoints: { id: string; pos: Vec3; facing: Vec3 }[] = [];
  const triggers: Trigger[] = [];

  for (const arena of level.arenas ?? []) {
    const zone: Zone = {
      id: `${arena.id}-zone`,
      pos: arena.trigger.pos,
      size: arena.trigger.size,
    };
    zones.push(zone);

    for (const door of arena.doors) {
      doors.push({
        id: door.id,
        pos: door.pos,
        size: door.size,
        lock: door.state === "open" ? "none" : "trigger",
      });
    }

    for (const rift of arena.rifts) {
      spawnPoints.push({ id: rift.id, pos: rift.pos, facing: rift.facing });
    }

    if (arena.escape) {
      warnings.push(`arena ${arena.id}: escape is not converted`);
    }

    const infos = arena.waves.map((wave) => {
      const info: SpawnInfo = {
        wave,
        spawnIds: wave.spawns.map((_, i) => `${wave.id}-${i}`),
      };
      if (wave.startsWithHealthShare !== undefined) {
        warnings.push(`arena ${arena.id} wave ${wave.id}: startsWithHealthShare is dropped`);
      }
      return info;
    });

    const lockId = `${arena.id}-lock`;
    const lockDo: TriggerDo[] = [];
    if (arena.checkpoint && arena.checkpointPos) {
      lockDo.push({ kind: "checkpoint", pos: arena.checkpointPos, yaw: 0 });
    }
    if (!arena.noLock) {
      for (const door of arena.doors) {
        if (door.state === "open") lockDo.push({ kind: "close", door: door.id });
      }
    }

    const first = infos[0];
    if (first && arena.noLock && first.wave.delaySeconds > 0) {
      // No lock to arm an `after` from: the delay is dropped.
      warnings.push(`arena ${arena.id}: noLock drops wave ${first.wave.id} delay of ${first.wave.delaySeconds}`);
    }

    for (let k = 0; k < infos.length; k++) {
      const info = infos[k]!;
      const wave = info.wave;
      const spawns = wave.spawns.map((s, i) => spawnDo(info, s, i));

      if (k === 0) {
        // Wave 1 lives in the lock trigger, or in an `after` on it.
        if (!arena.noLock && wave.delaySeconds > 0) {
          triggers.push({
            id: `${wave.id}-after`,
            when: { kind: "after", trigger: lockId, seconds: wave.delaySeconds },
            do: spawns,
          });
        } else {
          lockDo.push(...spawns);
        }
        continue;
      }

      const prev = infos[k - 1]!;
      if (wave.delaySeconds === 0) {
        triggers.push({
          id: `${wave.id}-start`,
          when: { kind: "killed", ids: prev.spawnIds },
          do: spawns,
        });
      } else {
        triggers.push({
          id: `${wave.id}-start`,
          when: { kind: "killed", ids: prev.spawnIds },
          // Review: a trigger that only starts an `after` timer has an
          // empty do; the validator accepts that when an `after` waits on
          // it (no placeholder banner in play).
          do: [],
        });
        triggers.push({
          id: `${wave.id}-after`,
          when: { kind: "after", trigger: `${wave.id}-start`, seconds: wave.delaySeconds },
          do: spawns,
        });
      }
    }

    const last = infos[infos.length - 1];
    if (last && arena.unlockOnClear.length > 0) {
      triggers.push({
        id: `${arena.id}-clear`,
        when: { kind: "killed", ids: last.spawnIds },
        do: arena.unlockOnClear.map((d) => ({ kind: "open" as const, door: d })),
      });
    }

    // Review: an arena that does nothing on entry (no waves, no lock: a
    // door a button opens) needs no trigger; one that only starts a
    // timer keeps its empty do, which the validator accepts.
    const timed = triggers.some((t) => t.when.kind === "after" && t.when.trigger === lockId);
    if (lockDo.length > 0 || timed) {
      triggers.push({ id: lockId, when: { kind: "enter", zone: zone.id }, do: lockDo });
    }
  }

  const level2: Level = {
    ...level,
    arenas: [],
    zones: [...(level.zones ?? []), ...zones],
    doors: [...(level.doors ?? []), ...doors],
    spawnPoints: [...(level.spawnPoints ?? []), ...spawnPoints],
    triggers: [...(level.triggers ?? []), ...triggers],
  };

  return { level: level2, warnings };
}
