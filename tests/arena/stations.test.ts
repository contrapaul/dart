import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Stations, useHeldForStations, type StationLoadout } from "../../src/arena/stations";
import type { Rapier } from "../../src/physics/world";

// ENV-03 stage 1: the mod station, headless. A station at the origin faces
// the -z direction (facing 0, the player's convention), so the player
// stands on +z of it and looks -z. The use point is on the cabinet's face,
// at the session height above the floor.
const DT = 0.1;
const FACE: [number, number, number] = [0, 0, 0];
const STATION = { id: "s1", pos: FACE, facing: 0, blaster: "B01", mod: "slug" };

function makeCargo(ids: string[]) {
  const calls: [number, string, boolean][] = [];
  const loadout: StationLoadout = {
    ids,
    setMod(i, mod, on) { calls.push([i, mod, on]); },
  };
  return { loadout, calls };
}

/** Steps whose use point the player stands in front of (0.4 m from the
 *  face point, inside the 1.2 m reach) and looks at (facing -z, the
 *  cabinet's direction). */
function atStation(frames: number) {
  const eye = new THREE.Vector3(0, 1.15, 0.7);
  const fwd = new THREE.Vector3(0, 0, -1);
  return { frame: frames, eye, fwd };
}

describe("the mod station", () => {
  let world: RAPIER.World;
  beforeAll(async () => {
    await RAPIER.init();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  });

  function makeStation(ids = ["B01", "B04", "B03"]) {
    const scene = new THREE.Scene();
    const { loadout, calls } = makeCargo(ids);
    const granted: string[] = [];
    const needBlaster: string[] = [];
    const spentBuzz: string[] = [];
    const stations = new Stations(RAPIER as unknown as Rapier, world, scene, [structuredClone(STATION)]);
    stations.onGranted = (it) => { granted.push(it.id); };
    stations.onNeedBlaster = (it) => { needBlaster.push(it.id); };
    stations.onSpent = (it) => { spentBuzz.push(it.id); };
    return { stations, loadout, calls, granted, needBlaster, spentBuzz };
  }

  it("holding the use key within reach and facing grants the mod once", () => {
    const t = makeStation();
    const g = atStation(7);
    for (let i = 0; i < g.frame; i++)
      t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.calls).toEqual([[0, "slug", true]]);
    expect(t.granted).toEqual(["s1"]);
    expect(t.stations.items[0].spent).toBe(true);
  });

  it("a hold shorter than the session's does not grant", () => {
    const t = makeStation();
    const g = atStation(5); // 0.5 s, one step short of the 0.6 s hold
    for (let i = 0; i < g.frame; i++)
      t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.calls).toHaveLength(0);
    // The next step out and back completes the hold.
    t.stations.update(DT, g.eye, g.fwd, false, t.loadout);
    expect(t.calls).toHaveLength(0);
    t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.calls).toHaveLength(0);
  });

  it("out of reach does nothing", () => {
    const t = makeStation();
    const eye = new THREE.Vector3(0, 1.15, 2.3); // 2.6 m from the use point
    const fwd = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < 10; i++) t.stations.update(DT, eye, fwd, true, t.loadout);
    expect(t.calls).toHaveLength(0);
    expect(t.granted).toHaveLength(0);
  });

  it("looking away does nothing", () => {
    const t = makeStation();
    const eye = new THREE.Vector3(0, 1.15, 0.7);
    const fwd = new THREE.Vector3(0, 0, 1); // looking at the back of the cabinet
    for (let i = 0; i < 10; i++) t.stations.update(DT, eye, fwd, true, t.loadout);
    expect(t.calls).toHaveLength(0);
    expect(t.granted).toHaveLength(0);
  });

  it("a second hold does not grant again", () => {
    const t = makeStation();
    const g = atStation(7);
    for (let i = 0; i < 7; i++) t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.calls).toHaveLength(1);
    // The player keeps standing there, key held.
    for (let i = 0; i < 10; i++) t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.calls).toHaveLength(1);
    expect(t.granted).toHaveLength(1);
    // A grant is its own answer: the spent buzz is not queued after it,
    // so a continued hold stays quiet.
    expect(t.spentBuzz).toHaveLength(0);
  });

  it("a station whose blaster the player does not carry says so and grants nothing", () => {
    const t = makeStation(["B04", "B03"]); // B01 missing
    const g = atStation(7);
    for (let i = 0; i < 7; i++) t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.calls).toHaveLength(0);
    expect(t.needBlaster).toEqual(["s1"]);
    expect(t.granted).toHaveLength(0);
    // Still not spent: with the blaster in the hands it can grant.
    expect(t.stations.items[0].spent).toBe(false);
  });

  it("LVL-05: a station for a blaster built but not yet found grants nothing", () => {
    const t = makeStation(); // B01 is in the loadout...
    const owned = new Set(["B04", "B03"]); // ...but the campaign has not found it
    const loadout: StationLoadout = { ...t.loadout, owns: (id) => owned.has(id) };
    const g = atStation(7);
    for (let i = 0; i < 7; i++) t.stations.update(DT, g.eye, g.fwd, true, loadout);
    expect(t.calls).toHaveLength(0);
    expect(t.needBlaster).toEqual(["s1"]);
    expect(t.stations.items[0].spent).toBe(false);
  });

  it("restarts reset the station, and it can grant again", () => {
    const t = makeStation();
    const g = atStation(7);
    for (let i = 0; i < 7; i++) t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.granted).toHaveLength(1);
    t.stations.reset();
    expect(t.stations.items[0].spent).toBe(false);
    for (let i = 0; i < 7; i++) t.stations.update(DT, g.eye, g.fwd, true, t.loadout);
    expect(t.granted).toHaveLength(2);
    expect(t.calls.length).toBe(2);
  });

  it("a level with no stations loads as before: nothing, and no prompt", () => {
    const scene = new THREE.Scene();
    const { loadout } = makeCargo(["B01", "B04", "B03"]);
    const stations = new Stations(RAPIER as unknown as Rapier, world, scene, []);
    expect(stations.items).toHaveLength(0);
    const eye = new THREE.Vector3(0, 1.15, 0.7);
    const fwd = new THREE.Vector3(0, 0, -1);
    stations.update(DT, eye, fwd, true, loadout);
    expect(stations.prompt(eye, fwd)).toBeNull();
  });
});

describe("the use key goes to the tools first", () => {
  const eye = new THREE.Vector3(0, 0, 0);
  const fwd = new THREE.Vector3(0, 0, -1);

  function tools(opts: {
    finisherActive?: boolean; finisherTarget?: boolean;
    vacuumActive?: boolean; vacuumTarget?: boolean; held: boolean;
  }) {
    return {
      finisher: { active: !!opts.finisherActive, has: () => !!opts.finisherTarget },
      vacuum: { active: !!opts.vacuumActive, hasTarget: () => (opts.vacuumTarget ? {} : null) },
      useHeld: opts.held,
    };
  }

  it("a held key with no tool target reaches the stations", () => {
    expect(useHeldForStations(tools({ held: true }), eye, fwd)).toBe(true);
  });

  it("a key that is not held does not", () => {
    expect(useHeldForStations(tools({ held: false }), eye, fwd)).toBe(false);
  });

  it("a finisher with a target takes the key first", () => {
    expect(useHeldForStations(tools({ held: true, finisherTarget: true }), eye, fwd)).toBe(false);
  });

  it("a vacuum with a target takes the key first", () => {
    expect(useHeldForStations(tools({ held: true, vacuumTarget: true }), eye, fwd)).toBe(false);
  });

  it("a finisher mid-use takes the key first", () => {
    expect(useHeldForStations(tools({ held: true, finisherActive: true }), eye, fwd)).toBe(false);
  });

  it("a vacuum mid-use takes the key first", () => {
    expect(useHeldForStations(tools({ held: true, vacuumActive: true }), eye, fwd)).toBe(false);
  });
});
