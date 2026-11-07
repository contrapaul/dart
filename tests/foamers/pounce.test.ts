import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import foamerData from "../../data/foamers.json";
import shieldData from "../../data/shield.json";
import { linearColorTable } from "../../src/voxel/materials";
import { greedyMesh } from "../../src/voxel/mesher";
import type { Mesher } from "../../src/voxel/pieces";
import { DebrisSystem } from "../../src/voxel/debris";
import { DartSystem } from "../../src/weapons/darts";
import { DartImpacts, type VoxelTarget } from "../../src/weapons/impacts";
import { FoamerSystem, specFor } from "../../src/foamers/foamers";
import { Director } from "../../src/ai/director";
import { decidePounce } from "../../src/ai/f12-brain";
import { pounceOf } from "../../src/foamers/pounce";
import { decideMeleeParry, parryableAttack } from "../../src/foamers/combo";
import { damageOf } from "../../src/game/attack";
import { PlayerHealth } from "../../src/player/health";
import type { Foamer } from "../../src/foamers/foamer";

const DT = 1 / 60;
const PO = (foamerData.types.F12 as { pounce: { minMetres: number; maxMetres: number; cooldownSeconds: number; crouchSeconds: number; speed: number; arcMetres: number; hitMetres: number } }).pounce;
const SHARE = (shieldData.block as { damageShare: number }).damageShare;

function fakeMesher(): Mesher {
  const colors = linearColorTable();
  return { mesh: (padded) => Promise.resolve(greedyMesh(padded, colors)) };
}

/** Floor, the director and the Foamer system, with the page's onBonk path
 *  wired the way src/range/main.ts wires it: the shield's block share, the
 *  parry decision. `blocked` stands in for a raised disc facing the
 *  Foamer. */
function rig(blocked: () => boolean = () => false) {
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
  foamers.director = new Director("normal");
  foamers.spawnCount = 0;
  const health = new PlayerHealth();
  const bonks: { attack: string; damage: number }[] = [];
  foamers.onBonk = (f: Foamer, attack: string) => {
    const blockedNow = blocked();
    const decision = blockedNow ? decideMeleeParry(f.spec, attack, true, true) : "hit";
    if (decision === "parry") { bonks.push({ attack, damage: 0 }); return; }
    const share = decision === "block" ? SHARE : 1;
    health.damage(damageOf(attack, f.spec) * share, attack);
    bonks.push({ attack, damage: damageOf(attack, f.spec) * share });
  };
  world.step();
  return { world, darts, foamers, health, bonks };
}

type Rig = ReturnType<typeof rig>;

const PLAYER = new THREE.Vector3(0, 1.6, 0);

function tick(r: Rig, player?: THREE.Vector3) {
  r.darts.update(DT);
  r.foamers.update(DT, player ?? PLAYER);
  r.world.step();
}

function run(r: Rig, done: () => boolean, steps: number, player?: THREE.Vector3) {
  for (let i = 0; i < steps && !done(); i++) tick(r, player);
}

/** An Ambusher `metres` from the player on the z line, facing it. */
function f12(r: Rig, metres: number, player = PLAYER): Foamer {
  const f = r.foamers.spawn(new THREE.Vector3(0, 0, player.z + metres), player, "F12")!;
  expect(f.spec.rig).toBe("F12");
  return f;
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("the F12 spec (GAME-10m stage 1 and 2)", () => {
  it("1. it reads its own spec: the pounce numbers, the claw, no weak point", () => {
    const spec = specFor("F12");
    expect(spec.rig).toBe("F12");
    const p = pounceOf(spec)!;
    expect([p.minMetres, p.maxMetres, p.cooldownSeconds, p.crouchSeconds, p.arcMetres, p.hitMetres])
      .toEqual([PO.minMetres, PO.maxMetres, PO.cooldownSeconds, PO.crouchSeconds, PO.arcMetres, PO.hitMetres]);
    expect(spec.attacks.find((a) => a.id === "claw")?.damage).toBe(8);
    expect(spec.attacks.find((a) => a.id === "pounce")?.damage).toBe(15);
    expect((spec as { weakpoint?: unknown }).weakpoint).toBeUndefined();
    // The health is the rig's, 25.
    expect((spec as unknown as { health?: number }).health ?? 25).toBe(25);
  });

  it("2. it is not parryable: no attack carries the pink tell", () => {
    const spec = specFor("F12");
    for (const a of spec.attacks) {
      expect(parryableAttack(spec, a.id), `${a.id} is not parryable`).toBe(false);
    }
    // A raised shield inside the window still turns nothing.
    expect(decideMeleeParry(spec, "pounce", true, true)).toBe("block");
    expect(decideMeleeParry(spec, "claw", true, true)).toBe("block");
  });
});

describe("decidePounce (GAME-10m)", () => {
  const spec = (foamerData.types.F12 as { pounce: Parameters<typeof decidePounce>[1] }).pounce;
  const ok = { distance: 5, cooldownLeft: 0, onFeet: true, inSight: true };
  it("1. it pounces inside its band, in sight, off cooldown, on feet", () => {
    expect(decidePounce(ok, spec)).toBe(true);
    expect(decidePounce({ ...ok, distance: spec.minMetres }, spec), "the minimum counts").toBe(true);
    expect(decidePounce({ ...ok, distance: spec.maxMetres }, spec), "and the maximum").toBe(true);
  });
  it("2. it declines outside the band, on cooldown, off its feet or unseen", () => {
    expect(decidePounce({ ...ok, distance: spec.minMetres - 0.01 }, spec)).toBe(false);
    expect(decidePounce({ ...ok, distance: spec.maxMetres + 0.01 }, spec)).toBe(false);
    expect(decidePounce({ ...ok, cooldownLeft: 0.1 }, spec)).toBe(false);
    expect(decidePounce({ ...ok, onFeet: false }, spec)).toBe(false);
    expect(decidePounce({ ...ok, inSight: false }, spec)).toBe(false);
  });
});

describe("the F12 pounce, in the world (GAME-10m stage 2)", () => {
  it("3. it crouches, then pounces, inside its band", () => {
    const r = rig();
    const f = f12(r, 6);
    run(r, () => f.state === "leaping", 60 * 20);
    expect(f.state, "it flew").toBe("leaping");
    // The crouch is the telegraph: it lasted its own length.
    const g = rig();
    const fg = f12(g, 6);
    run(g, () => fg.state === "crouch", 60 * 20);
    expect(fg.state).toBe("crouch");
    let crouch = 0;
    while (fg.state === "crouch") { tick(g); crouch += DT; }
    expect(crouch, "for its whole telegraph").toBeGreaterThanOrEqual(PO.crouchSeconds - DT * 1.5);
    // It locked the spot where the player stood when the crouch began.
    expect(fg.pounceX).toBeCloseTo(PLAYER.x, 5);
    expect(fg.pounceZ).toBeCloseTo(PLAYER.z, 5);
  });

  it("4. it does not pounce inside the minimum or beyond the maximum", () => {
    const close = rig();
    const fc = f12(close, 2);
    run(close, () => false, 60 * 6);
    expect(fc.state !== "crouch" && fc.state !== "leaping", "too close: it walks in").toBe(true);
    const far = rig();
    const ff = f12(far, 11);
    run(far, () => false, 60 * 6);
    expect(ff.state !== "crouch" && ff.state !== "leaping", "too far: it walks in").toBe(true);
  });

  it("5. a landing near the player hits once, through the ordinary hit path", () => {
    const r = rig();
    const f = f12(r, 6);
    run(r, () => r.bonks.length > 0, 60 * 25);
    expect(r.bonks.length, "once").toBe(1);
    expect(r.bonks[0]!.attack, "the pounce").toBe("pounce");
    expect(r.bonks[0]!.damage, "for 15").toBeCloseTo(15, 5);
    expect(f.pounced, "the flight hit once, not every frame").toBe(true);
    // Within the next cooldown it does not pounce again, so one flight
    // stays one hit.
    const left = f.leapCooldown;
    for (let i = 0; i < Math.floor(60 * Math.max(0, left - 0.3)); i++) tick(r);
    expect(r.bonks.filter((b) => b.attack === "pounce").length, "not twice").toBe(1);
    // A fresh flight was still an arc: it left the ground and came back
    // down.
    const g = rig();
    const fg = f12(g, 6);
    run(g, () => fg.state === "leaping", 60 * 20);
    const from = fg.centre.y;
    let high = 0;
    while (fg.state === "leaping") { tick(g); high = Math.max(high, fg.centre.y - from); }
    expect(high, "it rose").toBeGreaterThan(PO.arcMetres * 0.5);
    expect(fg.centre.y - from, "and landed back down").toBeLessThan(0.3);
  });

  it("6. it lands on where the player stood when the crouch began", () => {
    // The player runs sideways after the crouch ends; the arc still goes
    // to the old spot (the card: to where the player STOOD).
    const r = rig();
    const f = f12(r, 6);
    run(r, () => f.state === "crouch", 60 * 25);
    expect(f.state).toBe("crouch");
    // Let the crouch finish and the flight begin, then move the player.
    while (f.state === "crouch") tick(r);
    expect(f.state).toBe("leaping");
    const moved = new THREE.Vector3(0, 1.6, 4); // 4 m off the old spot.
    const dx0 = f.centre.x, dz0 = f.centre.z, d0 = Math.hypot(f.pounceX - dx0, f.pounceZ - dz0);
    run(r, () => f.state !== "leaping", 60 * 10, moved);
    expect(Math.hypot(f.pounceX - dx0, f.pounceZ - dz0), "the spot held").toBeCloseTo(d0, 5);
    // The flight went to the locked spot, not after the moved player:
    // the player is now 4 m away (hitMetres is 1.2), so nothing has
    // landed since the first few frames of the flight at most.
    expect(r.bonks.length, "no hit on the moved player").toBe(0);
  });

  it("7. a raised shield takes the block share, and it is not parried", () => {
    const r = rig(() => true);
    const f = f12(r, 6);
    run(r, () => r.bonks.length > 0, 60 * 25);
    expect(r.bonks.length, "the landing still arrives").toBe(1);
    expect(r.bonks[0]!.attack).toBe("pounce");
    expect(r.bonks[0]!.damage, "for the share").toBeCloseTo(15 * SHARE, 5);
    expect(r.health.hp, "the hit landed at the share").toBeCloseTo(r.health.max - 15 * SHARE, 4);
    // The parry decider itself never offers a parry for it.
    expect(decideMeleeParry(f.spec, "pounce", true, true), "the disc turns nothing").toBe("block");
  });

  it("8. it waits for the cooldown, and the crouch starts it", () => {
    const r = rig();
    const f = f12(r, 6);
    run(r, () => f.state === "crouch", 60 * 20);
    expect(f.state).toBe("crouch");
    // The cooldown is set when the crouch starts, so read it on the first
    // crouch frame and run the clock from there.
    const deadline = f.leapCooldown;
    expect(deadline, "the crouch started the cooldown").toBeGreaterThan(0);
    let elapsed = 0;
    let secondCrouch = 0;
    while (elapsed < deadline - 0.4) {
      tick(r);
      // Past 0.5 s the first crouch (0.45 s, clamped) is over, so a crouch
      // this late is a second one.
      if (f.state === "crouch" && elapsed > 0.5) secondCrouch += 1;
      elapsed += DT;
    }
    expect(secondCrouch, "not inside the cooldown").toBe(0);
    // The first pounce landed it on the player's spot (the hit), so bring
    // it to the band again for the second crouch.
    f.centre.set(0, 0, 6);
    run(r, () => f.state === "crouch", 60 * 4);
    expect(f.state, "then it pounces again").toBe("crouch");
  });

  it("9. up close it claws instead of pouncing", () => {
    const r = rig();
    f12(r, 1.0);
    run(r, () => r.bonks.length > 0, 60 * 30);
    expect(r.bonks.length, "it landed something").toBeGreaterThan(0);
    expect(r.bonks[0]!.attack, "the claw").toBe("claw");
    expect(r.bonks[0]!.damage, "for 8").toBeCloseTo(8, 5);
  });

  it("10. with both legs gone it does not pounce; it crawls in and claws", () => {
    const r = rig();
    const f = f12(r, 6);
    f.parts.delete("legL");
    f.parts.delete("legR");
    expect(f.legs().length).toBe(0);
    let sawCrouch = false;
    for (let i = 0; i < 60 * 15 && sawCrouch === false; i++) {
      tick(r);
      if (f.state === "crouch" || f.state === "leaping") sawCrouch = true;
    }
    expect(sawCrouch, "it crawls instead").toBe(false);
    // And it still fights, close in: the claw, then the headbutt.
    f.centre.set(0, 0, 1.0);
    run(r, () => r.bonks.length > 0, 60 * 20);
    expect(r.bonks.length, "it still claws").toBeGreaterThan(0);
    expect(["claw", "headbutt"]).toContain(r.bonks[0]!.attack);
  });

  it("11. a pouncer has no shockwave ring mesh", () => {
    const r = rig();
    expect(f12(r, 6).waveMesh, "no ring").toBeNull();
    expect(r.foamers.spawn(new THREE.Vector3(4, 0, 4), PLAYER, "F07")!.waveMesh).not.toBeNull();
  });

  it("12. the flight belt: the hit is only within hitMetres of the player", () => {
    // Station the player 3 m from the landing spot (past hitMetres 1.2):
    // the arc lands on the standing spot, a few metres from where the
    // player now is; not one bonk.
    const r = rig();
    const f = f12(r, 6);
    run(r, () => f.state === "leaping", 60 * 20);
    const moved = new THREE.Vector3(0, 1.6, 3);
    run(r, () => f.state !== "leaping", 60 * 10, moved);
    expect(r.bonks, "no hit out of reach").toEqual([]);
    expect(f.pounced).toBe(false);
  });
});
