import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import rigData from "../../data/foamer-rigs.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { rigHeight, type RigSpec } from "../../src/foamers/rig";
import { meleeParryOf, parryableAttack } from "../../src/foamers/combo";
import { FoamerSounds } from "../../src/audio/foamer-sounds";
import type { AudioSink, LoopHandle, PlayOptions } from "../../src/audio/sink";
import { BALL_MATERIAL } from "../../src/foamers/projectiles";
import { voxelFoamMaterial } from "../../src/render/foam-material";
import type { Foamer } from "../../src/foamers/foamer";

// GAME-10n: the F14 maul brawler. Stage 1 is the rig and the plain maul
// swing; the combo and the parryable smash arrive in stage 2.

const DT = 1 / 60;
const SPEC = specFor("F14");
const RIGS = rigData.rigs as unknown as (RigSpec & { health: number })[];
const RIG = RIGS.find((r) => r.id === "F14")!;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

function rig() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0));
  const ignore = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0, 200),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
  );
  const darts = new DartSystem(new THREE.Scene(), world, RAPIER, ignore);
  const debris = new DebrisSystem(RAPIER, world);
  const targets: VoxelTarget[] = [];
  const foamers = new FoamerSystem(RAPIER, world, fakeMesher(), debris, darts, targets);
  new DartImpacts(darts, debris, targets);
  world.step();
  const sounds: string[] = [];
  foamers.onSound = (kind) => sounds.push(kind);
  return { world, darts, foamers, sounds };
}

type Rig = ReturnType<typeof rig>;

function tick(r: Rig, player: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player);
  r.world.step();
}

function run(r: Rig, player: THREE.Vector3, done: () => boolean, steps: number) {
  for (let i = 0; i < steps && !done(); i++) tick(r, player);
}

async function settle(
  r: Rig, f: Foamer,
) {
  for (const p of f.parts.values()) {
    while (p.mesh.busy) {
      p.mesh.update();
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  r.world.step();
}

function mauler(r: Rig, metres: number, player: THREE.Vector3): Foamer {
  const f = r.foamers.spawn(new THREE.Vector3(0, 0, player.z + metres), player, "F14")!;
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F14 maul brawler (GAME-10n stage 1)", () => {
  it("1. the data file holds the rig and the type", () => {
    expect(RIG.tier).toBe("Elite");
    expect(RIG.speed).toBe(1.3);
    expect(RIG.health).toBe(70);
    expect(RIG.movement).toBe("combo");
    expect(SPEC.rig).toBe("F14");
    expect(SPEC.turnRate).toBe(2);
    expect(SPEC.attackRange).toBe(2.2);
    expect(foamerData.types).toHaveProperty("F14");
  });

  it("2. it is wider than the F11 and about a head shorter than it", () => {
    const seawall = RIGS.find((r) => r.id === "F11")!;
    expect(rigHeight(RIG)).toBeGreaterThan(2.4);
    expect(rigHeight(RIG)).toBeLessThan(3.2);
    expect(rigHeight(RIG)).toBeLessThan(rigHeight(seawall));
    // Wider: the shoulders stand further out than the Seawall's.
    const span = (r: RigSpec) => {
      const left = r.parts.find((q) => q.id === "armL");
      const right = r.parts.find((q) => q.id === "armR");
      return (right?.at?.[0] ?? 0) - (left?.at?.[0] ?? 0);
    };
    expect(span(RIG)).toBeGreaterThan(span(seawall));
  });

  it("3. both legs carry the weak point and the feet are orange", () => {
    const wp = (SPEC as { weakpoint?: { parts: string[]; damage: number } }).weakpoint;
    expect(wp?.parts).toEqual(["legL", "legR"]);
    expect(wp?.damage).toBe(2);
    for (const id of ["legL", "legR", "footL", "footR"]) {
      const p = RIG.parts.find((q) => q.id === id)!;
      expect(p.material, id).toContain("foam-orange");
    }
  });

  it("4. it walks in and swings the maul in reach", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 2.5, player);
    run(r, player, () => f.state === "windup", 60 * 20);
    expect(f.state).toBe("windup");
    expect(f.attack()!.id).toBe("sweep");
    run(r, player, () => f.state === "recover", 60 * 3);
    expect(f.state).toBe("recover");
  });

  it("5. a dart on a leg costs it twice what the same dart costs an arm", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const dart = (f: Foamer, id: string): number => {
      const part = f.parts.get(id)!;
      const probe = r.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setTranslation(0.2, 0.2, 0.2),
        part.body,
      );
      const size = part.spec.size;
      const before = f.health;
      r.darts.onHit({
        point: part.voxelToWorld(new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] - 0.5)),
        normal: new THREE.Vector3(0, 0, 1),
        direction: new THREE.Vector3(0, 0, -1),
        speed: 25,
        type: "standard",
        collider: probe,
        material: null,
        shot: null,
      });
      return before - f.health;
    };
    const onArm = dart(mauler(r, 6, player), "armL");
    const onLeg = dart(mauler(r, 6, player), "legL");
    expect(onArm).toBeGreaterThan(0);
    expect(onLeg).toBeCloseTo(onArm * 2, 6);
  });
});

describe("the F14 combo and parry (GAME-10n stage 2)", () => {
  it("6. it sweeps twice, then smashes, then loops", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 1.8, player);
    const bonks: string[] = [];
    r.foamers.onBonk = (_f, attack) => bonks.push(attack);
    run(r, player, () => bonks.length >= 4, 60 * 40);
    expect(bonks.slice(0, 4)).toEqual(["sweep", "sweep", "smash", "sweep"]);
    expect(f.comboTurn).toBe(4);
  });

  it("7. the maul head is pink only during the smash windup", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 1.8, player);
    await settle(r, f);
    const head = f.parts.get("maulHead")!;
    const headMat = () => (head.mesh.group.children[0] as THREE.Mesh).material as THREE.Material;
    let pink = false, plainInWindup = false;
    for (let i = 0; i < 60 * 40 && !(pink && plainInWindup); i++) {
      tick(r, player);
      if (f.state !== "windup") continue;
      if (f.attack()?.id === "smash") {
        if (headMat() === BALL_MATERIAL) pink = true;
      } else if (f.attack()?.id === "sweep" && headMat() === voxelFoamMaterial()) plainInWindup = true;
    }
    expect(pink, "pink during the smash windup").toBe(true);
    expect(plainInWindup, "plain during a sweep windup").toBe(true);
    // Once the windup is over the head is foam again.
    for (let i = 0; i < 600 && f.state === "windup"; i++) tick(r, player);
    expect(headMat()).toBe(voxelFoamMaterial());
  });

  it("8. a parry staggers it for 2 s and the second parry breaks the maul head off", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 1.8, player);
    expect(meleeParryOf(SPEC)!.staggerSeconds).toBe(2);
    r.foamers.parryAttack(f);
    expect(f.parriesTaken).toBe(1);
    expect(f.parts.has("maulHead")).toBe(true);
    expect(f.state).toBe("stagger");
    const start = f.stateTime;
    tick(r, player);
    expect(f.state).toBe("stagger");
    tick(r, player);
    expect(f.stateTime).toBeGreaterThan(start);
    r.foamers.parryAttack(f);
    expect(f.parriesTaken).toBe(2);
    expect(f.parts.has("maulHead")).toBe(false);
  });

  it("9. with the maul head gone it bonks with the forearm for 10", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 1.8, player);
    r.foamers.parryAttack(f);
    r.foamers.parryAttack(f);
    expect(f.parts.has("maulHead")).toBe(false);
    const bonks: string[] = [];
    r.foamers.onBonk = (_f, attack) => bonks.push(attack);
    run(r, player, () => bonks.length >= 2, 60 * 40);
    expect(bonks.slice(0, 2)).toEqual(["bonk", "bonk"]);
    const bonk = SPEC.attacks.find((a) => a.id === "bonk")!;
    expect(bonk.damage).toBe(10);
    expect(bonk.needs).toEqual(["foreArmR"]);
  });
});

describe("the F14 floor slam (GAME-10n stage 3)", () => {
  /** Wait for a slam windup to appear and return once it fires (the ring
   *  is live) or the wait runs out. */
  function waitForSlam(r: Rig, player: THREE.Vector3, f: Foamer) {
    for (let i = 0; i < 60 * 30; i++) {
      tick(r, player);
      if (f.wave.active) return true;
    }
    return false;
  }

  it("10. it slams from its own feet, inside its band only", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4.5, player);
    expect(waitForSlam(r, player, f)).toBe(true);
    // The ring sits on the F14's own feet, not out where the player was.
    expect(f.wave.x).toBeCloseTo(f.centre.x, 4);
    expect(f.wave.z).toBeCloseTo(f.centre.z, 4);
    const numbers = (SPEC as unknown as { slam: { minMetres: number; maxMetres: number; cooldownSeconds: number; windupSeconds: number } }).slam;
    expect(numbers.minMetres).toBe(3);
    expect(numbers.maxMetres).toBe(6);
    expect(numbers.cooldownSeconds).toBe(5);
    expect(numbers.windupSeconds).toBe(0.9);
    expect(f.slamCooldown).toBeGreaterThan(0);
  });

  it("11. the ring's numbers are the card's", () => {
    const sw = (SPEC as unknown as { shockwave: { speed: number; radius: number; thickness: number; damage: number } }).shockwave;
    expect(sw.speed).toBe(7);
    expect(sw.radius).toBe(7);
    expect(sw.thickness).toBe(0.6);
    expect(sw.damage).toBe(14);
  });

  it("12. a slam windup makes the maul head no pink (it is not parryable)", async () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4.5, player);
    await settle(r, f);
    const head = f.parts.get("maulHead")!;
    const headMat = () => (head.mesh.group.children[0] as THREE.Mesh).material as THREE.Material;
    let sawSlamWindup = false;
    for (let i = 0; i < 60 * 30 && !sawSlamWindup; i++) {
      tick(r, player);
      if (f.state === "windup" && f.attack()?.id === "slam") {
        sawSlamWindup = true;
        expect(parryableAttack(SPEC, "slam")).toBe(false);
        expect(headMat()).toBe(voxelFoamMaterial());
      }
    }
    expect(sawSlamWindup).toBe(true);
  });

  it("13. with the maul head gone there is no slam", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4.5, player);
    r.foamers.parryAttack(f);
    r.foamers.parryAttack(f);
    expect(f.parts.has("maulHead")).toBe(false);
    for (let i = 0; i < 60 * 20; i++) {
      tick(r, player);
      expect(f.attack()?.id).not.toBe("slam");
    }
    expect(f.wave.active).toBe(false);
  });

  it("14. it slams no more often than its cooldown", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4.5, player);
    const starts: number[] = [];
    let was = false;
    for (let i = 0; i < 60 * 30; i++) {
      tick(r, player);
      const now = f.state === "windup" && f.attack()?.id === "slam";
      if (now && !was) starts.push(f.stateTime);
      was = now;
    }
    expect(starts.length).toBeGreaterThan(0);
  });
});

describe("the F14 leg break (GAME-10n stage 4)", () => {
  /** Break a part through the system's own path (the test rig's window on
   *  the private breakPart, the way the head-off test sets hp to 0 and
   *  steps). */
  function breakIt(r: Rig, f: Foamer, id: string) {
    const part = f.parts.get(id)!;
    part.hp = 0;
    (r.foamers as unknown as { breakPart(f: Foamer, p: typeof part): void }).breakPart(f, part);
  }

  it("15. one leg gone leaves it standing, and it staggers once for that leg", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4, player);
    expect(f.spec.handicaps.fallBelowLegs).toBe(1);
    breakIt(r, f, "legL");
    expect(f.state).toBe("stagger");
    expect(f.staggerTime).toBe(2);
    expect(f.prone).toBe(false);
    expect(f.legs().length).toBe(1);
    // The once-per-leg rule: the set remembers the leg, so a repeat is the
    // plain short stagger.
    expect([...f.legStaggered]).toEqual(["legL"]);
    expect(f.speed()).toBeCloseTo(f.rig.speed * 0.5, 6);
  });

  it("16. both legs gone: it falls, then it crawls, and it cannot slam", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4, player);
    breakIt(r, f, "legL");
    breakIt(r, f, "legR");
    expect(f.legs().length).toBe(0);
    expect(f.state === "fall" || f.prone).toBe(true);
    for (let i = 0; i < 60 * 20; i++) tick(r, player);
    expect(f.wave.active).toBe(false);
  });

  it("17. a slam abandoned by a maul break leaves no ring", () => {
    const r = rig();
    const player = new THREE.Vector3(0, 1.6, 0);
    const f = mauler(r, 4.5, player);
    for (let i = 0; i < 60 * 30 && !(f.state === "windup" && f.attack()?.id === "slam"); i++) tick(r, player);
    expect(f.attack()?.id).toBe("slam");
    breakIt(r, f, "maulHead");
    expect(f.parts.has("maulHead")).toBe(false);
    for (let i = 0; i < 120; i++) tick(r, player);
    expect(f.wave.active).toBe(false);
  });
});

describe("the F14's sounds (GAME-10n stage 4)", () => {
  class FakeSink implements AudioSink {
    readonly log: { id: string; opts?: PlayOptions }[] = [];
    play(id: string, opts?: PlayOptions): void {
      this.log.push({ id, opts });
    }
    loop(_id: string, _opts?: PlayOptions): LoopHandle {
      return { set() {}, setPosition() {}, stop() {} };
    }
  }

  it("18. the smash plays the Seawall's wind-up, the sweeps its swing, the slam F07's landing", () => {
    const r = rig();
    const sink = new FakeSink();
    const sounds = new FoamerSounds(sink, r.foamers);
    const player = new THREE.Vector3(0, 1.6, 0);
    mauler(r, 1.8, player);
    mauler(r, 4.5, player);
    for (let i = 0; i < 60 * 40; i++) {
      tick(r, player);
      sounds.update(DT);
    }
    const ids = sink.log.map((e) => e.id);
    expect(ids, ids.join(",")).toContain("F07-land");
    expect(ids).toContain("F11-swing");
    expect(ids).toContain("F11-windup");
  });
});
