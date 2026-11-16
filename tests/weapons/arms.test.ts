// @ts-nocheck
// ARM-01: the player's gloved hands on the blasters. The trigger hand sits
// on the grip, the support hand rides the part the data names, a
// one-handed blaster has no support hand, and the hands are not part of
// the model a pickup clones. Reads the .glb files like models.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import { Viewmodel } from "../../src/weapons/viewmodel";
import { MeleeView } from "../../src/game/meleeView";
import blastersJson from "../../data/blasters.json";

const DT = 1 / 60;
const AIM = new THREE.Vector3(0, 0, -1);
const darts = { fire() {} };

function glbNodeNames(path: string): Set<string> {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const clen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + clen)));
  return new Set(json.nodes.map((n) => n.name));
}

function tree(...names: string[]): THREE.Object3D {
  const root = new THREE.Object3D();
  for (const n of names) {
    const o = new THREE.Object3D();
    o.name = n;
    root.add(o);
  }
  return root;
}

describe("ARM-01: hands on the blasters", () => {
  it("only B02 is one-handed, and every other blaster names a support grip on a node its model has", () => {
    for (const id of (blastersJson as any).order) {
      const spec = resolveSpec(id);
      if (id === "B02") {
        expect(spec.hands).toBe(1);
        expect(spec.viewmodel.support).toBeUndefined();
        continue;
      }
      expect(spec.hands, id).toBe(2);
      const s = spec.viewmodel.support;
      expect(s, id).toBeDefined();
      expect(glbNodeNames(`public${spec.model}`).has(s.node), `${id} ${s.node}`).toBe(true);
    }
  });

  it("a two-handed blaster shows two hands, a one-handed blaster one", () => {
    const b01 = Viewmodel.fromObject(resolveSpec("B01"), tree("trigger", "pump", "mag", "muzzle_1"));
    expect(b01.hands.children.length).toBe(2);
    const b02 = Viewmodel.fromObject(resolveSpec("B02"), tree("trigger", "slide", "mag", "muzzle_1"));
    expect(b02.hands.children.length).toBe(1);
  });

  it("the support hand rides the pump through a priming and comes home with it", () => {
    const spec = resolveSpec("B01");
    const vm = Viewmodel.fromObject(spec, tree("trigger", "pump", "mag", "muzzle_1", "muzzle_2", "muzzle_3"));
    const scene = new THREE.Scene();
    scene.add(vm.group);
    const b = new Blaster(spec, darts as any, () => AIM);
    vm.animate(DT, b, false);
    const support = vm.hands.children[1];
    const rest = support.position.clone();
    expect(rest.z).toBeCloseTo(spec.viewmodel.support.at[2], 5);
    b.update(DT, { fireHeld: true, firePressed: true, reloadPressed: false }, AIM);
    let far = 0;
    for (let i = 0; i < 600 && b.state === "priming"; i++) {
      b.update(DT, { fireHeld: false, firePressed: false, reloadPressed: false }, AIM);
      vm.animate(DT, b, false);
      far = Math.max(far, support.position.z - rest.z);
    }
    expect(far).toBeGreaterThan(spec.motion.pumpTravel * 0.9);
    vm.animate(DT, b, false);
    expect(support.position.z).toBeCloseTo(rest.z, 5);
  });

  it("the hands follow the blaster's placement but are not in the model a pickup clones", () => {
    const spec = resolveSpec("B01");
    const vm = Viewmodel.fromObject(spec, tree("trigger", "pump", "mag", "muzzle_1"));
    let meshes = 0;
    vm.model.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBe(0);
    vm.setDip(-0.2);
    vm.animate(DT, new Blaster(spec, darts as any, () => AIM), false);
    expect(vm.hands.position.y).toBeCloseTo(vm.model.position.y, 6);
    expect(vm.hands.position.y).toBeCloseTo(spec.viewmodel.position[1] - 0.2, 6);
  });

  it("the sword has a hand on its grip that moves through the stroke", () => {
    const view = new MeleeView(new THREE.PerspectiveCamera());
    expect(view.group.children.length).toBe(2); // the sword's swing and the arm
    const hand = view.group.children[1];
    view.swing(0);
    view.render(DT);
    const a = hand.position.clone();
    for (let i = 0; i < 5; i++) view.render(DT);
    expect(hand.position.distanceTo(a)).toBeGreaterThan(0.01);
  });
});
